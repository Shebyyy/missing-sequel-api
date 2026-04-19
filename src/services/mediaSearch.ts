// Search AniList and MAL by title to resolve media IDs for clickable references
import { anilistGraphQL } from './anilist.js';
import { malFetch } from './mal.js';

export interface MediaRef {
  title: string;
  id: string;
  type: 'ANIME' | 'MANGA';
  cover: string | null;
  service: 'anilist' | 'mal';
}

const ANILIST_SEARCH_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type, isAdult: false) {
    id
    idMal
    type
    title { romaji english }
    coverImage { large }
  }
}
`;

export async function searchAniListMedia(
  title: string,
  type: 'ANIME' | 'MANGA',
): Promise<MediaRef | null> {
  try {
    const data = await anilistGraphQL<{
      Media: {
        id: number;
        idMal: number | null;
        type: string;
        title: { romaji: string | null; english: string | null };
        coverImage: { large: string | null };
      } | null;
    }>(ANILIST_SEARCH_QUERY, { search: title, type });

    if (!data.Media) return null;

    const media = data.Media;
    return {
      title: media.title.english || media.title.romaji || title,
      id: String(media.idMal ?? media.id),
      type: media.type as 'ANIME' | 'MANGA',
      cover: media.coverImage?.large || null,
      service: 'anilist',
    };
  } catch {
    return null;
  }
}

interface MalSearchResult {
  data?: Array<{
    node: {
      id: number;
      title: string;
      main_picture?: { medium: string; large: string };
    };
  }>;
}

export async function searchMalMedia(
  title: string,
  type: 'ANIME' | 'MANGA',
): Promise<MediaRef | null> {
  try {
    const endpoint = type === 'ANIME' ? 'anime' : 'manga';
    const data = await malFetch<MalSearchResult>(
      `/${endpoint}?q=${encodeURIComponent(title)}&limit=1&fields=main_picture`,
    );

    if (!data.data || data.data.length === 0) return null;

    const node = data.data[0].node;
    return {
      title: node.title,
      id: String(node.id),
      type,
      cover: node.main_picture?.large || node.main_picture?.medium || null,
      service: 'mal',
    };
  } catch {
    return null;
  }
}

/**
 * Search for a media title across both AniList and MAL.
 * Tries AniList first, falls back to MAL.
 * Returns null if neither service finds a match.
 */
export async function searchMediaByTitle(
  title: string,
  type: 'ANIME' | 'MANGA',
): Promise<MediaRef | null> {
  // Try AniList first (more reliable for anime/manga search)
  const alResult = await searchAniListMedia(title, type);
  if (alResult) return alResult;

  // Fallback to MAL
  return searchMalMedia(title, type);
}
