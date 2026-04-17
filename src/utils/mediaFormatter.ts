import type { AniListMedia, AniListListEntry, AniListMediaFormat, AniListMediaStatus, AniListListStatus } from '../types/anilist.js';
import type { UnifiedMedia, UnifiedListEntry, UnifiedTitle, UnifiedCoverImage, UnifiedMediaType, UnifiedListStatus, UnifiedMediaStatus } from '../types/media.js';
import type { MalAnimeNode, MalMangaNode, MalAnimeListStatusObj, MalMangaListStatusObj, MalAnimeRelation, MalMangaRelation } from '../types/mal.js';

// AniList format
export function formatAniListTitle(title: { romaji: string | null; english: string | null; native: string | null }): UnifiedTitle {
  const preferred = title.english || title.romaji || title.native || 'Unknown';
  return {
    romaji: title.romaji,
    english: title.english,
    native: title.native,
    preferred,
  };
}

export function formatAniListCover(cover: { extra_large: string | null; large: string | null; medium: string | null; color: string | null }): UnifiedCoverImage {
  return {
    extra_large: cover.extra_large,
    large: cover.large,
    medium: cover.medium,
    color: cover.color,
  };
}

export function formatAniListStatus(status: AniListListStatus): UnifiedListStatus {
  switch (status) {
    case 'CURRENT': return 'WATCHING';
    case 'PLANNING': return 'PLANNING';
    case 'COMPLETED': return 'COMPLETED';
    case 'PAUSED': return 'PAUSED';
    case 'DROPPED': return 'DROPPED';
    case 'REPEATING': return 'REPEATING';
    default: return status;
  }
}

export function formatAniListListEntry(entry: AniListListEntry): UnifiedListEntry {
  return {
    status: formatAniListStatus(entry.status),
    progress: entry.progress,
    progressVolumes: entry.progressVolumes,
    score: entry.score,
    repeat: entry.repeat,
    priority: entry.priority,
    startedAt: {
      year: entry.startedAt?.year ?? null,
      month: entry.startedAt?.month ?? null,
      day: entry.startedAt?.day ?? null,
    },
    completedAt: {
      year: entry.completedAt?.year ?? null,
      month: entry.completedAt?.month ?? null,
      day: entry.completedAt?.day ?? null,
    },
    notes: entry.notes,
    customLists: entry.customLists,
    updatedAt: new Date(entry.updatedAt * 1000).toISOString(),
  };
}

