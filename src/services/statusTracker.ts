import type { Platform, UnifiedListStatus, StatusCheckItem } from '../types/media.js';
import { fetchAniListUserList } from './anilist.js';
import { fetchMalFullAnimeList, fetchMalFullMangaList } from './mal.js';
import { formatAniListMedia, formatMalAnimeNode, formatMalMangaNode } from '../utils/mediaFormatter.js';
import { cache } from './cache.js';

const TRACKABLE_STATUSES: UnifiedListStatus[] = ['PLANNING', 'WATCHING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'];

export async function checkUserMediaStatus(params: {
  platform: Platform;
  user_id: number | string;
  token: string;
  media_type: 'ANIME' | 'MANGA' | 'ALL';
}): Promise<{ summary: { total_in_list: number; finished_not_completed: number }; results: StatusCheckItem[] }> {
  const cacheKey = `${params.platform}:status:${params.user_id}:${params.media_type}`;
  const cached = cache.get<{ summary: { total_in_list: number; finished_not_completed: number }; results: StatusCheckItem[] }>('status_check', cacheKey);
  if (cached) return cached;

  const results: StatusCheckItem[] = [];
  const allEntries: Array<{ mediaStatus: string; userStatus: string; media: any; listEntry: any }> = [];

  if (params.platform === 'anilist') {
    await collectAniListEntries(params, allEntries);
  } else {
    await collectMalEntries(params, allEntries);
  }

  for (const entry of allEntries) {
    // Only check entries in trackable statuses (not COMPLETED or DROPPED)
    if (entry.userStatus === 'COMPLETED' || entry.userStatus === 'DROPPED') continue;

    // THE RULE: media finished AND user not completed
    if (entry.mediaStatus === 'FINISHED') {
      const unifiedMedia = entry.media;
      const unifiedList = entry.listEntry;
      const totalItems = unifiedMedia.episodes || unifiedMedia.chapters || 0;
      const progress = unifiedList.progress || 0;
      const remaining = Math.max(0, totalItems - progress);

      results.push({
        media: unifiedMedia,
        user_list_status: unifiedList,
        user_status: normalizeUserStatus(entry.userStatus),
        total_items: totalItems,
        progress,
        remaining,
      });
    }
  }

  const summary = {
    total_in_list: allEntries.length,
    finished_not_completed: results.length,
  };

  const result = { summary, results };
  cache.set('status_check', cacheKey, result);
  return result;
}

async function collectAniListEntries(
  params: { user_id: number; token: string; media_type: string },
  allEntries: Array<{ mediaStatus: string; userStatus: string; media: any; listEntry: any }>,
): Promise<void> {
  const types: Array<'ANIME' | 'MANGA'> = [];
  if (params.media_type === 'ANIME' || params.media_type === 'ALL') types.push('ANIME');
  if (params.media_type === 'MANGA' || params.media_type === 'ALL') types.push('MANGA');

  for (const type of types) {
    const { entries } = await fetchAniListUserList(params.user_id, type, params.token);
    for (const entry of entries) {
      allEntries.push({
        mediaStatus: entry.media.status,
        userStatus: entry.listEntry.status,
        media: formatAniListMedia(entry.media, entry.listEntry),
        listEntry: entry.listEntry,
      });
    }
  }
}

async function collectMalEntries(
  params: { user_id: number | string; token: string; media_type: string },
  allEntries: Array<{ mediaStatus: string; userStatus: string; media: any; listEntry: any }>,
): Promise<void> {
  if (params.media_type === 'ANIME' || params.media_type === 'ALL') {
    const animeList = await fetchMalFullAnimeList(params.user_id, params.token);
    for (const entry of animeList) {
      allEntries.push({
        mediaStatus: entry.node.status,
        userStatus: entry.list_status.status,
        media: formatMalAnimeNode(entry.node, entry.list_status),
        listEntry: entry.list_status,
      });
    }
  }

  if (params.media_type === 'MANGA' || params.media_type === 'ALL') {
    const mangaList = await fetchMalFullMangaList(params.user_id, params.token);
    for (const entry of mangaList) {
      allEntries.push({
        mediaStatus: entry.node.status,
        userStatus: entry.list_status.status,
        media: formatMalMangaNode(entry.node, entry.list_status),
        listEntry: entry.list_status,
      });
    }
  }
}

function normalizeUserStatus(status: string): UnifiedListStatus {
  switch (status) {
    case 'PLANNING':
    case 'PLAN_TO_WATCH':
    case 'PLAN_TO_READ':
    case 'plan_to_watch':
    case 'plan_to_read':
      return 'PLANNING';
    case 'WATCHING':
    case 'CURRENT':
    case 'READING':
    case 'watching':
    case 'reading':
      return 'WATCHING';
    case 'PAUSED':
    case 'ON_HOLD':
    case 'on_hold':
      return 'PAUSED';
    case 'COMPLETED':
    case 'completed':
      return 'COMPLETED';
    case 'DROPPED':
    case 'dropped':
      return 'DROPPED';
    case 'REPEATING':
      return 'REPEATING';
    default:
      return status as UnifiedListStatus;
  }
}
