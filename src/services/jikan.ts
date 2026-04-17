import type { UnifiedMediaType, UnifiedRelationType, UnifiedMedia, UnifiedMediaStatus } from '../types/media.js';

const MAL_URL = 'https://api.myanimelist.net/v2';

// ─── In-memory cache (2 hours) ────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

// ─── MAL API relation types (from /v2/anime/{id} response) ───────────
interface MalRelatedNode {
  id: number;
  title: string;
  main_picture?: { medium: string; large: string };
}

interface MalRelatedEntry {
  node: MalRelatedNode;
  relation_type: string;
  relation_type_formatted: string;
}

interface MalDetailResponse {
  id: number;
  related_anime?: MalRelatedEntry[];
  related_manga?: MalRelatedEntry[];
  status?: string;
  num_episodes?: number;
  num_chapters?: number;
  start_date?: string | null;
  end_date?: string | null;
  mean?: number | null;
  media_type?: string;
  genres?: { id: number; name: string }[];
  picture?: { medium: string; large: string };
  main_picture?: { medium: string; large: string };
}

// ─── Concurrent pool for MAL API requests ─────────────────────────────
// MAL has no documented rate limit for Client-ID auth.
// Tested: 1000 concurrent → zero 429s. Sweet spot: 50 (~30 items/s, 0 errors).
const CONCURRENCY = 50;
const FETCH_TIMEOUT = 15000;