export function formatAniListMedia(media: AniListMedia, listEntry?: AniListListEntry): UnifiedMedia {
  const title = formatAniListTitle(media.title);
  const siteUrls: string[] = [];
  if (media.siteUrl) siteUrls.push(media.siteUrl);
  if (media.idMal) siteUrls.push(`https://myanimelist.net/${media.type === 'ANIME' ? 'anime' : 'manga'}/${media.idMal}`);

  return {
    id: media.id,
    id_mal: media.idMal,
    id_anilist: media.id,
    title,
    type: media.type as UnifiedMediaType,
    format: media.format as UnifiedMedia['format'],
    source: media.source,
    status: media.status as UnifiedMediaStatus,
    description: media.description,
    episodes: media.episodes,
    duration: media.duration,
    chapters: media.chapters,
    volumes: media.volumes,
    season: media.season,
    season_year: media.seasonYear,
    start_date: {
      year: media.startDate?.year ?? null,
      month: media.startDate?.month ?? null,
      day: media.startDate?.day ?? null,
    },
    end_date: {
      year: media.endDate?.year ?? null,
      month: media.endDate?.month ?? null,
      day: media.endDate?.day ?? null,
    },
    next_episode: media.nextAiringEpisode ? { episode: media.nextAiringEpisode.episode, airingAt: media.nextAiringEpisode.airingAt } : null,
    genres: media.genres || [],
    tags: (media.tags || []).map(t => ({ name: t.name, rank: t.rank, isMediaSpoiler: t.isMediaSpoiler, isGeneralSpoiler: t.isGeneralSpoiler })),
    studios: ((Array.isArray(media.studios) ? media.studios : (media.studios as Record<string, unknown>)?.nodes) || []).map((s: { id: number; name: string; isAnimationStudio: boolean }) => ({ id: s.id, name: s.name, isAnimationStudio: s.isAnimationStudio })),
    producers: [],
    authors: ((Array.isArray(media.authors) ? media.authors : (media.authors as Record<string, unknown>)?.nodes) || []).map((a: { id: number; name: string; role?: string }) => ({ id: a.id, name: a.name, role: a.role || '' })),
    serializations: ((Array.isArray(media.serializations) ? media.serializations : (media.serializations as Record<string, unknown>)?.nodes) || []).map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })),
    average_score: media.averageScore,
    mean_score: media.meanScore,
    bayesian_score: (media as Record<string, unknown>).bayesianScore as number | null || null,
    popularity: media.popularity,
    favourites: media.favourites,
    trending: media.trending,
    genres_rank: (media as Record<string, unknown>).genres_rank ? ((media as Record<string, unknown>).genres_rank as Array<{ genre: string; rank: number }>) : [],
    cover_image: formatAniListCover(media.coverImage),
    banner_image: media.bannerImage,
    trailer: media.trailer,
    site_urls: siteUrls,
    synonyms: media.synonyms || [],
    country_of_origin: media.countryOfOrigin,
    isLicensed: media.isLicensed,
    is_adult: media.isAdult,
    external_links: (media.externalLinks || []).map(l => ({ url: l.url, site: l.site, type: l.type, icon: l.icon })),
    relations: (media.relations?.edges || []).map(e => ({
      relation_type: e.relationType,
      media: formatAniListMedia(e.node),
    })),
    user_list_entry: listEntry ? formatAniListListEntry(listEntry) : null,
  };
}

