// Fetches user's anime/manga list and compacts it for AI context
import { fetchAniListUserList } from './anilist.js';
import type { AniListListStatus } from '../types/anilist.js';
import { fetchMalFullAnimeList, fetchMalFullMangaList, verifyMalToken } from './mal.js';
import type { MalAnimeListStatus, MalMangaListStatus } from '../types/mal.js';
import { verifyAniListToken } from './anilist.js';

export interface UserListSummary {
  username: string;
  platform: string;
  totalAnime: number;
  totalManga: number;
  animeList: CompactEntry[];
  mangaList: CompactEntry[];
  stats: {
    meanAnimeScore: number | null;
    meanMangaScore: number | null;
    mostWatchedGenres: string[];
    mostReadGenres: string[];
  };
}

export interface CompactEntry {
  id: number;
  title: string;
  score: number | null;
  status: string;
  episodesWatched?: number;
  totalEpisodes?: number | null;
  chaptersRead?: number;
  totalChapters?: number | null;
  genres: string[];
  type: string;
  year?: number | null;
  format?: string;
}

// --- AniList ---

function alStatusToStr(s: AniListListStatus): string {
  switch (s) {
    case 'CURRENT': return 'WATCHING';
    case 'PLANNING': return 'PLANNING';
    case 'COMPLETED': return 'COMPLETED';
    case 'DROPPED': return 'DROPPED';
    case 'PAUSED': return 'PAUSED';
    case 'REPEATING': return 'REWATCHING';
    default: return s;
  }
}

async function summarizeAniListList(
  userId: number,
  token: string,
): Promise<{ username: string; animeList: CompactEntry[]; mangaList: CompactEntry[] }> {
  const [animeData, mangaData] = await Promise.all([
    fetchAniListUserList(userId, 'ANIME', token),
    fetchAniListUserList(userId, 'MANGA', token),
  ]);

  const username = animeData.user.name;

  const animeList: CompactEntry[] = animeData.entries.map(e => ({
    id: e.media.id,
    title: e.media.title.english || e.media.title.romaji || e.media.title.native || 'Unknown',
    score: e.listEntry.score,
    status: alStatusToStr(e.listEntry.status),
    episodesWatched: e.listEntry.progress,
    totalEpisodes: e.media.episodes,
    genres: e.media.genres || [],
    type: e.media.type || 'ANIME',
    year: e.media.seasonYear,
    format: e.media.format || '',
  }));

  const mangaList: CompactEntry[] = mangaData.entries.map(e => ({
    id: e.media.id,
    title: e.media.title.english || e.media.title.romaji || e.media.title.native || 'Unknown',
    score: e.listEntry.score,
    status: alStatusToStr(e.listEntry.status),
    chaptersRead: e.listEntry.progress,
    totalChapters: e.media.chapters,
    genres: e.media.genres || [],
    type: e.media.type || 'MANGA',
    year: e.media.seasonYear,
    format: e.media.format || '',
  }));

  return { username, animeList, mangaList };
}

// --- MAL ---

function malAnimeStatusMap(status: MalAnimeListStatus): string {
  switch (status) {
    case 'watching': return 'WATCHING';
    case 'completed': return 'COMPLETED';
    case 'on_hold': return 'PAUSED';
    case 'dropped': return 'DROPPED';
    case 'plan_to_watch': return 'PLANNING';
    default: return status;
  }
}

function malMangaStatusMap(status: MalMangaListStatus): string {
  switch (status) {
    case 'reading': return 'WATCHING';
    case 'completed': return 'COMPLETED';
    case 'on_hold': return 'PAUSED';
    case 'dropped': return 'DROPPED';
    case 'plan_to_read': return 'PLANNING';
    default: return status;
  }
}