async function malFetchDetail(
  type: 'anime' | 'manga',
  id: number,
  retries = 2,
): Promise<MalDetailResponse | null> {
  const cacheKey = `mal:detail:${type}:${id}`;
  const cached = getCached<MalDetailResponse>(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const clientId = process.env.MAL_CLIENT_ID;
  if (clientId) headers['X-MAL-Client-ID'] = clientId;

  const fields = 'related_anime,related_manga,status,num_episodes,num_chapters,start_date,end_date,mean,media_type,genres,main_picture';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const res = await fetch(`${MAL_URL}/${type}/${id}?fields=${fields}`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        // MAL rate limit hit (extremely rare with Client-ID) — back off
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return null;
      }

      if (!res.ok) return null; // 404, etc. — no retry

      const data = await res.json() as MalDetailResponse;
      setCache(cacheKey, data);
      return data;
    } catch {
      // Connection reset / timeout — retry with backoff
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── Process items in a concurrent pool ───────────────────────────────
async function processConcurrently<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      await handler(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
}

// ─── Mappers ──────────────────────────────────────────────────────────
function malRelationToUnified(relationType: string): UnifiedRelationType {
  const map: Record<string, UnifiedRelationType> = {
    sequel: 'SEQUEL',
    prequel: 'PREQUEL',
    side_story: 'SIDE_STORY',
    alternative_version: 'ALTERNATIVE_VERSION',
    alternative_setting: 'ALTERNATIVE_SETTING',
    spin_off: 'SPIN_OFF',
    adaptation: 'ADAPTATION',
    character: 'CHARACTER',
    summary: 'SUMMARY',
    full_story: 'FULL_STORY',
    parent_story: 'PARENT',
    other: 'OTHER',
  };
  return map[relationType.toLowerCase()] || 'OTHER';
}

function malStatusToUnified(status?: string | null): UnifiedMediaStatus | null {
  if (!status) return null;
  const map: Record<string, UnifiedMediaStatus> = {
    finished_airing: 'FINISHED',
    finished_publishing: 'FINISHED',
    currently_airing: 'RELEASING',
    currently_publishing: 'RELEASING',
    not_yet_aired: 'NOT_YET_RELEASED',
    not_yet_published: 'NOT_YET_RELEASED',
  };
  return map[status] || 'FINISHED';
}

function createSkeletonFromMalRelation(
  entry: MalRelatedEntry,
  mediaType: UnifiedMediaType,
): UnifiedMedia {
  return {
    id: entry.node.id,
    id_mal: entry.node.id,
    id_anilist: null,
    title: { romaji: null, english: entry.node.title, native: null, preferred: entry.node.title },
    type: mediaType,
    format: null,
    source: null,
    status: null,
    description: null,
    episodes: null,
    duration: null,
    chapters: null,
    volumes: null,
    season: null,
    season_year: null,
    start_date: null,
    end_date: null,
    next_episode: null,
    genres: [],
    tags: [],
    studios: [],
    producers: [],
    authors: [],
    serializations: [],
    average_score: null,
    mean_score: null,
    bayesian_score: null,
    popularity: null,
    favourites: null,
    trending: null,
    genres_rank: [],
    cover_image: {
      extra_large: null,
      large: entry.node.main_picture?.large || null,
      medium: entry.node.main_picture?.medium || null,
      color: null,
    },
    banner_image: null,
    trailer: null,
    site_urls: entry.node.id ? [`https://myanimelist.net/${mediaType === 'ANIME' ? 'anime' : 'manga'}/${entry.node.id}`] : [],
    synonyms: [],
    country_of_origin: null,
    isLicensed: null,
    is_adult: null,
    external_links: [],
    relations: [],
    user_list_entry: null,
  };
}

function parseMalDate(dateStr?: string | null): { year: number | null; month: number | null; day: number | null } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  return {
    year: parts[0] ? parseInt(parts[0]) : null,
    month: parts[1] ? parseInt(parts[1]) : null,
    day: parts[2] ? parseInt(parts[2]) : null,
  };
}

// ─── Main export: fetch relations for ALL entries (concurrent via pool) ──
export async function fetchRelationsForMediaList(
  animeIds: number[],
  mangaIds: number[],
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<number, { relation_type: UnifiedRelationType; media: UnifiedMedia }[]>> {
  const relationsMap = new Map<number, { relation_type: UnifiedRelationType; media: UnifiedMedia }[]>();

  const total = animeIds.length + mangaIds.length;
  let completed = 0;
  let failedCount = 0;
  const startTime = Date.now();

  console.log(`[MAL Relations] Fetching relations for ${animeIds.length} anime + ${mangaIds.length} manga from MAL API (concurrency: ${CONCURRENCY})...`);

  // Build combined work items: {type, id}
  const workItems: Array<{ type: 'anime' | 'manga'; id: number }> = [
    ...animeIds.map(id => ({ type: 'anime' as const, id })),
    ...mangaIds.map(id => ({ type: 'manga' as const, id })),
  ];

  await processConcurrently(workItems, CONCURRENCY, async (item) => {
    const detail = await malFetchDetail(item.type, item.id);

    if (detail) {
      // Extract relations
      const relations: { relation_type: UnifiedRelationType; media: UnifiedMedia }[] = [];

      for (const rel of detail.related_anime || []) {
        relations.push({
          relation_type: malRelationToUnified(rel.relation_type),
          media: createSkeletonFromMalRelation(rel, 'ANIME'),
        });
      }

      for (const rel of detail.related_manga || []) {
        relations.push({
          relation_type: malRelationToUnified(rel.relation_type),
          media: createSkeletonFromMalRelation(rel, 'MANGA'),
        });
      }

      if (relations.length > 0) {
        relationsMap.set(item.id, relations);
      }
    } else {
      failedCount++;
    }

    completed++;
    if (onProgress) onProgress(completed, total);
    if (completed % 100 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = completed / elapsed;
      const remaining = Math.round((total - completed) / rate);
      console.log(`[MAL Relations] Progress: ${completed}/${total} (${relationsMap.size} with relations, ${failedCount} failed) | ${elapsed}s elapsed, ~${remaining}s remaining (${rate.toFixed(1)} items/s)`);
    }
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[MAL Relations] Done. Relations for ${relationsMap.size}/${total} items (${failedCount} failed, ${elapsed}s total)`);

  return relationsMap;
}

// ─── Enrichment: fetch status/episodes info for related media skeletons ──
// This is called for the MISSING entries (related anime/manga not in user's list).
// We fetch their details from MAL to determine status (upcoming vs released).
export async function enrichMediaWithBasicInfo(
  mediaMap: Map<number, UnifiedMedia>,
): Promise<void> {
  const idsToEnrich = Array.from(mediaMap.keys()).filter(id => {
    const media = mediaMap.get(id)!;
    return media.status === null; // Only fetch for items missing status
  });

  if (idsToEnrich.length === 0) {
    console.log(`[MAL Relations] No related media need enrichment`);
    return;
  }

  console.log(`[MAL Relations] Enriching ${idsToEnrich.length} related media with status info...`);

  const startTime = Date.now();

  // Determine media type from id_mal — we need to guess or fetch both
  // Since we stored the type in the skeleton, use it
  const animeIds = idsToEnrich.filter(id => mediaMap.get(id)!.type === 'ANIME');
  const mangaIds = idsToEnrich.filter(id => mediaMap.get(id)!.type === 'MANGA');

  let enriched = 0;

  // Fetch anime details concurrently
  if (animeIds.length > 0) {
    await processConcurrently(animeIds, CONCURRENCY, async (id) => {
      const detail = await malFetchDetail('anime', id);
      const media = mediaMap.get(id);
      if (detail && media) {
        applyDetailToMedia(detail, media);
        enriched++;
      }
    });
  }

  // Fetch manga details concurrently
  if (mangaIds.length > 0) {
    await processConcurrently(mangaIds, CONCURRENCY, async (id) => {
      const detail = await malFetchDetail('manga', id);
      const media = mediaMap.get(id);
      if (detail && media) {
        applyDetailToMedia(detail, media);
        enriched++;
      }
    });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[MAL Relations] Enriched ${enriched}/${idsToEnrich.length} related media (${elapsed}s)`);
}

function applyDetailToMedia(detail: MalDetailResponse, media: UnifiedMedia): void {
  if (!media.status && detail.status) {
    media.status = malStatusToUnified(detail.status);
  }
  if (media.episodes === null && detail.num_episodes !== undefined) {
    media.episodes = detail.num_episodes || null;
  }
  if (media.chapters === null && detail.num_chapters !== undefined) {
    media.chapters = detail.num_chapters || null;
  }
  if (!media.start_date && detail.start_date) {
    media.start_date = parseMalDate(detail.start_date);
  }
  if (!media.end_date && detail.end_date) {
    media.end_date = parseMalDate(detail.end_date);
  }
  if (media.mean_score === null && detail.mean !== undefined && detail.mean !== null) {
    media.mean_score = detail.mean;
    media.average_score = Math.round(detail.mean * 10);
  }
  if (!media.format && detail.media_type) {
    media.format = detail.media_type.toUpperCase() as UnifiedMedia['format'];
  }
  if (detail.genres && detail.genres.length > 0 && media.genres.length === 0) {
    media.genres = detail.genres.map(g => g.name);
  }
}
