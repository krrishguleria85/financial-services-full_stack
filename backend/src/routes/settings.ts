import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/settings - Public: get public settings
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.businessSetting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Admin: update settings
router.put('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body as Record<string, string>;

    for (const [key, value] of Object.entries(updates)) {
      await prisma.businessSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.admin!.id,
        action: 'UPDATE',
        entityType: 'business_settings',
        newValue: JSON.stringify(Object.keys(updates)),
      },
    });

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
