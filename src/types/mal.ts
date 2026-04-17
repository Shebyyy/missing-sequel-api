// MAL media status
export type MalMediaStatus = 'finished' | 'currently_airing' | 'currently_publishing' | 'not_yet_aired' | 'not_yet_published';

// MAL anime list status
export type MalAnimeListStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';

// MAL manga list status
export type MalMangaListStatus = 'reading' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_read';

// MAL relation types
export type MalRelationType = 'sequel' | 'prequel' | 'side_story' | 'alternative_version' | 'alternative_setting' | 'spin_off' | 'adaptation' | 'character' | 'summary' | 'full_story' | 'parent_story' | 'other';

// MAL media types
export type MalMediaType = 'tv' | 'ova' | 'movie' | 'special' | 'ona' | 'music' | 'cm' | 'pv' | 'tv_special';
export type MalMangaType = 'manga' | 'novel' | 'one_shot' | 'manhwa' | 'manhua' | 'doujinshi' | 'manfra';

export interface MalAlternativeTitles {
  synonyms: string[];
  en: string | null;
  ja: string | null;
}

export interface MalPicture {
  medium: string;
  large: string;
}

export interface MalMainPicture {
  medium: string;
  large: string;
}

export interface MalStartSeason {
  year: number;
  season: string;
}

export interface MalBroadcast {
  dayOfTheWeek?: string;
  startTime?: string;
  timeZone?: string;
}

export interface MalAnimeListStatusObj {
  status: MalAnimeListStatus;
  score: number;
  numEpisodesWatched: number;
  isRewatching: boolean;
  numTimesRewatched: number;
  priority: number;
  startDate: string | null;
  finishDate: string | null;
  comments: string;
  updatedAt: string;
}

export interface MalMangaListStatusObj {
  status: MalMangaListStatus;
  score: number;
  numChaptersRead: number;
  numVolumesRead: number;
  isRereading: boolean;
  numTimesReread: number;
  priority: number;
  startDate: string | null;
  finishDate: string | null;
  comments: string;
  updatedAt: string;
}

export interface MalAnimeRelation {
  id: number;
  relationType: MalRelationType;
  anime: {
    id: number;
    title: string;
    mainPicture?: MalMainPicture;
  };
}

export interface MalMangaRelation {
  id: number;
  relationType: MalRelationType;
  manga: {
    id: number;
    title: string;
    mainPicture?: MalMainPicture;
  };
}

// MAL anime node (from list response)
export interface MalAnimeNode {
  id: number;
  title: string;
  mainPicture: MalMainPicture;
  alternativeTitles: MalAlternativeTitles;
  startDate: string | null;
  endDate: string | null;
  synopsis: string | null;
  genres: string[];
  mean: number | null;
  rank: number | null;
  popularity: number | null;
  numListUsers: number | null;
  numScoringUsers: number | null;
  nsfw: string;
  createdAt: string | null;
  updatedAt: string | null;
  mediaType: MalMediaType;
  status: MalMediaStatus;
  numEpisodes: number | null;
  startSeason: MalStartSeason | null;
  broadcast: MalBroadcast | null;
  source: string | null;
  averageEpisodeDuration: number | null;
  studios: { id: number; name: string }[];
  pictures: MalPicture[];
  relatedAnime: MalAnimeRelation[];
  relatedManga: MalMangaRelation[];
}

// MAL manga node
export interface MalMangaNode {
  id: number;
  title: string;
  mainPicture: MalMainPicture;
  alternativeTitles: MalAlternativeTitles;
  startDate: string | null;
  endDate: string | null;
  synopsis: string | null;
  genres: string[];
  mean: number | null;
  rank: number | null;
  popularity: number | null;
  numListUsers: number | null;
  numScoringUsers: number | null;
  nsfw: string;
  mediaType: MalMangaType;
  status: MalMediaStatus;
  numChapters: number | null;
  numVolumes: number | null;
  authors: { firstName: string; lastName: string; role?: string }[];
  pictures: MalPicture[];
  relatedAnime: MalAnimeRelation[];
  relatedManga: MalMangaRelation[];
}

// MAL list data entry
export interface MalAnimeListEntry {
  node: MalAnimeNode;
  list_status: MalAnimeListStatusObj;
}

export interface MalMangaListEntry {
  node: MalMangaNode;
  list_status: MalMangaListStatusObj;
}

// MAL paginated response
export interface MalPaginatedResponse<T> {
  data: T[];
  paging: {
    next: string | null;
    previous: string | null;
  };
}

// MAL user profile
export interface MalAnimeStatistics {
  numItemsWatching: number;
  numItemsCompleted: number;
  numItemsOnHold: number;
  numItemsDropped: number;
  numItemsPlanToWatch: number;
  numEpisodesWatched: number;
  meanScore: number;
}

export interface MalMangaStatistics {
  numItemsReading: number;
  numItemsCompleted: number;
  numItemsOnHold: number;
  numItemsDropped: number;
  numItemsPlanToRead: number;
  numChaptersRead: number;
  numVolumesRead: number;
  meanScore: number;
}

export interface MalUserProfile {
  id: number;
  name: string;
  picture: MalMainPicture;
  anime_statistics: MalAnimeStatistics | null;
  manga_statistics: MalMangaStatistics | null;
}