// MAL format
export function formatMalAnimeNode(node: MalAnimeNode, listStatus?: MalAnimeListStatusObj): UnifiedMedia {
  const preferred = node.alternativeTitles?.en || node.title || 'Unknown';
  const coverUrl = node.mainPicture?.large || node.mainPicture?.medium || '';
  const relations = [
    ...(node.relatedAnime || []).map((r: MalAnimeRelation) => ({
      relation_type: r.relationType.toUpperCase() as UnifiedMedia['relations'][0]['relation_type'],
      media: {
        id: r.anime.id,
        id_mal: r.anime.id,
        id_anilist: null,
        title: { romaji: null, english: r.anime.title, native: null, preferred: r.anime.title },
        type: 'ANIME' as UnifiedMediaType,
        format: null,
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
        cover_image: { extra_large: r.anime.mainPicture?.large || null, large: r.anime.mainPicture?.large || null, medium: r.anime.mainPicture?.medium || null, color: null },
        banner_image: null,
        trailer: null,
        site_urls: [r.anime.id ? `https://myanimelist.net/anime/${r.anime.id}` : ''],
        synonyms: [],
        country_of_origin: null,
        isLicensed: null,
        is_adult: null,
        external_links: [],
        relations: [],
        user_list_entry: null,
      },
    })),
    ...((node.relatedManga || []) as MalMangaRelation[]).map((r: MalMangaRelation) => ({
      relation_type: r.relationType.toUpperCase() as UnifiedMedia['relations'][0]['relation_type'],
      media: {
        id: r.manga.id,
        id_mal: r.manga.id,
        id_anilist: null,
        title: { romaji: null, english: r.manga.title, native: null, preferred: r.manga.title },
        type: 'MANGA' as UnifiedMediaType,
        format: null,
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
        cover_image: { extra_large: r.manga.mainPicture?.large || null, large: r.manga.mainPicture?.large || null, medium: r.manga.mainPicture?.medium || null, color: null },
        banner_image: null,
        trailer: null,
        site_urls: [r.manga.id ? `https://myanimelist.net/manga/${r.manga.id}` : ''],
        synonyms: [],
        country_of_origin: null,
        isLicensed: null,
        is_adult: null,
        external_links: [],
        relations: [],
        user_list_entry: null,
      },
    })),
  ];

  return {
    id: node.id,
    id_mal: node.id,
    id_anilist: null,
    title: {
      romaji: null,
      english: node.alternativeTitles?.en || null,
      native: node.alternativeTitles?.ja || null,
      preferred,
    },
    type: 'ANIME',
    format: (node.mediaType?.toUpperCase()) as UnifiedMedia['format'],
    source: node.source || null,
    status: (node.status?.toUpperCase()) as UnifiedMediaStatus || null,
    description: node.synopsis || null,
    episodes: node.numEpisodes,
    duration: node.averageEpisodeDuration ? Math.floor(node.averageEpisodeDuration / 60) : null,
    chapters: null,
    volumes: null,
    season: node.startSeason?.season?.toUpperCase() || null,
    season_year: node.startSeason?.year || null,
    start_date: node.startDate ? parseMalDate(node.startDate) : null,
    end_date: node.endDate ? parseMalDate(node.endDate) : null,
    next_episode: null,
    genres: node.genres || [],
    tags: [],
    studios: (node.studios || []).map(s => ({ id: s.id, name: s.name, isAnimationStudio: false })),
    producers: [],
    authors: [],
    serializations: [],
    average_score: node.mean ? Math.round(node.mean * 10) : null,
    mean_score: node.mean || null,
    bayesian_score: null,
    popularity: node.popularity || null,
    favourites: null,
    trending: null,
    genres_rank: [],
    cover_image: {
      extra_large: node.mainPicture?.large || null,
      large: node.mainPicture?.large || null,
      medium: node.mainPicture?.medium || null,
      color: null,
    },
    banner_image: null,
    trailer: null,
    site_urls: node.id ? [`https://myanimelist.net/anime/${node.id}`] : [],
    synonyms: node.alternativeTitles?.synonyms || [],
    country_of_origin: null,
    isLicensed: null,
    is_adult: node.nsfw === 'black',
    external_links: [],
    relations,
    user_list_entry: listStatus ? formatMalAnimeListStatus(listStatus) : null,
  };
}

