import { Hono } from 'hono';
import { fetchAniListMedia, AniListError } from '../services/anilist.js';
import { formatAniListMedia } from '../utils/mediaFormatter.js';
import { validateRequest, franchiseRequestSchema } from '../middleware/validator.js';

const franchise = new Hono();

franchise.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(franchiseRequestSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  const { platform, media_id, compact } = validation.data;

  try {
    const media = await fetchAniListMedia(media_id);
    const unified = formatAniListMedia(media);

    // Collect all related media into a franchise view
    const allEntries = [unified];
    const visited = new Set<number>([media_id]);

    function collectRelated(entry: typeof unified): void {
      for (const rel of entry.relations) {
        if (!visited.has(rel.media.id)) {
          visited.add(rel.media.id);
          allEntries.push(rel.media);
          collectRelated(rel.media);
        }
      }
    }

    collectRelated(unified);

    // Sort by date
    allEntries.sort((a, b) => {
      const aYear = a.start_date?.year || 9999;
      const bYear = b.start_date?.year || 9999;
      return aYear - bYear;
    });

    return c.json({
      success: true,
      franchise: {
        id: `franchise_${media_id}`,
        name: unified.title.preferred,
        entries: compact ? allEntries.map(e => ({
          id: e.id,
          id_mal: e.id_mal,
          id_anilist: e.id_anilist,
          title: e.title,
          type: e.type,
          format: e.format,
          status: e.status,
          episodes: e.episodes,
          chapters: e.chapters,
          average_score: e.average_score,
          cover_image: e.cover_image?.medium || e.cover_image?.large || null,
          start_date: e.start_date,
        })) : allEntries,
        total_entries: allEntries.length,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AniListError) {
      return c.json({
        success: false,
        error: err.code,
        message: err.message,
        code: err.status,
      }, err.status as 400);
    }

    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      code: 500,
    }, 500);
  }
});

export default franchise;
