// AniList Media Status
export type AniListMediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

// AniList User List Status
export type AniListListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

// AniList Media Type
export type AniListMediaType = 'ANIME' | 'MANGA';

// AniList Media Format
export type AniListMediaFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | 'PV' | 'CM' | 'TV_SPECIAL' | 'MANGA' | 'NOVEL' | 'ONE_SHOT' | 'MANHWA' | 'MANHUA';

// AniList Relation Type
export type AniListRelationType = 'SEQUEL' | 'PREQUEL' | 'SIDE_STORY' | 'ALTERNATIVE_VERSION' | 'ALTERNATIVE_SETTING' | 'SPIN_OFF' | 'ADAPTATION' | 'CHARACTER' | 'SUMMARY' | 'FULL_STORY' | 'PARENT' | 'SOURCE' | 'COMPILATION' | 'CONTAINS' | 'OTHER';

// AniList Season
export type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface AniListDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AniListCoverImage {
  extra_large: string | null;
  large: string | null;
  medium: string | null;
  color: string | null;
}

export interface AniListTrailer {
  id: string;
  site: string;
  thumbnail: string;
}

export interface AniListStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AniListProducer {
  id: number;
  name: string;
}

export interface AniListAuthor {
  id: number;
  name: string;
  role?: string;
}

export interface AniListSerialization {
  id: number;
  name: string;
}

export interface AniListTag {
  name: string;
  rank: number;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
}

export interface AniListExternalLink {
  url: string;
  site: string;
  type: string;
  icon?: string;
}

export interface AniListNextEpisode {
  episode: number;
  airingAt: number;
}

// Minimal related media (nested in relations)
export interface AniListRelationMedia {
  id: number;
  idMal: number | null;
  type: AniListMediaType;
  format: AniListMediaFormat | null;
  status: AniListMediaStatus | null;
  title: AniListTitle;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  popularity: number | null;
  coverImage: { large: string | null; medium: string | null; color: string | null };
  startDate: AniListDate | null;
  endDate: AniListDate | null;
  season: AniListSeason | null;
  seasonYear: number | null;
  source: string | null;
  description: string | null;
  genres: string[];
  tags: AniListTag[];
  studios: { id: number; name: string }[];
  authors: AniListAuthor[];
  serializations: AniListSerialization[];
  bannerImage: string | null;
  trailer: AniListTrailer | null;
  siteUrl: string | null;
  synonyms: string[];
  duration: number | null;
  externalLinks: AniListExternalLink[];
  countryOfOrigin: string;
  isLicensed: boolean;
  isAdult: boolean;
  nextAiringEpisode: AniListNextEpisode | null;
}

export interface AniListRelationEdge {
  relationType: AniListRelationType;
  node: AniListRelationMedia;
}

// Full media object from AniList
export interface AniListMedia extends AniListRelationMedia {
  idMal: number | null;
  source: string | null;
  description: string | null;
  duration: number | null;
  seasonInt: number | null;
  synonyms: string[];
  meanScore: number | null;
  bayesianScore: number | null;
  trending: number;
  favourites: number;
  bannerImage: string | null;
  trailer: AniListTrailer | null;
  externalLinks: AniListExternalLink[];
  countryOfOrigin: string;
  isLicensed: boolean;
  isAdult: boolean;
  relations: {
    edges: AniListRelationEdge[];
  };
}

// User list entry
export interface AniListListEntry {
  mediaId: number;
  status: AniListListStatus;
  score: number | null;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  priority: string;
  startedAt: AniListDate;
  completedAt: AniListDate;
  notes: string;
  customLists: string[];
  updatedAt: number;
}

// Full list entry (media + list status)
export interface AniListListEntryFull {
  listEntry: AniListListEntry;
  media: AniListMedia;
}

// User info from collection
export interface AniListUserStatistics {
  anime: { episodesWatched: number; meanScore: number; count: number };
  manga: { chaptersRead: number; meanScore: number; count: number };
}

export interface AniListUser {
  id: number;
  name: string;
  avatar: { large: string; medium: string };
  bannerImage: string | null;
  options: {
    titleLanguage: string;
    displayAdultContent: boolean;
    profileColor: string;
  };
  statistics: AniListUserStatistics;
}

// GraphQL query response types
export interface AniListMediaListCollectionResponse {
  MediaListCollection: {
    user: AniListUser;
    lists: {
      name: string;
      isCustomList: boolean;
      entries: AniListListEntryFull[];
    }[];
  } | null;
}

export interface AniListMediaResponse {
  Media: AniListMedia | null;
}

export interface AniListViewerResponse {
  Viewer: {
    id: number;
    name: string;
    avatar: { large: string; medium: string };
    bannerImage: string | null;
    mediaListOptions: {
      animeList: { customLists: string[] };
      mangaList: { customLists: string[] };
    };
  };
}
