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
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ error: 'Invalid settings payload: expected key-value object' });
      return;
    }

    // Social URL keys requiring URL validation if present and non-empty
    const socialUrlKeys: Record<string, string> = {
      youtubeChannelUrl: 'YouTube Channel',
      instagramUrl: 'Instagram',
      facebookUrl: 'Facebook',
      snapchatUrl: 'Snapchat',
      mojUrl: 'Moj',
    };

    for (const [key, label] of Object.entries(socialUrlKeys)) {
      if (key in updates) {
        const rawVal = updates[key];
        if (typeof rawVal !== 'string') {
          res.status(400).json({ error: `${label} URL must be a string` });
          return;
        }
        const val = rawVal.trim();
        if (val.length > 0) {
          try {
            const parsed = new URL(val);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              res.status(400).json({ error: `Invalid URL protocol for ${label}. Must begin with http:// or https://` });
              return;
            }
          } catch {
            res.status(400).json({ error: `Invalid URL format for ${label}. Please provide a valid web URL.` });
            return;
          }
        }
      }
    }

    for (const [key, value] of Object.entries(updates)) {
      if (typeof key !== 'string' || !key.trim()) continue;
      const cleanValue = typeof value === 'string' ? value.trim() : String(value ?? '');
      await prisma.businessSetting.upsert({
        where: { key: key.trim() },
        update: { value: cleanValue },
        create: { key: key.trim(), value: cleanValue },
      });
    }

    if (req.admin?.id) {
      await prisma.auditLog.create({
        data: {
          adminId: req.admin.id,
          action: 'UPDATE',
          entityType: 'business_settings',
          newValue: JSON.stringify(Object.keys(updates)),
        },
      });
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
