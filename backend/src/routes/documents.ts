import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const router = Router();

// POST /api/documents/upload/:serviceRequestId - Public: upload document for a specific request
router.post('/upload/:serviceRequestId', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const serviceRequestId = req.params.serviceRequestId as string;
    const { documentType } = req.body;

    if (!documentType) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Document type is required' });
      return;
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId }
    });

    if (!serviceRequest) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const document = await prisma.document.create({
      data: {
        customerId: serviceRequest.customerId,
        serviceRequestId,
        documentType,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });

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
          note: `Document uploaded: ${documentType}`,
          changedBy: 'system',
        },
      });
    }

    res.status(201).json({ message: 'Document uploaded successfully', document });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /api/documents - Public: upload document
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { customerId, serviceRequestId, documentType } = req.body;

    if (!customerId || !documentType) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Customer ID and document type are required' });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Invalid customer' });
      return;
    }

    const document = await prisma.document.create({
      data: {
        customerId,
        serviceRequestId: serviceRequestId || null,
        documentType,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });

    // If linked to a service request, update status
    if (serviceRequestId) {
      const request = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
      if (request && request.status === 'DOCUMENTS_REQUIRED') {
        await prisma.serviceRequest.update({
          where: { id: serviceRequestId },
          data: { status: 'DOCUMENTS_RECEIVED' },
        });
        await prisma.requestStatusHistory.create({
          data: {
            serviceRequestId,
            oldStatus: 'DOCUMENTS_REQUIRED',
            newStatus: 'DOCUMENTS_RECEIVED',
            note: `Document uploaded: ${documentType}`,
            changedBy: 'system',
          },
        });
      }
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        documentType: document.documentType,
        originalName: document.originalName,
        status: document.status,
      },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /api/documents/upload-with-request - Public: upload with phone+requestId verification
router.post('/upload-with-request', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { requestId, phone, documentType } = req.body;

    if (!requestId || !phone || !documentType) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Request ID, phone, and document type are required' });
      return;
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');

    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        requestId,
        customer: { phone: cleanPhone },
      },
    });

    if (!serviceRequest) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'No request found. Check your Request ID and phone number.' });
      return;
    }

    const document = await prisma.document.create({
      data: {
        customerId: serviceRequest.customerId,
        serviceRequestId: serviceRequest.id,
        documentType,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });

    // Update request status if needed
    if (serviceRequest.status === 'DOCUMENTS_REQUIRED' || serviceRequest.status === 'NEW') {
      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: { status: 'DOCUMENTS_RECEIVED' },
      });
      await prisma.requestStatusHistory.create({
        data: {
          serviceRequestId: serviceRequest.id,
          oldStatus: serviceRequest.status,
          newStatus: 'DOCUMENTS_RECEIVED',
          note: `Document uploaded: ${documentType}`,
          changedBy: 'system',
        },
      });
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        documentType: document.documentType,
        originalName: document.originalName,
      },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/documents/:id/download - Admin: download document
router.get('/:id/download', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id as string } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const filePath = path.join(config.upload.dir, document.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on server' });
      return;
    }

    res.download(filePath, document.originalName);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
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
