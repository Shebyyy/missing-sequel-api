import type { Platform } from '../types/media.js';
import type { UnifiedMedia, MissingEntry, UpcomingEntry, UnifiedUserProfile, FranchiseEntry, UnifiedRelationType } from '../types/media.js';
import { fetchAniListUserList } from './anilist.js';
import { fetchMalFullAnimeList, fetchMalFullMangaList, fetchMalProfile } from './mal.js';
import { fetchRelationsForMediaList, enrichMediaWithBasicInfo } from './jikan.js';
import { formatAniListMedia, formatMalAnimeNode, formatMalMangaNode } from '../utils/mediaFormatter.js';
import { getHighestPriorityRelation, isAdaptationRelation } from '../utils/relationPriority.js';
import { buildFranchises } from '../utils/franchiseBuilder.js';
import { buildMappingsFromMedia } from '../utils/idMapper.js';
import { cache } from './cache.js';

interface ProcessorResult {
  user: UnifiedUserProfile;
  missing: MissingEntry[];
  upcoming: UpcomingEntry[];
  franchises: FranchiseEntry[];
  summary: {
    total_missing: number;
    by_media_type: Record<string, { missing: number; upcoming: number }>;
    by_format: Record<string, number>;
    by_relation: Record<string, number>;
    completion_rate: { overall: number; anime: number; manga: number };
    franchise_count: { total: number; fully_completed: number; partially_completed: number };
  };
  cached?: boolean;
}

export class ProcessorError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function processCheck(params: {
  platform: Platform;
  user_id: number | string;
  token?: string;
  media_type: 'ANIME' | 'MANGA' | 'ALL';
  include_upcoming: boolean;
  include_adaptations: boolean;
  sort_by: string;
}): Promise<ProcessorResult> {
  const cacheKey = `${params.platform}:${params.user_id}:${params.media_type}`;
  const cached = cache.get<ProcessorResult>('user_result', cacheKey);
  if (cached) {
    return { ...cached, cached: true } as ProcessorResult & { cached: boolean };
  }

  // Step 1: Fetch user list based on platform
  const watchedMap = new Map<number, UnifiedMedia>();

  if (params.platform === 'anilist') {
    await processAniList(params, watchedMap);
  } else {
    await processMal(params, watchedMap);
  }

  // Step 2: Find missing and upcoming
  const missing: MissingEntry[] = [];
  const upcoming: UpcomingEntry[] = [];
  const relatedMediaMap = new Map<number, {
    media: UnifiedMedia;
    fromEntries: Array<{ mediaId: number; relationType: string }>;
  }>();

  for (const [mediaId, media] of watchedMap) {
    for (const rel of media.relations) {
      const relatedId = rel.media.id;

      if (!watchedMap.has(relatedId)) {
        // Filter adaptations if not requested
        if (!params.include_adaptations && isAdaptationRelation(rel.relation_type)) {
          continue;
        }

        if (!relatedMediaMap.has(relatedId)) {
          relatedMediaMap.set(relatedId, { media: rel.media, fromEntries: [] });
        }
        relatedMediaMap.get(relatedId)!.fromEntries.push({
          mediaId,
          relationType: rel.relation_type,
        });
      }
    }
  }

  // Step 2b: For MAL, enrich related media with basic info (status) from MAL API
  if (params.platform === 'mal' && relatedMediaMap.size > 0) {
    const skeletonMap = new Map<number, UnifiedMedia>();
    for (const [relatedId, data] of relatedMediaMap) {
      skeletonMap.set(relatedId, data.media);
    }
    await enrichMediaWithBasicInfo(skeletonMap);
    for (const [relatedId, enriched] of skeletonMap) {
      relatedMediaMap.get(relatedId)!.media = enriched;
    }
  }

  for (const [relatedId, data] of relatedMediaMap) {
    const highestRelation = getHighestPriorityRelation(data.fromEntries);
    const fromMedia = watchedMap.get(data.fromEntries[0].mediaId)!;

    if (data.media.status === 'NOT_YET_RELEASED' && params.include_upcoming) {
      upcoming.push({
        watched: fromMedia,
        upcoming: data.media,
        relation_type: highestRelation,
      });
    } else if (data.media.status !== 'NOT_YET_RELEASED') {
      missing.push({
        watched: fromMedia,
        missing: data.media,
        relation_type: highestRelation,
      });
    }
  }

  // Step 3: Sort
  sortEntries(missing, upcoming, params.sort_by);

  // Step 4: Build summary
  const allMedia = Array.from(watchedMap.values());
  const franchises = buildFranchises(watchedMap);

  const firstMedia = allMedia[0];
  const user = firstMedia ? buildUserProfile(params.platform, params.user_id, allMedia) : buildEmptyUser(params.platform, params.user_id);

  const summary = buildSummary(allMedia, missing, upcoming, franchises);

  const result: ProcessorResult = { user, missing, upcoming, franchises, summary };
  cache.set('user_result', cacheKey, result);

  return result;
}