export function formatMalMangaNode(node: MalMangaNode, listStatus?: MalMangaListStatusObj): UnifiedMedia {
  const preferred = node.alternativeTitles?.en || node.title || 'Unknown';

  const relations = [
    ...((node.relatedAnime || []) as MalAnimeRelation[]).map((r: MalAnimeRelation) => ({
      relation_type: r.relationType.toUpperCase() as UnifiedMedia['relations'][0]['relation_type'],
      media: {
        id: r.anime.id,
        id_mal: r.anime.id,
        id_anilist: null,
        title: { romaji: null, english: r.anime.title, native: null, preferred: r.anime.title },
        type: 'ANIME' as UnifiedMediaType,
        format: null,
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
        cover_image: { extra_large: r.anime.mainPicture?.large || null, large: r.anime.mainPicture?.large || null, medium: r.anime.mainPicture?.medium || null, color: null },
        banner_image: null,
        trailer: null,
        site_urls: [r.anime.id ? `https://myanimelist.net/anime/${r.anime.id}` : ''],
        synonyms: [],
        country_of_origin: null,
        isLicensed: null,
        is_adult: null,
        external_links: [],
        relations: [],
        user_list_entry: null,
      },
    })),
    ...((node.relatedManga || []) as MalMangaRelation[]).map((r: MalMangaRelation) => ({
      relation_type: r.relationType.toUpperCase() as UnifiedMedia['relations'][0]['relation_type'],
      media: {
        id: r.manga.id,
        id_mal: r.manga.id,
        id_anilist: null,
        title: { romaji: null, english: r.manga.title, native: null, preferred: r.manga.title },
        type: 'MANGA' as UnifiedMediaType,
        format: null,
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
        cover_image: { extra_large: r.manga.mainPicture?.large || null, large: r.manga.mainPicture?.large || null, medium: r.manga.mainPicture?.medium || null, color: null },
        banner_image: null,
        trailer: null,
        site_urls: [r.manga.id ? `https://myanimelist.net/manga/${r.manga.id}` : ''],
        synonyms: [],
        country_of_origin: null,
        isLicensed: null,
        is_adult: null,
        external_links: [],
        relations: [],
        user_list_entry: null,
      },
    })),
  ];

  return {
    id: node.id,
    id_mal: node.id,
    id_anilist: null,
    title: {
      romaji: null,
      english: node.alternativeTitles?.en || null,
      native: node.alternativeTitles?.ja || null,
      preferred,
    },
    type: 'MANGA',
    format: (node.mediaType?.toUpperCase()) as UnifiedMedia['format'],
    source: null,
    status: (node.status?.toUpperCase()) as UnifiedMediaStatus || null,
    description: node.synopsis || null,
    episodes: null,
    duration: null,
    chapters: node.numChapters,
    volumes: node.numVolumes,
    season: null,
    season_year: null,
    start_date: node.startDate ? parseMalDate(node.startDate) : null,
    end_date: node.endDate ? parseMalDate(node.endDate) : null,
    next_episode: null,
    genres: node.genres || [],
    tags: [],
    studios: [],
    producers: [],
    authors: (node.authors || []).map(a => ({
      id: null,
      name: `${a.firstName} ${a.lastName}`.trim(),
      role: a.role || '',
    })),
    serializations: [],
    average_score: node.mean ? Math.round(node.mean * 10) : null,
    mean_score: node.mean || null,
    bayesian_score: null,
    popularity: node.popularity || null,
    favourites: null,
    trending: null,
    genres_rank: [],
    cover_image: {
      extra_large: node.mainPicture?.large || null,
      large: node.mainPicture?.large || null,
      medium: node.mainPicture?.medium || null,
      color: null,
    },
    banner_image: null,
    trailer: null,
    site_urls: node.id ? [`https://myanimelist.net/manga/${node.id}`] : [],
    synonyms: node.alternativeTitles?.synonyms || [],
    country_of_origin: null,
    isLicensed: null,
    is_adult: node.nsfw === 'black',
    external_links: [],
    relations,
    user_list_entry: listStatus ? formatMalMangaListStatus(listStatus) : null,
  };
}

function formatMalAnimeListStatus(status: MalAnimeListStatusObj): UnifiedListEntry {
  return {
    status: status.status.toUpperCase() as UnifiedListStatus,
    progress: status.numEpisodesWatched,
    progressVolumes: null,
    score: status.score,
    repeat: status.numTimesRewatched,
    priority: String(status.priority),
    startedAt: status.startDate ? parseMalDate(status.startDate) : null,
    completedAt: status.finishDate ? parseMalDate(status.finishDate) : null,
    notes: status.comments,
    customLists: [],
    updatedAt: status.updatedAt,
  };
}

function formatMalMangaListStatus(status: MalMangaListStatusObj): UnifiedListEntry {
  return {
    status: status.status.toUpperCase() === 'READING' ? 'WATCHING' as UnifiedListStatus : status.status.toUpperCase() as UnifiedListStatus,
    progress: status.numChaptersRead,
    progressVolumes: status.numVolumesRead,
    score: status.score,
    repeat: status.numTimesReread,
    priority: String(status.priority),
    startedAt: status.startDate ? parseMalDate(status.startDate) : null,
    completedAt: status.finishDate ? parseMalDate(status.finishDate) : null,
    notes: status.comments,
    customLists: [],
    updatedAt: status.updatedAt,
  };
}

function parseMalDate(dateStr: string): { year: number | null; month: number | null; day: number | null } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  return {
    year: parts[0] ? parseInt(parts[0]) : null,
    month: parts[1] ? parseInt(parts[1]) : null,
    day: parts[2] ? parseInt(parts[2]) : null,
  };
}
