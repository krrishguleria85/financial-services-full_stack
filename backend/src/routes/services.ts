import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/services - Public: get all active services
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/:slug - Public: get single service by slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const service = await prisma.service.findUnique({
      where: { slug: req.params.slug as string },
    });
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// POST /api/services - Admin: create service
router.post('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, category, description, longDescription, icon, sortOrder } = req.body;
    if (!name || !slug || !category || !description) {
      res.status(400).json({ error: 'Name, slug, category, and description are required' });
      return;
    }

    const service = await prisma.service.create({
      data: { name, slug, category, description, longDescription, icon, sortOrder: sortOrder || 0 },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.id,
        action: 'CREATE',
        entityType: 'service',
        entityId: service.id,
        newValue: JSON.stringify({ name, category }),
      },
    });

    res.status(201).json(service);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A service with this slug already exists' });
      return;
    }
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/services/:id - Admin: update service
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, category, description, longDescription, icon, isActive, sortOrder } = req.body;
    
    const existing = await prisma.service.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    const service = await prisma.service.update({
      where: { id: req.params.id as string },
      data: { name, slug, category, description, longDescription, icon, isActive, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.id,
        action: 'UPDATE',
        entityType: 'service',
        entityId: service.id,
        oldValue: JSON.stringify({ name: existing.name, isActive: existing.isActive }),
        newValue: JSON.stringify({ name, isActive }),
      },
    });

    res.json(service);
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id - Admin: delete service
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.service.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });
    res.json({ message: 'Service deactivated successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
