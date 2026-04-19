import type {
  MalAnimeListEntry,
  MalMangaListEntry,
  MalAnimeNode,
  MalMangaNode,
  MalPaginatedResponse,
  MalUserProfile,
  MalMediaStatus,
} from '../types/mal.js';

const MAL_URL = 'https://api.myanimelist.net/v2';

export class MalError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function malFetch<T>(
  path: string,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const clientId = process.env.MAL_CLIENT_ID;
    if (clientId) {
      headers['X-MAL-Client-ID'] = clientId;
    }
  }

  const url = path.startsWith('http') ? path : `${MAL_URL}${path}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 401) {
      throw new MalError('MAL token is invalid or expired', 'INVALID_TOKEN', 401);
    }
    if (res.status === 404) {
      throw new MalError('MAL resource not found', 'NOT_FOUND', 404);
    }
    const text = await res.text();
    throw new MalError(`MAL API error: ${res.status} — ${text}`, 'MAL_ERROR', res.status);
  }

  return res.json() as Promise<T>;
}

const ANIME_LIST_FIELDS = 'list_status,status,score,num_episodes_watched,is_rewatching,num_times_rewatched,priority,start_date,finish_date,comments,main_picture{medium,large},title,alternative_titles{synonyms},start_date,end_date,synopsis,genres,mean,rank,popularity,num_list_users,num_scoring_users,nsfw,media_type,status,num_episodes,start_season,broadcast{day_of_the_week,start_time},source,average_episode_duration,studios,pictures';

const MANGA_LIST_FIELDS = 'list_status,status,score,num_chapters_read,num_volumes_read,is_rereading,num_times_reread,priority,start_date,finish_date,comments,main_picture{medium,large},title,alternative_titles{synonyms},start_date,end_date,synopsis,genres,mean,rank,popularity,num_list_users,num_scoring_users,nsfw,media_type,status,num_chapters,num_volumes,authors{first_name,last_name},pictures';

export async function fetchMalFullAnimeList(
  userId: number | string,
  token?: string,
): Promise<MalAnimeListEntry[]> {
  const allEntries: MalAnimeListEntry[] = [];
  let offset = 0;
  const limit = 100;
  let hasNext = true;

  while (hasNext) {
    const url = `/users/${userId}/animelist?fields=${ANIME_LIST_FIELDS}&limit=${limit}&offset=${offset}&sort=list_updated_at`;
    const data = await malFetch<MalPaginatedResponse<MalAnimeListEntry>>(url, token);

    allEntries.push(...data.data);
    hasNext = !!data.paging?.next;
    offset += limit;
  }

  return allEntries;
}

export async function fetchMalFullMangaList(
  userId: number | string,
  token?: string,
): Promise<MalMangaListEntry[]> {
  const allEntries: MalMangaListEntry[] = [];
  let offset = 0;
  const limit = 100;
  let hasNext = true;

  while (hasNext) {
    const url = `/users/${userId}/mangalist?fields=${MANGA_LIST_FIELDS}&limit=${limit}&offset=${offset}&sort=list_updated_at`;
    const data = await malFetch<MalPaginatedResponse<MalMangaListEntry>>(url, token);

    allEntries.push(...data.data);
    hasNext = !!data.paging?.next;
    offset += limit;
  }

  return allEntries;
}

export async function fetchMalAnimeDetails(
  animeId: number,
  token?: string,
): Promise<MalAnimeNode> {
  const fields = 'title,alternative_titles{synonyms},main_picture{medium,large},start_date,end_date,synopsis,genres,mean,rank,popularity,num_list_users,nsfw,media_type,status,num_episodes,start_season,broadcast{day_of_the_week,start_time},source,average_episode_duration,studios,pictures,related_anime,related_manga';
  const data = await malFetch<{ data: MalAnimeNode }>(`/anime/${animeId}?fields=${fields}`, token);
  return data.data;
}

export async function fetchMalMangaDetails(
  mangaId: number,
  token?: string,
): Promise<MalMangaNode> {
  const fields = 'title,alternative_titles{synonyms},main_picture{medium,large},start_date,end_date,synopsis,genres,mean,rank,popularity,num_list_users,nsfw,media_type,status,num_chapters,num_volumes,authors{first_name,last_name},pictures,related_anime,related_manga';
  const data = await malFetch<{ data: MalMangaNode }>(`/manga/${mangaId}?fields=${fields}`, token);
  return data.data;
}

export async function fetchMalProfile(token: string): Promise<MalUserProfile> {
  const fields = 'anime_statistics{num_items_watching,num_items_completed,num_items_on_hold,num_items_dropped,num_items_plan_to_watch,num_episodes_watched,mean_score},manga_statistics{num_items_reading,num_items_completed,num_items_on_hold,num_items_dropped,num_items_plan_to_read,num_chapters_read,num_volumes_read,mean_score},picture';
  return malFetch<MalUserProfile>('/users/@me', token);
}

export async function verifyMalToken(token: string): Promise<{ id: number; name: string }> {
  const fields = 'name';
  const profile = await malFetch<MalUserProfile>(`/users/@me?fields=${fields}`, token);
  return { id: profile.id, name: profile.name };
}

export function malStatusToUnified(status: string): string {
  switch (status) {
    case 'finished': return 'FINISHED';
    case 'currently_airing':
    case 'currently_publishing': return 'RELEASING';
    case 'not_yet_aired':
    case 'not_yet_published': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

export function malAnimeListStatusToUnified(status: string): string {
  switch (status) {
    case 'watching': return 'WATCHING';
    case 'completed': return 'COMPLETED';
    case 'on_hold': return 'PAUSED';
    case 'dropped': return 'DROPPED';
    case 'plan_to_watch': return 'PLANNING';
    default: return status;
  }
}

export function malMangaListStatusToUnified(status: string): string {
  switch (status) {
    case 'reading': return 'WATCHING';
    case 'completed': return 'COMPLETED';
    case 'on_hold': return 'PAUSED';
    case 'dropped': return 'DROPPED';
    case 'plan_to_read': return 'PLANNING';
    default: return status;
  }
}

export function malFormatToUnified(format: string): string {
  return format.toUpperCase() as string;
}
