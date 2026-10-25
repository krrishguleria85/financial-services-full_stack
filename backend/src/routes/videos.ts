import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { extractYouTubeId } from '../utils/helpers';
import { config } from '../config';

const router = Router();

export interface FeedVideoItem {
  id: string;
  videoId: string;
  title: string;
  link: string;
  thumbnail: string;
  pubDate: string;
  isShort: boolean;
}

let feedCache: { timestamp: number; channelId: string; items: FeedVideoItem[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Decode common XML entities in titles
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Fetch and parse YouTube channel videos from YouTube Data API or public XML Atom feed
 */
async function fetchYouTubeFeed(channelId: string): Promise<FeedVideoItem[]> {
  // Option A: Try YouTube Data API v3 if API key is provided
  if (config.youtube.apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=15&type=video&key=${encodeURIComponent(config.youtube.apiKey)}`;
      const apiRes = await fetch(url);
      if (apiRes.ok) {
        const data = await apiRes.json() as any;
        if (Array.isArray(data.items)) {
          const items: FeedVideoItem[] = data.items
            .filter((item: any) => item.id?.videoId && /^[a-zA-Z0-9_-]{11}$/.test(item.id.videoId))
            .map((item: any) => {
              const videoId = item.id.videoId;
              const title = item.snippet?.title || 'YouTube Video';
              const isShort = /#shorts?|#ytshorts?/i.test(title);
              const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              return {
                id: videoId,
                videoId,
                title,
                link: isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: thumb,
                pubDate: item.snippet?.publishedAt || new Date().toISOString(),
                isShort,
              };
            });
          if (items.length > 0) {
            return items;
          }
        }
      }
    } catch (apiErr) {
      console.warn('YouTube Data API fetch failed, falling back to public feed:', apiErr);
    }
  }

  // Option B: Fetch directly from YouTube's official public XML Atom feed
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const feedRes = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!feedRes.ok) {
    throw new Error(`YouTube feed returned HTTP ${feedRes.status}: ${feedRes.statusText}`);
  }

  const xml = await feedRes.text();
  const entries: FeedVideoItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m;

  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[1];
    const vidMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = block.match(/<title>([^<]+)<\/title>/);
    const pubMatch = block.match(/<published>([^<]+)<\/published>/);
    const thumbMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/);

    if (vidMatch && titleMatch) {
      const vid = vidMatch[1].trim();
      if (!/^[a-zA-Z0-9_-]{11}$/.test(vid)) continue;

      const title = decodeXmlEntities(titleMatch[1]);
      const isShort = /#shorts?|#ytshorts?/i.test(title);

      entries.push({
        id: vid,
        videoId: vid,
        title,
        link: isShort ? `https://www.youtube.com/shorts/${vid}` : `https://www.youtube.com/watch?v=${vid}`,
        thumbnail: thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        pubDate: pubMatch ? pubMatch[1].trim() : new Date().toISOString(),
        isShort,
      });
    }
  }

  return entries;
}

// GET /api/videos/feed (and /shorts) - Public: fetch live YouTube feed/shorts for the channel
router.get(['/feed', '/shorts'], async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Resolve channel ID (configured in env, database settings, or default channel)
    let channelId = config.youtube.channelId || '';

    if (!channelId) {
      try {
        const channelSetting = await prisma.businessSetting.findUnique({
          where: { key: 'youtubeChannelId' },
        });
        if (channelSetting?.value) {
          channelId = channelSetting.value.trim();
        }
      } catch (e) {
        // Continue to fallback
      }
    }

    if (!channelId) {
      channelId = 'UCKV2OmS9KmhRUzeMd4g46Dg'; // Official channel ID for @rajeshguleria1973
    }

    // 2. Return from in-memory cache if fresh
    const now = Date.now();
    if (feedCache && feedCache.channelId === channelId && now - feedCache.timestamp < CACHE_TTL_MS && feedCache.items.length > 0) {
      res.json({
        status: 'ok',
        items: feedCache.items,
        cached: true,
      });
      return;
    }

    // 3. Fetch from live YouTube source
    try {
      const items = await fetchYouTubeFeed(channelId);
      if (items.length > 0) {
        feedCache = {
          timestamp: now,
          channelId,
          items,
        };
        res.json({
          status: 'ok',
          items,
          cached: false,
        });
        return;
      }
    } catch (feedError) {
      console.warn('Live YouTube feed fetch error:', feedError);
    }

    // 4. Fallback: If cache exists (even if stale), return it
    if (feedCache && feedCache.items.length > 0) {
      res.json({
        status: 'ok',
        items: feedCache.items,
        stale: true,
      });
      return;
    }

    // 5. Secondary Fallback: Use published database videos
    const dbVideos = await prisma.youTubeVideo.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const fallbackItems: FeedVideoItem[] = dbVideos.map(v => {
      const vid = v.videoId || extractYouTubeId(v.videoUrl) || v.id;
      return {
        id: v.id,
        videoId: vid,
        title: v.title,
        link: v.videoUrl,
        thumbnail: v.thumbnailUrl || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        pubDate: v.publishedAt?.toISOString() || v.createdAt.toISOString(),
        isShort: /#shorts?|#ytshorts?/i.test(v.title) || v.videoUrl.includes('/shorts/'),
      };
    });

    res.json({
      status: 'ok',
      items: fallbackItems,
      fallback: true,
    });
  } catch (error) {
    console.error('Get videos feed error:', error);
    res.status(500).json({ status: 'error', error: 'Failed to fetch YouTube feed', items: [] });
  }
});

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
