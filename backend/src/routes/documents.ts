import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import {
  upload,
  uploadSingleFile,
  uploadLimiter,
  validateFileMagicBytes,
  isSignatureMatchingExtensionAndMime,
  UPLOAD_ELIGIBLE_STATUSES,
} from '../middleware/upload';
import { config } from '../config';
import {
  uploadDocumentFile,
  getDocumentStream,
  deleteOrphanedR2Object,
} from '../services/storageService';

const router = Router();

export interface AuthorizedUploadRequest extends Request {
  serviceRequest?: any;
  uploadTokenClaims?: any;
}

// Helper to reliably clean up any uploaded temporary file if validation fails
export function cleanupUploadedFile(req: Request): void {
  const pendingPath = (req as any)._multerPendingFilePath;
  if (pendingPath && fs.existsSync(pendingPath)) {
    try {
      fs.unlinkSync(pendingPath);
    } catch {
      // Ignore unlink errors
    }
  }
  if (req.file?.path && fs.existsSync(req.file.path)) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // Ignore unlink errors
    }
  }
}

/**
 * Pre-upload middleware: verifies upload authorization token and service request eligibility
 * BEFORE Multer streams or writes any uploaded file bytes to disk.
 */
export const verifyUploadAuthorization = async (
  req: AuthorizedUploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract upload authorization token from header
    const rawToken =
      (req.headers['x-upload-token'] as string) ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : undefined);

    if (!rawToken) {
      res.status(401).json({ error: 'Upload authorization token is required' });
      return;
    }

    // 2. Cryptographically verify the upload token (algorithm HS256 enforced)
    let decoded: any;
    try {
      decoded = jwt.verify(rawToken, config.jwt.secret, { algorithms: ['HS256'] });
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Upload session has expired. Please track your request again.' });
        return;
      }
      res.status(401).json({ error: 'Invalid upload authorization token' });
      return;
    }

    // 3. Verify token purpose and target service request binding
    if (decoded.purpose !== 'customer_document_upload') {
      res.status(403).json({ error: 'Invalid token purpose' });
      return;
    }

    const serviceRequestId = req.params.serviceRequestId as string;
    if (decoded.sub !== serviceRequestId) {
      res.status(403).json({ error: 'Token is not authorized for this service request' });
      return;
    }

    // 4. Load service request from DB & verify it exists and is eligible for uploads
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    // Enforce explicit allowlist of statuses permitted to receive documents
    if (!UPLOAD_ELIGIBLE_STATUSES.has(serviceRequest.status)) {
      res.status(400).json({
        error: `Service request in '${serviceRequest.status}' status cannot accept document uploads. Uploads are only accepted for active requests (NEW, DOCUMENTS_REQUIRED, DOCUMENTS_RECEIVED, UNDER_REVIEW, IN_PROGRESS).`,
      });
      return;
    }

    // Attach verified records to req for downstream Multer and route handler
    req.serviceRequest = serviceRequest;
    req.uploadTokenClaims = decoded;
    next();
  } catch (error) {
    console.error('Verify upload authorization error:', error);
    res.status(500).json({ error: 'Internal authorization error' });
  }
};

