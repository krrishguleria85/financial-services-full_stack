import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { extractYouTubeId } from '../utils/helpers';

const router = Router();

// GET /api/videos - Public: get published videos
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const videos = await prisma.youTubeVideo.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// POST /api/videos - Admin: add video
router.post('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, videoUrl, thumbnailUrl, sortOrder } = req.body;
    if (!title || !videoUrl) {
      res.status(400).json({ error: 'Title and video URL are required' });
      return;
    }

    const videoId = extractYouTubeId(videoUrl);

    const video = await prisma.youTubeVideo.create({
      data: {
        title,
        description,
        videoUrl,
        videoId,
        thumbnailUrl: thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null),
        sortOrder: sortOrder || 0,
        publishedAt: new Date(),
      },
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Add video error:', error);
    res.status(500).json({ error: 'Failed to add video' });
  }
});

// PUT /api/videos/:id - Admin: update video
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, videoUrl, thumbnailUrl, isPublished, sortOrder } = req.body;
    const videoId = videoUrl ? extractYouTubeId(videoUrl) : undefined;

    const video = await prisma.youTubeVideo.update({
      where: { id: req.params.id as string },
      data: {
        title,
        description,
        videoUrl,
        videoId: videoId !== undefined ? videoId : undefined,
        thumbnailUrl,
        isPublished,
        sortOrder,
      },
    });

    res.json(video);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// DELETE /api/videos/:id - Admin: delete video
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.youTubeVideo.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Video deleted' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
