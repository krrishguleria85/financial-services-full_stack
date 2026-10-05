import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { createSlug } from '../utils/helpers';

const router = Router();

// GET /api/blog - Public: get published posts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { isPublished: true };
    if (category) where.category = category;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.blogPost.count({ where }),
    ]);

    res.json({
      posts,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/blog/:slug - Public: get single post
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: req.params.slug as string },
    });
    if (!post || !post.isPublished) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// GET /api/blog/admin/all - Admin: get all posts including unpublished
router.get('/admin/all', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/blog - Admin: create post
router.post('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, excerpt, category, isPublished } = req.body;
    if (!title || !content || !category) {
      res.status(400).json({ error: 'Title, content, and category are required' });
      return;
    }

    const slug = createSlug(title);

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 160),
        category,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        authorName: req.admin!.name,
      },
    });

    res.status(201).json(post);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A post with this title already exists' });
      return;
    }
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// PUT /api/blog/:id - Admin: update post
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, excerpt, category, isPublished } = req.body;

    const updateData: any = { title, content, excerpt, category, isPublished };
    if (title) updateData.slug = createSlug(title);
    if (isPublished) updateData.publishedAt = new Date();

    const post = await prisma.blogPost.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// DELETE /api/blog/:id - Admin: delete post
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
