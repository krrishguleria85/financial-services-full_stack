import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { config } from '../config';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { generateRequestId, maskPAN, encryptData, decryptData } from '../utils/helpers';

const router = Router();

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

    // Check service exists
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      res.status(400).json({ error: 'Invalid service selected' });
      return;
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { name, phone: cleanPhone, email },
      });
    } else {
      // Update customer info
      await prisma.customer.update({
        where: { id: customer.id },
        data: { name, email: email || customer.email },
      });
    }

    // Generate request ID
    const requestId = await generateRequestId();

    // Create service request with encrypted PAN
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        requestId,
        customerId: customer.id,
        serviceId,
        message,
        assessmentYear,
        incomeType,
        panEncrypted: panNumber ? encryptData(panNumber.toUpperCase().trim()) : null,
        businessName,
        gstStatus,
        policyNumber,
        formData: formData ? JSON.stringify(formData) : preferredContactTime ? JSON.stringify({ preferredContactTime }) : null,
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

    res.status(201).json({
      message: 'Your request has been successfully submitted.',
      requestId,
      status: 'NEW',
      submittedAt: serviceRequest.createdAt,
    });
  } catch (error) {
    console.error('Create service request error:', error);
    res.status(500).json({ error: 'Your request could not be submitted. Please try again.' });
  }
});

// GET /api/service-requests/track - Public: track request status
router.get('/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestId, phone } = req.query;

    if (!requestId || !phone) {
      res.status(400).json({ error: 'Request ID and mobile number are required' });
      return;
    }

    const cleanPhone = (phone as string).replace(/[\s\-+]/g, '').replace(/^91/, '');

    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        requestId: requestId as string,
        customer: { phone: cleanPhone },
      },
      include: {
        service: true,
        customer: { select: { name: true } },
        documents: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: { newStatus: true, createdAt: true, note: true },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        }
      },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'No request found with the provided details. Please check your Request ID and mobile number.' });
      return;
    }

    // Safely get public customer-facing update note from status history
    const customerUpdateNote = serviceRequest.statusHistory
      .slice()
      .reverse()
      .find(h => h.note && !h.note.startsWith('Status updated to') && h.note !== 'Request submitted by customer')?.note || null;

    res.json({
      request: {
        ...serviceRequest,
        panEncrypted: serviceRequest.panEncrypted ? maskPAN(decryptData(serviceRequest.panEncrypted)) : null,
        adminNotes: customerUpdateNote,
      },
      documents: serviceRequest.documents,
      timeline: serviceRequest.statusHistory.map(h => ({
        status: h.newStatus,
        date: h.createdAt,
        note: h.note,
      })),
    });
  } catch (error) {
    console.error('Track request error:', error);
    res.status(500).json({ error: 'Failed to track request' });
  }
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

    // Clean up physical document files from disk before deleting database records
    const docs = await prisma.document.findMany({
      where: { serviceRequestId: req.params.id as string },
      select: { storedName: true },
    });
    for (const doc of docs) {
      const filePath = path.join(config.upload.dir, doc.storedName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Error removing document file:', e); }
      }
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
