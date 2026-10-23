import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import prisma from '../config/database';
import { config } from '../config';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { UPLOAD_ELIGIBLE_STATUSES } from '../middleware/upload';
import { generateRequestId, maskPAN, encryptData, decryptData } from '../utils/helpers';
import { sendEmail } from '../services/emailService';
import { renderServiceRequestConfirmationEmail, renderOtpEmail } from '../utils/emailTemplates';
import { generateOtp, generateSalt, hashOtp, verifyOtpHash, maskEmail } from '../utils/otp';
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/otpRateLimit';
import { deleteDocumentFile } from '../services/storageService';

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

const router = Router();

// Stricter rate limit for public tracking checks to prevent phone/requestId enumeration
export const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests. Please try again after 15 minutes.' },
});

export class OtpCooldownError extends Error {
  remainingSeconds: number;
  constructor(remainingSeconds: number) {
    super(`Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another code.`);
    this.name = 'OtpCooldownError';
    this.remainingSeconds = remainingSeconds;
  }
}

/**
 * Shared, concurrency-safe handler for requesting and resending 6-digit email OTPs.
 * Atomically checks cooldown, invalidates older active OTPs, and creates a new OTP record
 * under a database row lock without holding transactions open during email delivery.
 */
async function handleOtpRequestFlow(req: Request, res: Response): Promise<void> {
  try {
    const { requestId, phone } = req.body;

    if (!requestId || typeof requestId !== 'string' || !phone || typeof phone !== 'string') {
      res.status(400).json({ error: 'Request ID and mobile number are required' });
      return;
    }

    const cleanId = requestId.trim();
    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    // Generic response message to avoid leaking user/request existence
    const genericSuccess = {
      success: true,
      message: 'If the provided details match an active request with a registered email, a verification code has been sent.',
    };

    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        requestId: cleanId,
        customer: { phone: cleanPhone },
      },
      include: {
        customer: true,
      },
    });

    // If request or customer not found, or customer has no registered email: fail closed
    const customerEmail = serviceRequest?.customer?.email ? serviceRequest.customer.email.trim() : null;
    if (!serviceRequest || !customerEmail) {
      res.json(genericSuccess);
      return;
    }

    const COOLDOWN_MS = 60 * 1000;
    let newOtpRecord: any;
    let otpToEmail: string;

    try {
      const txResult = await prisma.$transaction(async (tx) => {
        // Row-lock the ServiceRequest in PostgreSQL to serialize concurrent OTP requests for this request
        await tx.$executeRaw`SELECT id FROM "ServiceRequest" WHERE id = ${serviceRequest.id} FOR UPDATE`;

        const latestOtp = await tx.emailOtp.findFirst({
          where: { serviceRequestId: serviceRequest.id },
          orderBy: { createdAt: 'desc' },
        });

        if (latestOtp && Date.now() - latestOtp.createdAt.getTime() < COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - latestOtp.createdAt.getTime())) / 1000);
          throw new OtpCooldownError(remainingSeconds);
        }

        // Atomically invalidate any existing unconsumed active OTPs for this service request
        await tx.emailOtp.updateMany({
          where: {
            serviceRequestId: serviceRequest.id,
            consumedAt: null,
          },
          data: {
            consumedAt: new Date(),
          },
        });

        // Generate fresh cryptographic 6-digit OTP and salt
        const otp = generateOtp();
        const salt = generateSalt();
        const codeHash = hashOtp(otp, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Persist OTP record in database
        const created = await tx.emailOtp.create({
          data: {
            serviceRequestId: serviceRequest.id,
            email: customerEmail,
            codeHash,
            salt,
            attempts: 0,
            maxAttempts: 5,
            expiresAt,
          },
        });

        return { created, otp };
      });

      newOtpRecord = txResult.created;
      otpToEmail = txResult.otp;
    } catch (txError: any) {
      if (txError instanceof OtpCooldownError || txError?.name === 'OtpCooldownError') {
        res.status(429).json({
          error: txError.message,
          cooldownSeconds: txError.remainingSeconds,
        });
        return;
      }
      throw txError;
    }

    // Database transaction is committed. Dispatch email without holding DB connection open.
    const emailContent = renderOtpEmail({
      customerName: serviceRequest.customer.name,
      requestId: serviceRequest.requestId,
      otp: otpToEmail,
      expiresInMinutes: 10,
    });

    const sendResult = await sendEmail({
      to: customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!sendResult.success) {
      console.error(`Failed to dispatch OTP for request ${serviceRequest.requestId}:`, sendResult.error);

      // Invalidate ONLY this specific OTP record, and only if still unconsumed.
      // This ensures no ghost OTP is usable while leaving any newer OTP intact.
      await prisma.emailOtp.updateMany({
        where: {
          id: newOtpRecord.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (config.nodeEnv === 'production') {
        res.status(502).json({ error: 'Unable to deliver verification code. Please try again later.' });
        return;
      }
    }

    res.json(genericSuccess);
  } catch (error) {
    console.error('Request/resend OTP error:', error);
    res.status(500).json({ error: 'Failed to process verification code request.' });
  }
}

// POST /api/service-requests/track/request-otp - Request 6-digit email OTP for tracking and upload authorization
router.post('/track/request-otp', otpRequestLimiter, handleOtpRequestFlow);

// POST /api/service-requests/track/resend-otp - Resend 6-digit OTP alias
router.post('/track/resend-otp', otpRequestLimiter, handleOtpRequestFlow);

// POST /api/service-requests/track/verify-otp - Verify 6-digit OTP and authorize tracking & document upload
router.post('/track/verify-otp', otpVerifyLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId, phone, otp } = req.body;

    if (!requestId || typeof requestId !== 'string' || !phone || typeof phone !== 'string' || !otp || typeof otp !== 'string') {
      res.status(400).json({ error: 'Request ID, mobile number, and 6-digit verification code are required' });
      return;
    }

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      res.status(400).json({ error: 'Verification code must be exactly 6 digits' });
      return;
    }

    const cleanId = requestId.trim();
    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');

    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        requestId: cleanId,
        customer: { phone: cleanPhone },
      },
      include: {
        service: true,
        documents: true,
      },
    });

    if (!serviceRequest) {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    // Concurrency-safe verification inside an interactive transaction with row-level locking
    const verifyResult = await prisma.$transaction(async (tx) => {
      // Find latest active unconsumed OTP for this service request
      const candidateOtp = await tx.emailOtp.findFirst({
        where: {
          serviceRequestId: serviceRequest.id,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!candidateOtp) {
        return { status: 'NOT_FOUND' as const };
      }

      // Lock this specific OTP row FOR UPDATE in PostgreSQL to serialize concurrent verification/attempts
      await tx.$executeRaw`SELECT id FROM "EmailOtp" WHERE id = ${candidateOtp.id} FOR UPDATE`;

      // Re-fetch after acquiring exclusive lock to ensure fresh, committed row state
      const activeOtp = await tx.emailOtp.findUnique({
        where: { id: candidateOtp.id },
      });

      if (!activeOtp || activeOtp.consumedAt !== null) {
        return { status: 'ALREADY_CONSUMED' as const };
      }

      // Check expiration
      if (activeOtp.expiresAt.getTime() < Date.now()) {
        await tx.emailOtp.update({
          where: { id: activeOtp.id },
          data: { consumedAt: new Date() },
        });
        return { status: 'EXPIRED' as const };
      }

      // Check maximum attempts
      if (activeOtp.attempts >= activeOtp.maxAttempts) {
        await tx.emailOtp.update({
          where: { id: activeOtp.id },
          data: { consumedAt: new Date() },
        });
        return { status: 'LOCKED_OUT' as const };
      }

      // Constant-time hash verification
      const isValid = verifyOtpHash(cleanOtp, activeOtp.salt, activeOtp.codeHash);

      if (!isValid) {
        const nextAttempts = activeOtp.attempts + 1;
        const isNowLocked = nextAttempts >= activeOtp.maxAttempts;

        await tx.emailOtp.update({
          where: { id: activeOtp.id },
          data: {
            attempts: nextAttempts,
            ...(isNowLocked ? { consumedAt: new Date() } : {}),
          },
        });

        return {
          status: 'INVALID_CODE' as const,
          isNowLocked,
          remaining: Math.max(0, activeOtp.maxAttempts - nextAttempts),
        };
      }

      // Atomically consume single-use OTP
      await tx.emailOtp.update({
        where: { id: activeOtp.id },
        data: { consumedAt: new Date() },
      });

      return { status: 'SUCCESS' as const };
    });

    if (verifyResult.status === 'NOT_FOUND' || verifyResult.status === 'ALREADY_CONSUMED') {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    if (verifyResult.status === 'EXPIRED') {
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }

    if (verifyResult.status === 'LOCKED_OUT') {
      res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
      return;
    }

    if (verifyResult.status === 'INVALID_CODE') {
      if (verifyResult.isNowLocked) {
        res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
      } else {
        const remaining = verifyResult.remaining;
        res.status(400).json({ error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
      }
      return;
    }

    // Issue short-lived signed upload token if request is eligible for document upload
    const isUploadEligible = UPLOAD_ELIGIBLE_STATUSES.has(serviceRequest.status);
    let uploadToken: string | null = null;

    if (isUploadEligible) {
      uploadToken = jwt.sign(
        {
          sub: serviceRequest.id,
          requestId: serviceRequest.requestId,
          purpose: 'customer_document_upload',
          jti: crypto.randomUUID(),
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
        }
      );
    }

    // Strictly minimized, customer-safe response payload
    res.json({
      success: true,
      message: 'Verification successful.',
      uploadToken,
      request: {
        id: serviceRequest.id,
        requestId: serviceRequest.requestId,
        status: serviceRequest.status,
        createdAt: serviceRequest.createdAt,
        service: serviceRequest.service ? {
          name: serviceRequest.service.name,
        } : null,
        adminNotes: null, // Strictly withhold internal notes; schema lacks a customer-approved message channel
      },
      documents: serviceRequest.documents.map((d: any) => ({
        id: d.id,
        documentType: d.documentType,
        originalName: d.originalName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        status: d.status,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify verification code.' });
  }
});

// POST /api/service-requests - Public: create a new service request
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, phone, email, serviceId, message,
      assessmentYear, incomeType, panNumber,
      businessName, gstStatus, policyNumber,
      preferredContactTime, formData,
    } = req.body;

    if (!name || !phone || !serviceId) {
      res.status(400).json({ error: 'Name, phone, and service are required' });
      return;
    }

    // Validate phone
    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    // Validate email if supplied
    let cleanEmail: string | null = null;
    if (email !== undefined && email !== null) {
      if (typeof email !== 'string') {
        res.status(400).json({ error: 'Please enter a valid email address' });
        return;
      }
      const trimmedEmail = email.trim();
      if (trimmedEmail !== '') {
        if (!isValidEmail(trimmedEmail)) {
          res.status(400).json({ error: 'Please enter a valid email address' });
          return;
        }
        cleanEmail = trimmedEmail.toLowerCase();
      }
    }

    // Check service exists (by id or slug)
    let service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      service = await prisma.service.findUnique({ where: { slug: serviceId } });
    }
    if (!service) {
      res.status(400).json({ error: 'Invalid service selected' });
      return;
    }
    const actualServiceId = service.id;

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, phone: cleanPhone, email: cleanEmail || null },
      });
    } else {
      // Existing customer: strictly preserve customer email.
      // An unauthenticated public service request submission MUST NEVER overwrite or attach
      // an unverified email to an existing customer record (even if customer.email is null or empty).
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name,
        },
      });
    }

    // Generate request ID
    const requestId = await generateRequestId();

    // Create service request with encrypted PAN
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        requestId,
        customerId: customer.id,
        serviceId: actualServiceId,
        message,
        assessmentYear,
        incomeType,
        panEncrypted: panNumber ? encryptData(panNumber.toUpperCase().trim()) : null,
        businessName,
        gstStatus,
        policyNumber,
        formData: formData ? JSON.stringify(formData) : preferredContactTime ? JSON.stringify({ preferredContactTime }) : null,
        confirmationEmailSent: false,
      },
    });

    // Create initial status history
    await prisma.requestStatusHistory.create({
      data: {
        serviceRequestId: serviceRequest.id,
        newStatus: 'NEW',
        note: 'Request submitted by customer',
        changedBy: 'system',
      },
    });

    // Create notification for admin
    await prisma.notification.create({
      data: {
        type: 'admin',
        title: 'New Service Request',
        message: `New ${service.name} request from ${name} (${requestId})`,
        link: `/admin/requests/${serviceRequest.id}`,
      },
    });

    // Dispatch confirmation email if registered customer email is available
    let emailSent = false;
    const recipientEmail = typeof customer.email === 'string' && customer.email.trim() !== ''
      ? customer.email.trim()
      : null;

    if (recipientEmail && !serviceRequest.confirmationEmailSent) {
      try {
        const trackingUrl = `${config.frontendUrl}/track?requestId=${encodeURIComponent(requestId)}`;
        const emailTemplate = renderServiceRequestConfirmationEmail({
          customerName: name,
          requestId,
          serviceName: service.name,
          submittedAt: serviceRequest.createdAt,
          trackingUrl,
        });

        const sendResult = await sendEmail({
          to: recipientEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });

        if (sendResult.success) {
          emailSent = true;
          await prisma.serviceRequest.update({
            where: { id: serviceRequest.id },
            data: { confirmationEmailSent: true },
          });
        } else {
          console.error(`Failed to send confirmation email for request ${requestId}:`, sendResult.error);
        }
      } catch (emailErr) {
        // Email delivery failure must never fail the request creation response
        console.error(`Unexpected error sending confirmation email for request ${requestId}:`, emailErr);
      }
    }

    const responseMessage = emailSent
      ? 'Your request has been successfully submitted. A confirmation email has been sent to your registered email address.'
      : 'Your request has been successfully submitted.';

    res.status(201).json({
      message: responseMessage,
      requestId,
      status: 'NEW',
      submittedAt: serviceRequest.createdAt,
      confirmationEmailSent: emailSent,
    });
  } catch (error) {
    console.error('Create service request error:', error);
    res.status(500).json({ error: 'Your request could not be submitted. Please try again.' });
  }
});