// POST /api/documents/upload/:serviceRequestId - Upload document verified via pre-Multer token authorization
router.post(
  '/upload/:serviceRequestId',
  uploadLimiter,
  verifyUploadAuthorization, // Runs BEFORE Multer writes any file to disk!
  uploadSingleFile('file'), // Wraps Multer and guarantees unlinking on LIMIT_FILE_SIZE or stream error!
  async (req: AuthorizedUploadRequest, res: Response): Promise<void> => {
    try {
      const serviceRequest = req.serviceRequest;
      const serviceRequestId = req.params.serviceRequestId as string;

      // 1. Verify file payload
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { documentType } = req.body;
      if (!documentType || typeof documentType !== 'string' || !documentType.trim()) {
        cleanupUploadedFile(req);
        res.status(400).json({ error: 'Document type is required' });
        return;
      }

      // 2. Inspect binary file signature (magic bytes) on disk and ensure consistency with extension and MIME type
      const magicValidation = validateFileMagicBytes(req.file.path);
      if (!magicValidation.valid || !magicValidation.detected) {
        cleanupUploadedFile(req);
        res.status(400).json({ error: 'File signature verification failed: contents do not match allowed formats' });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!isSignatureMatchingExtensionAndMime(magicValidation.detected, ext, req.file.mimetype)) {
        cleanupUploadedFile(req);
        res.status(400).json({
          error: `File signature mismatch: detected ${magicValidation.detected.toUpperCase()} contents do not match the declared extension (${ext}) or MIME type (${req.file.mimetype})`,
        });
        return;
      }

      // 3. Sanitize filename to prevent header injection or path traversal
      const safeOriginalName = path.basename(req.file.originalname).replace(/[\r\n"']/g, '_');

      // 4. Upload file to Cloudflare R2 (or local fallback if unconfigured)
      const uploadResult = await uploadDocumentFile({
        localFilePath: req.file.path,
        originalName: safeOriginalName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        serviceRequestId: serviceRequest.id,
        documentType: documentType.trim(),
      });

      // 5. Create document record - deriving customerId strictly from the database record
      let document: any;
      try {
        document = await prisma.document.create({
          data: {
            customerId: serviceRequest.customerId,
            serviceRequestId: serviceRequest.id,
            documentType: documentType.trim(),
            originalName: safeOriginalName,
            storedName: uploadResult.storedName,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
          },
        });

        // Clean up temporary local file once successfully uploaded to R2
        if (uploadResult.storageProvider === 'r2') {
          cleanupUploadedFile(req);
        }
      } catch (dbError) {
        // Clean up orphaned R2 object if database insert failed
        if (uploadResult.storageProvider === 'r2') {
          await deleteOrphanedR2Object(uploadResult.storedName);
        }
        cleanupUploadedFile(req);
        throw dbError;
      }

      // 6. Update request status if in NEW or DOCUMENTS_REQUIRED
      if (serviceRequest.status === 'DOCUMENTS_REQUIRED' || serviceRequest.status === 'NEW') {
        await prisma.serviceRequest.update({
          where: { id: serviceRequestId },
          data: { status: 'DOCUMENTS_RECEIVED' },
        });
        await prisma.requestStatusHistory.create({
          data: {
            serviceRequestId,
            oldStatus: serviceRequest.status,
            newStatus: 'DOCUMENTS_RECEIVED',
            note: `Document uploaded: ${documentType.trim()}`,
            changedBy: 'customer',
          },
        });
      }

      res.status(201).json({
        message: 'Document uploaded successfully',
        document: {
          id: document.id,
          documentType: document.documentType,
          originalName: document.originalName,
          status: document.status,
          createdAt: document.createdAt,
        },
      });
    } catch (error) {
      cleanupUploadedFile(req);
      console.error('Upload document error:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// GET /api/documents/:id/download - Admin: download document (streamed securely from R2 or local disk)
router.get('/:id/download', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id as string } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const safeDownloadName = path.basename(document.originalName).replace(/[\r\n"']/g, '_');

    const streamResult = await getDocumentStream(document.storedName);
    if (!streamResult) {
      res.status(404).json({ error: 'File not found on server' });
      return;
    }

    res.setHeader('Content-Type', streamResult.contentType || document.mimeType || 'application/octet-stream');
    if (streamResult.contentLength || document.fileSize) {
      res.setHeader('Content-Length', (streamResult.contentLength || document.fileSize).toString());
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeDownloadName}"`
    );

    streamResult.stream.on('error', (streamErr: any) => {
      console.error('Stream error during document download:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream document' });
      }
    });

    streamResult.stream.pipe(res);
  } catch (error) {
    console.error('Download document error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download document' });
    }
  }
});

// GET /api/documents - Admin: list documents
router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, serviceRequestId } = req.query;
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (serviceRequestId) where.serviceRequestId = serviceRequestId;

    const documents = await prisma.document.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// PATCH /api/documents/:id/status - Admin: update document status
router.patch('/:id/status', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['UPLOADED', 'VERIFIED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const document = await prisma.document.update({
      where: { id: req.params.id as string },
      data: { status },
    });

    res.json({ message: 'Document status updated', document });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

export default router;
