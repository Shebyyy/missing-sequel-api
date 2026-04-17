import type { AniListMediaFormat, AniListMediaStatus, AniListMediaType, AniListRelationType } from './anilist';

// Unified status
export type UnifiedMediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

// Unified user list status
export type UnifiedListStatus = 'PLANNING' | 'WATCHING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'REPEATING';

// Unified media type
export type UnifiedMediaType = 'ANIME' | 'MANGA';

// Unified format
export type UnifiedFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | 'PV' | 'CM' | 'TV_SPECIAL' | 'MANGA' | 'NOVEL' | 'ONE_SHOT' | 'MANHWA' | 'MANHUA' | 'DOUJINSHI';

// Unified relation type
export type UnifiedRelationType = AniListRelationType;

// Platform
export type Platform = 'anilist' | 'mal';

// Unified title
export interface UnifiedTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
  preferred: string;
}

// Unified cover image
export interface UnifiedCoverImage {
  extra_large: string | null;
  large: string | null;
  medium: string | null;
  color: string | null;
}

// Unified user list entry
export interface UnifiedListEntry {
  status: UnifiedListStatus;
  progress: number;
  progressVolumes: number | null;
  score: number | null;
  repeat: number;
  priority: string;
  startedAt: { year: number | null; month: number | null; day: number | null } | null;
  completedAt: { year: number | null; month: number | null; day: number | null } | null;
  notes: string;
  customLists: string[];
  updatedAt: string;
}

// Unified media object (returned by all endpoints)
export interface UnifiedMedia {
  id: number;
  id_mal: number | null;
  id_anilist: number | null;
  title: UnifiedTitle;
  type: UnifiedMediaType;
  format: UnifiedFormat | null;
  source: string | null;
  status: UnifiedMediaStatus | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  chapters: number | null;
  volumes: number | null;
  season: string | null;
  season_year: number | null;
  start_date: { year: number | null; month: number | null; day: number | null } | null;
  end_date: { year: number | null; month: number | null; day: number | null } | null;
  next_episode: { episode: number; airingAt: number } | null;
  genres: string[];
  tags: { name: string; rank: number; isMediaSpoiler: boolean; isGeneralSpoiler: boolean }[];
  studios: { id: number; name: string; isAnimationStudio: boolean }[];
  producers: { id: number; name: string }[];
  authors: { id: number | null; name: string; role: string }[];
  serializations: { id: number; name: string }[];
  average_score: number | null;
  mean_score: number | null;
  bayesian_score: number | null;
  popularity: number | null;
  favourites: number | null;
  trending: number | null;
  genres_rank: { genre: string; rank: number }[];
  cover_image: UnifiedCoverImage;
  banner_image: string | null;
  trailer: { id: string; site: string; thumbnail: string } | null;
  site_urls: string[];
  synonyms: string[];
  country_of_origin: string | null;
  isLicensed: boolean | null;
  is_adult: boolean | null;
  external_links: { url: string; site: string; type: string; icon?: string }[];
  relations: {
    relation_type: UnifiedRelationType;
    media: UnifiedMedia;
  }[];
  user_list_entry: UnifiedListEntry | null;
}

// Missing entry (result from /api/check)
export interface MissingEntry {
  watched: UnifiedMedia;
  missing: UnifiedMedia;
  relation_type: UnifiedRelationType;
}

// Upcoming entry
export interface UpcomingEntry {
  watched: UnifiedMedia;
  upcoming: UnifiedMedia;
  relation_type: UnifiedRelationType;
}

// Status check result item
export interface StatusCheckItem {
  media: UnifiedMedia;
  user_list_status: UnifiedListEntry;
  user_status: UnifiedListStatus;
  total_items: number;
  progress: number;
  remaining: number;
}

// Franchise entry
export interface FranchiseEntry {
  franchise_id: string;
  franchise_name: string;
  entries: UnifiedMedia[];
  is_fully_completed: boolean;
}

// User profile (unified)
export interface UnifiedUserProfile {
  id: number | string;
  id_mal: number | null;
  id_anilist: number | null;
  username: string;
  name: string;
  platform: Platform;
  avatar: { medium: string; large: string } | null;
  banner: string | null;
  options: {
    title_language: string | null;
    display_adult_content: boolean;
    profile_color: string | null;
  };
  stats: {
    anime: {
      total: number;
      watching: number;
      completed: number;
      on_hold: number;
      dropped: number;
      plan_to_watch: number;
      total_episodes_watched: number;
      mean_score: number;
    };
    manga: {
      total: number;
      reading: number;
      completed: number;
      on_hold: number;
      dropped: number;
      plan_to_read: number;
      total_chapters_read: number;
      mean_score: number;
    };
  };
}
