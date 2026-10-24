import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { deleteDocumentFile } from '../services/storageService';

const router = Router();

// GET /api/admin/customers - list all customers
router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: {
              serviceRequests: true,
              appointments: true,
              documents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/admin/customers/:id - single customer with all related data
router.get('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id as string },
      include: {
        serviceRequests: {
          include: {
            service: { select: { name: true, category: true } },
            statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
          orderBy: { createdAt: 'desc' },
        },
        appointments: {
          include: { service: { select: { name: true } } },
          orderBy: { date: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          include: { admin: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// PUT /api/admin/customers/:id - update customer
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, address, city, state, pincode } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id as string },
      data: { name, email, phone, address, city, state, pincode },
    });
    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// POST /api/admin/customers/:id/notes - add note
router.post('/:id/notes', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, serviceRequestId } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Note content is required' });
      return;
    }

    const note = await prisma.adminNote.create({
      data: {
        adminId: req.admin!.id,
        customerId: req.params.id as string,
        serviceRequestId: serviceRequestId || null,
        content,
      },
      include: { admin: { select: { name: true } } },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// DELETE /api/customers/:id - Admin: delete a customer and all their data
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customerId = req.params.id as string;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // 1. Find all service requests for this customer
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { customerId },
      select: { id: true },
    });
    const requestIds = serviceRequests.map((sr: any) => sr.id);

    // 2. Identify every document associated with this customer:
    // both directly (customerId) and through all their service requests
    const customerDocs = await prisma.document.findMany({
      where: {
        OR: [
          { customerId },
          ...(requestIds.length > 0 ? [{ serviceRequestId: { in: requestIds } }] : []),
        ],
      },
      select: { id: true, storedName: true },
    });

    const uniqueStoredNames = Array.from(
      new Set(customerDocs.map((doc: any) => doc.storedName).filter(Boolean))
    );

    // 3. Clean up physical document files from Cloudflare R2 and/or local disk with retry
    const failedDeletions: { key: string; error?: string }[] = [];
    for (const storedName of uniqueStoredNames) {
      const result = await deleteDocumentFile(storedName);
      if (!result.success) {
        failedDeletions.push({ key: result.key, error: result.error });
      }
    }

    // If any file deletion failed, halt before database deletion to prevent orphaned files
    if (failedDeletions.length > 0) {
      console.error(
        `[CUSTOMER_DELETION_INCOMPLETE] customerId="${customerId}" failedFiles=${JSON.stringify(failedDeletions)}`
      );
      res.status(502).json({
        error:
          'Failed to delete some associated files from cloud storage. Deletion was halted and database records were preserved to prevent orphaned files. Please retry.',
        code: 'STORAGE_CLEANUP_FAILED',
        failedFiles: failedDeletions,
      });
      return;
    }

    // 4. Safely delete database records in a single atomic transaction
    await prisma.$transaction([
      prisma.requestStatusHistory.deleteMany({
        where: { serviceRequestId: { in: requestIds } },
      }),
      // Admin notes referencing customerId OR any of the customer's service requests (handles customerId = null)
      prisma.adminNote.deleteMany({
        where: {
          OR: [
            { customerId },
            ...(requestIds.length > 0 ? [{ serviceRequestId: { in: requestIds } }] : []),
          ],
        },
      }),
      prisma.document.deleteMany({
        where: {
          OR: [
            { customerId },
            ...(requestIds.length > 0 ? [{ serviceRequestId: { in: requestIds } }] : []),
          ],
        },
      }),
      prisma.appointment.deleteMany({ where: { customerId } }),
      prisma.serviceRequest.deleteMany({ where: { customerId } }),
      prisma.customer.delete({ where: { id: customerId } }),
    ]);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