async function summarizeMalList(
  username: string,
  token: string,
): Promise<{ username: string; animeList: CompactEntry[]; mangaList: CompactEntry[] }> {
  const [animeEntries, mangaEntries] = await Promise.all([
    fetchMalFullAnimeList(username, token),
    fetchMalFullMangaList(username, token),
  ]);

  const animeList: CompactEntry[] = animeEntries.map(e => ({
    id: e.node.id,
    title: e.node.title,
    score: e.list_status.score || null,
    status: malAnimeStatusMap(e.list_status.status),
    episodesWatched: e.list_status.numEpisodesWatched,
    totalEpisodes: e.node.numEpisodes,
    genres: e.node.genres,
    type: 'ANIME',
    year: e.node.startSeason?.year,
    format: e.node.mediaType || '',
  }));

  const mangaList: CompactEntry[] = mangaEntries.map(e => ({
    id: e.node.id,
    title: e.node.title,
    score: e.list_status.score || null,
    status: malMangaStatusMap(e.list_status.status),
    chaptersRead: e.list_status.numChaptersRead,
    totalChapters: e.node.numChapters,
    genres: e.node.genres,
    type: 'MANGA',
    year: null,
    format: e.node.mediaType || '',
  }));

  return { username, animeList, mangaList };
}

// --- Stats computation ---

function computeStats(animeList: CompactEntry[], mangaList: CompactEntry[]) {
  const animeScores = animeList.filter(e => e.score && e.score > 0).map(e => e.score!);
  const mangaScores = mangaList.filter(e => e.score && e.score > 0).map(e => e.score!);

  const animeGenres: Record<string, number> = {};
  const mangaGenres: Record<string, number> = {};

  for (const entry of animeList) {
    for (const genre of entry.genres) {
      animeGenres[genre] = (animeGenres[genre] || 0) + 1;
    }
  }
  for (const entry of mangaList) {
    for (const genre of entry.genres) {
      mangaGenres[genre] = (mangaGenres[genre] || 0) + 1;
    }
  }

  const topGenres = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

  return {
    meanAnimeScore: animeScores.length > 0 ? Math.round((animeScores.reduce((a, b) => a + b, 0) / animeScores.length) * 10) / 10 : null,
    meanMangaScore: mangaScores.length > 0 ? Math.round((mangaScores.reduce((a, b) => a + b, 0) / mangaScores.length) * 10) / 10 : null,
    mostWatchedGenres: topGenres(animeGenres),
    mostReadGenres: topGenres(mangaGenres),
  };
}

// --- Main ---

export async function getUserListSummary(
  platform: 'anilist' | 'mal',
  userId: number | string,
  token: string,
): Promise<UserListSummary> {
  let username: string;
  let animeList: CompactEntry[];
  let mangaList: CompactEntry[];

  if (platform === 'anilist') {
    if (!userId || userId === '') {
      const viewer = await verifyAniListToken(token);
      userId = viewer.id;
      username = viewer.name;
    }
    const result = await summarizeAniListList(userId as number, token);
    username = result.username;
    animeList = result.animeList;
    mangaList = result.mangaList;
  } else {
    if (!userId || userId === '') {
      const malUser = await verifyMalToken(token);
      userId = malUser.name;
    }
    username = userId as string;
    const result = await summarizeMalList(username, token);
    animeList = result.animeList;
    mangaList = result.mangaList;
  }

  return {
    username,
    platform,
    totalAnime: animeList.length,
    totalManga: mangaList.length,
    animeList,
    mangaList,
    stats: computeStats(animeList, mangaList),
  };
}