// GET /api/service-requests/track - Disabled: tracking details and upload tokens require email OTP verification
router.get('/track', (_req: Request, res: Response): void => {
  res.status(403).json({
    error: 'Direct tracking without email OTP verification is disabled. Please verify via email OTP to view request details and upload documents.',
  });
});

// GET /api/service-requests - Admin: list all requests
router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, serviceId, search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (serviceId) where.serviceId = serviceId;
    if (search) {
      where.OR = [
        { requestId: { contains: search as string } },
        { customer: { name: { contains: search as string } } },
        { customer: { phone: { contains: search as string } } },
        { customer: { email: { contains: search as string } } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          service: { select: { id: true, name: true, category: true } },
          documents: true,
          _count: { select: { documents: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    res.json({
      requests: requests.map(r => ({
        ...r,
        panEncrypted: r.panEncrypted ? maskPAN(decryptData(r.panEncrypted)) : null,
      })),
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// GET /api/service-requests/:id - Admin: get single request details
router.get('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        customer: true,
        service: true,
        documents: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          include: { admin: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    res.json({
      ...serviceRequest,
      panEncrypted: serviceRequest.panEncrypted ? maskPAN(serviceRequest.panEncrypted) : null,
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// PATCH /api/service-requests/:id/status - Admin: update request status
router.patch('/:id/status', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['NEW', 'DOCUMENTS_REQUIRED', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const existing = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id as string },
      include: { customer: true, service: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const oldStatus = existing.status;

    await prisma.serviceRequest.update({
      where: { id: req.params.id as string },
      data: { status },
    });

    // Create status history
    await prisma.requestStatusHistory.create({
      data: {
        serviceRequestId: req.params.id as string,
        oldStatus,
        newStatus: status,
        note,
        changedBy: req.admin!.id,
      },
    });

    // Create an AdminNote if note is provided, so customer sees it
    if (note) {
      await prisma.adminNote.create({
        data: {
          content: note,
          serviceRequestId: req.params.id as string,
          adminId: req.admin!.id,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.id,
        action: 'STATUS_CHANGE',
        entityType: 'service_request',
        entityId: req.params.id as string,
        oldValue: JSON.stringify({ status: oldStatus }),
        newValue: JSON.stringify({ status }),
      },
    });

    // Notification for status change
    await prisma.notification.create({
      data: {
        type: 'customer',
        targetId: existing.customerId,
        title: 'Request Status Updated',
        message: `Your ${existing.service.name} request (${existing.requestId}) status has been updated to: ${status.replace(/_/g, ' ')}`,
      },
    });

    res.json({ message: 'Status updated successfully', oldStatus, newStatus: status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/service-requests/:id - Admin: delete request
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    // Clean up document files from Cloudflare R2 and/or local disk before deleting database records
    const docs = await prisma.document.findMany({
      where: { serviceRequestId: req.params.id as string },
      select: { storedName: true },
    });
    for (const doc of docs) {
      await deleteDocumentFile(doc.storedName);
    }

    // Delete related RequestStatusHistory
    await prisma.requestStatusHistory.deleteMany({
      where: { serviceRequestId: req.params.id as string }
    });
    
    // Delete related Documents
    await prisma.document.deleteMany({
      where: { serviceRequestId: req.params.id as string }
    });

    // Delete related AdminNotes
    await prisma.adminNote.deleteMany({
      where: { serviceRequestId: req.params.id as string }
    });

    await prisma.serviceRequest.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Service request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Failed to delete service request' });
  }
});

export default router;