async function processAniList(
  params: { user_id: number | string; token?: string; media_type: string },
  watchedMap: Map<number, UnifiedMedia>,
): Promise<void> {
  const types: Array<'ANIME' | 'MANGA'> = [];
  if (params.media_type === 'ANIME' || params.media_type === 'ALL') types.push('ANIME');
  if (params.media_type === 'MANGA' || params.media_type === 'ALL') types.push('MANGA');

  for (const type of types) {
    try {
      const { entries } = await fetchAniListUserList(params.user_id, type, params.token);
      for (const entry of entries) {
        if (entry.listEntry.status !== 'COMPLETED') continue;
        const unified = formatAniListMedia(entry.media, entry.listEntry);
        watchedMap.set(entry.media.id, unified);
        buildMappingsFromMedia([entry.media]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('private') || msg.includes('Private')) {
        throw new ProcessorError("User's list is private. Provide a valid token.", 'LIST_PRIVATE', 403);
      }
      throw err;
    }
  }
}

async function processMal(
  params: { user_id: number | string; token?: string; media_type: string },
  watchedMap: Map<number, UnifiedMedia>,
): Promise<void> {
  // Fetch ALL entries from MAL list (same as AniList — no limits, no filtering).
  // Then use MAL's own API to get relations for every single entry (concurrent).
  const animeIdsNeedingRelations: number[] = [];
  const mangaIdsNeedingRelations: number[] = [];

  if (params.media_type === 'ANIME' || params.media_type === 'ALL') {
    console.log(`[Processor] Fetching MAL anime list for "${params.user_id}"...`);
    const animeList = await fetchMalFullAnimeList(params.user_id, params.token);
    console.log(`[Processor] Got ${animeList.length} anime entries`);

    for (const entry of animeList) {
      if (entry.list_status.status !== 'completed') continue;
      const unified = formatMalAnimeNode(entry.node, entry.list_status);
      watchedMap.set(entry.node.id, unified);
      animeIdsNeedingRelations.push(entry.node.id);
    }
  }

  if (params.media_type === 'MANGA' || params.media_type === 'ALL') {
    console.log(`[Processor] Fetching MAL manga list for "${params.user_id}"...`);
    const mangaList = await fetchMalFullMangaList(params.user_id, params.token);
    console.log(`[Processor] Got ${mangaList.length} manga entries`);

    for (const entry of mangaList) {
      if (entry.list_status.status !== 'completed') continue;
      const unified = formatMalMangaNode(entry.node, entry.list_status);
      watchedMap.set(entry.node.id, unified);
      mangaIdsNeedingRelations.push(entry.node.id);
    }
  }

  // Fetch relations from MAL API for every entry (concurrent, no limits, same as AniList)
  if (animeIdsNeedingRelations.length > 0 || mangaIdsNeedingRelations.length > 0) {
    console.log(`[Processor] Fetching MAL relations for ${animeIdsNeedingRelations.length} anime + ${mangaIdsNeedingRelations.length} manga...`);

    const relationsMap = await fetchRelationsForMediaList(
      animeIdsNeedingRelations,
      mangaIdsNeedingRelations,
      (completed, total) => {
        if (completed % 50 === 0) {
          console.log(`[Processor] MAL relations: ${completed}/${total}`);
        }
      },
    );

    // Merge MAL relations into the watchedMap entries
    let mergedCount = 0;
    for (const [mediaId, relations] of relationsMap) {
      const media = watchedMap.get(mediaId);
      if (media) {
        media.relations = relations;
        mergedCount++;
      }
    }
    console.log(`[Processor] Merged relations into ${mergedCount} entries`);
  }
}

function sortEntries(missing: MissingEntry[], upcoming: UpcomingEntry[], sortBy: string): void {
  const sortFn = (a: { missing?: UnifiedMedia; upcoming?: UnifiedMedia }, b: { missing?: UnifiedMedia; upcoming?: UnifiedMedia }) => {
    const mediaA = a.missing || a.upcoming!;
    const mediaB = b.missing || b.upcoming!;

    switch (sortBy) {
      case 'release_date':
        return (mediaA.start_date?.year || 9999) - (mediaB.start_date?.year || 9999);
      case 'popularity':
        return (mediaB.popularity || 0) - (mediaA.popularity || 0);
      case 'score':
        return (mediaB.average_score || 0) - (mediaA.average_score || 0);
      default:
        return 0;
    }
  };

  missing.sort(sortFn as (a: MissingEntry, b: MissingEntry) => number);
  upcoming.sort(sortFn as (a: UpcomingEntry, b: UpcomingEntry) => number);
}

function buildUserProfile(
  platform: Platform,
  userId: number | string,
  allMedia: UnifiedMedia[],
): UnifiedUserProfile {
  const animeEntries = allMedia.filter(m => m.type === 'ANIME');
  const mangaEntries = allMedia.filter(m => m.type === 'MANGA');

  const animeStats = {
    total: animeEntries.length,
    watching: animeEntries.filter(m => m.user_list_entry?.status === 'WATCHING').length,
    completed: animeEntries.filter(m => m.user_list_entry?.status === 'COMPLETED').length,
    on_hold: animeEntries.filter(m => m.user_list_entry?.status === 'PAUSED').length,
    dropped: animeEntries.filter(m => m.user_list_entry?.status === 'DROPPED').length,
    plan_to_watch: animeEntries.filter(m => m.user_list_entry?.status === 'PLANNING').length,
    total_episodes_watched: animeEntries.reduce((sum, m) => sum + (m.user_list_entry?.progress || 0), 0),
    mean_score: 0,
  };

  const mangaStats = {
    total: mangaEntries.length,
    reading: mangaEntries.filter(m => m.user_list_entry?.status === 'WATCHING').length,
    completed: mangaEntries.filter(m => m.user_list_entry?.status === 'COMPLETED').length,
    on_hold: mangaEntries.filter(m => m.user_list_entry?.status === 'PAUSED').length,
    dropped: mangaEntries.filter(m => m.user_list_entry?.status === 'DROPPED').length,
    plan_to_read: mangaEntries.filter(m => m.user_list_entry?.status === 'PLANNING').length,
    total_chapters_read: mangaEntries.reduce((sum, m) => sum + (m.user_list_entry?.progress || 0), 0),
    mean_score: 0,
  };

  const scoredAnime = animeEntries.filter(m => m.user_list_entry?.score);
  if (scoredAnime.length > 0) {
    animeStats.mean_score = scoredAnime.reduce((sum, m) => sum + (m.user_list_entry!.score || 0), 0) / scoredAnime.length;
  }
  const scoredManga = mangaEntries.filter(m => m.user_list_entry?.score);
  if (scoredManga.length > 0) {
    mangaStats.mean_score = scoredManga.reduce((sum, m) => sum + (m.user_list_entry!.score || 0), 0) / scoredManga.length;
  }

  const firstWithAvatar = allMedia.find(m => m.cover_image?.large);

  return {
    id: userId,
    id_mal: platform === 'mal' && typeof userId === 'number' ? userId : null,
    id_anilist: platform === 'anilist' && typeof userId === 'number' ? userId : null,
    username: typeof userId === 'string' ? userId : 'User',
    name: typeof userId === 'string' ? userId : 'User',
    platform,
    avatar: firstWithAvatar?.cover_image ? { medium: firstWithAvatar.cover_image.medium || '', large: firstWithAvatar.cover_image.large || '' } : null,
    banner: null,
    options: { title_language: null, display_adult_content: false, profile_color: null },
    stats: { anime: animeStats, manga: mangaStats },
  };
}

function buildEmptyUser(platform: Platform, userId: number | string): UnifiedUserProfile {
  return {
    id: userId,
    id_mal: platform === 'mal' && typeof userId === 'number' ? userId : null,
    id_anilist: platform === 'anilist' && typeof userId === 'number' ? userId : null,
    username: typeof userId === 'string' ? userId : 'User',
    name: typeof userId === 'string' ? userId : 'User',
    platform,
    avatar: null,
    banner: null,
    options: { title_language: null, display_adult_content: false, profile_color: null },
    stats: {
      anime: { total: 0, watching: 0, completed: 0, on_hold: 0, dropped: 0, plan_to_watch: 0, total_episodes_watched: 0, mean_score: 0 },
      manga: { total: 0, reading: 0, completed: 0, on_hold: 0, dropped: 0, plan_to_read: 0, total_chapters_read: 0, mean_score: 0 },
    },
  };
}

function buildSummary(
  allMedia: UnifiedMedia[],
  missing: MissingEntry[],
  upcoming: UpcomingEntry[],
  franchises: FranchiseEntry[],
): ProcessorResult['summary'] {
  const byMediaType: Record<string, { missing: number; upcoming: number }> = { ANIME: { missing: 0, upcoming: 0 }, MANGA: { missing: 0, upcoming: 0 } };
  const byFormat: Record<string, number> = {};
  const byRelation: Record<string, number> = {};

  for (const m of missing) {
    const type = m.missing.type || 'UNKNOWN';
    if (!byMediaType[type]) byMediaType[type] = { missing: 0, upcoming: 0 };
    byMediaType[type].missing++;

    const fmt = m.missing.format || 'UNKNOWN';
    byFormat[fmt] = (byFormat[fmt] || 0) + 1;
    byRelation[m.relation_type] = (byRelation[m.relation_type] || 0) + 1;
  }

  for (const u of upcoming) {
    const type = u.upcoming.type || 'UNKNOWN';
    if (!byMediaType[type]) byMediaType[type] = { missing: 0, upcoming: 0 };
    byMediaType[type].upcoming++;
  }

  const animeTotal = allMedia.filter(m => m.type === 'ANIME').length;
  const mangaTotal = allMedia.filter(m => m.type === 'MANGA').length;
  const animeCompleted = allMedia.filter(m => m.type === 'ANIME' && m.user_list_entry?.status === 'COMPLETED').length;
  const mangaCompleted = allMedia.filter(m => m.type === 'MANGA' && m.user_list_entry?.status === 'COMPLETED').length;

  const totalEntries = animeTotal + mangaTotal;
  const totalCompleted = animeCompleted + mangaCompleted;

  return {
    total_missing: missing.length,
    by_media_type: byMediaType,
    by_format: byFormat,
    by_relation: byRelation,
    completion_rate: {
      overall: totalEntries > 0 ? Math.round((totalCompleted / totalEntries) * 100 * 10) / 10 : 0,
      anime: animeTotal > 0 ? Math.round((animeCompleted / animeTotal) * 100 * 10) / 10 : 0,
      manga: mangaTotal > 0 ? Math.round((mangaCompleted / mangaTotal) * 100 * 10) / 10 : 0,
    },
    franchise_count: {
      total: franchises.length,
      fully_completed: franchises.filter(f => f.is_fully_completed).length,
      partially_completed: franchises.filter(f => !f.is_fully_completed).length,
    },
  };
}
