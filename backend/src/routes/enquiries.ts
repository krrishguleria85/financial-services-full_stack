import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/enquiries - Public: submit contact enquiry
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, email, service, message } = req.body;

    if (!name || !phone || !message) {
      res.status(400).json({ error: 'Name, phone, and message are required' });
      return;
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      return;
    }

    const enquiry = await prisma.contactEnquiry.create({
      data: { name, phone: cleanPhone, email, service, message },
    });

    await prisma.notification.create({
      data: {
        type: 'admin',
        title: 'New Enquiry',
        message: `New enquiry from ${name} regarding ${service || 'general'}`,
        link: '/admin/enquiries',
      },
    });

    res.status(201).json({
      message: 'Your enquiry has been submitted. We will get back to you soon.',
      id: enquiry.id,
    });
  } catch (error) {
    console.error('Create enquiry error:', error);
    res.status(500).json({ error: 'Failed to submit enquiry. Please try again.' });
  }
});

// GET /api/enquiries - Admin: list enquiries
router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isRead, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const [enquiries, total] = await Promise.all([
      prisma.contactEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.contactEnquiry.count({ where }),
    ]);

    res.json({
      enquiries,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get enquiries error:', error);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

// PATCH /api/enquiries/:id - Admin: mark as read/resolved
router.patch('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isRead, isResolved } = req.body;
    const data: any = {};
    if (isRead !== undefined) data.isRead = isRead;
    if (isResolved !== undefined) data.isResolved = isResolved;

    const enquiry = await prisma.contactEnquiry.update({
      where: { id: req.params.id as string },
      data,
    });

    res.json(enquiry);
  } catch (error) {
    console.error('Update enquiry error:', error);
    res.status(500).json({ error: 'Failed to update enquiry' });
  }
});

// DELETE /api/enquiries/:id - Admin: delete enquiry
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.contactEnquiry.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Enquiry deleted' });
  } catch (error) {
    console.error('Delete enquiry error:', error);
    res.status(500).json({ error: 'Failed to delete enquiry' });
  }
});

export default router;