// Format the summary into a text prompt for the AI
export function formatListForPrompt(summary: UserListSummary): string {
  const parts: string[] = [];

  parts.push(`User: ${summary.username} (${summary.platform})`);
  parts.push(`Anime: ${summary.totalAnime} entries | Manga: ${summary.totalManga} entries`);
  if (summary.stats.meanAnimeScore) parts.push(`Mean Anime Score: ${summary.stats.meanAnimeScore}/10`);
  if (summary.stats.meanMangaScore) parts.push(`Mean Manga Score: ${summary.stats.meanMangaScore}/10`);
  if (summary.stats.mostWatchedGenres.length > 0) parts.push(`Top Anime Genres: ${summary.stats.mostWatchedGenres.join(', ')}`);
  if (summary.stats.mostReadGenres.length > 0) parts.push(`Top Manga Genres: ${summary.stats.mostReadGenres.join(', ')}`);

  // Anime list — scored entries sorted by score
  const scoredAnime = summary.animeList
    .filter(e => e.score && e.score > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (scoredAnime.length > 0) {
    parts.push('\n=== ANIME LIST (scored, sorted by score) ===');
    const top = scoredAnime.slice(0, 50);
    const bottom = scoredAnime.slice(-20);
    const dropped = summary.animeList.filter(e => e.status === 'DROPPED');

    for (const e of top) {
      parts.push(`  [${e.score}/10] ${e.title} {anime:${e.id}} (${e.format}, ${e.totalEpisodes ?? '?'} eps, ${e.genres.join('/')})`);
    }

    if (bottom.length > 0 && scoredAnime.length > 70) {
      parts.push('\n  --- Lower scored ---');
      for (const e of bottom) {
        parts.push(`  [${e.score}/10] ${e.title} {anime:${e.id}} (${e.format}, ${e.genres.join('/')})`);
      }
    }

    if (dropped.length > 0) {
      parts.push('\n  --- DROPPED ---');
      for (const e of dropped.slice(0, 30)) {
        parts.push(`  [${e.score || 'NS'}/10] ${e.title} {anime:${e.id}} (${e.format}, watched ${e.episodesWatched ?? 0}/${e.totalEpisodes ?? '?'} eps, ${e.genres.join('/')})`);
      }
    }
  }

  // Currently watching / reading
  const watching = summary.animeList.filter(e => e.status === 'WATCHING' || e.status === 'REWATCHING');
  if (watching.length > 0) {
    parts.push('\n=== CURRENTLY WATCHING ===');
    for (const e of watching) {
      parts.push(`  ${e.title} {anime:${e.id}} (${e.episodesWatched ?? 0}/${e.totalEpisodes ?? '?'} eps, score: ${e.score || 'not rated'})`);
    }
  }

  const reading = summary.mangaList.filter(e => e.status === 'WATCHING');
  if (reading.length > 0) {
    parts.push('\n=== CURRENTLY READING ===');
    for (const e of reading) {
      parts.push(`  ${e.title} {manga:${e.id}} (${e.chaptersRead ?? 0}/${e.totalChapters ?? '?'} ch, score: ${e.score || 'not rated'})`);
    }
  }

  // Plan to watch
  const planAnime = summary.animeList.filter(e => e.status === 'PLANNING');
  if (planAnime.length > 0) {
    parts.push('\n=== PLAN TO WATCH (first 20) ===');
    for (const e of planAnime.slice(0, 20)) {
      parts.push(`  ${e.title} {anime:${e.id}} (${e.format}, ${e.totalEpisodes ?? '?'} eps, ${e.genres.join('/')})`);
    }
    if (planAnime.length > 20) parts.push(`  ... and ${planAnime.length - 20} more`);
  }

  const planManga = summary.mangaList.filter(e => e.status === 'PLANNING');
  if (planManga.length > 0) {
    parts.push('\n=== PLAN TO READ (first 20) ===');
    for (const e of planManga.slice(0, 20)) {
      parts.push(`  ${e.title} {manga:${e.id}} (${e.totalChapters ?? '?'} ch, ${e.genres.join('/')})`);
    }
    if (planManga.length > 20) parts.push(`  ... and ${planManga.length - 20} more`);
  }

  // Top manga
  const scoredManga = summary.mangaList.filter(e => e.score && e.score > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (scoredManga.length > 0) {
    parts.push('\n=== TOP MANGA (by score, top 30) ===');
    for (const e of scoredManga.slice(0, 30)) {
      parts.push(`  [${e.score}/10] ${e.title} {manga:${e.id}} (${e.format}, ${e.genres.join('/')})`);
    }
  }

  return parts.join('\n');
}
