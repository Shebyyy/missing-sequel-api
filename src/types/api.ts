import type { Platform, UnifiedListStatus, UnifiedMediaType } from './media';

// Check endpoint request
export interface CheckRequest {
  platform: Platform;
  user_id: number | string;
  token?: string;
  media_type?: 'ANIME' | 'MANGA' | 'ALL';
  include_upcoming?: boolean;
  include_adaptations?: boolean;
  sort_by?: 'relation_priority' | 'release_date' | 'popularity' | 'score';
}

// Status check request
export interface StatusCheckRequest {
  platform: Platform;
  user_id: number | string;
  token?: string;
  media_type?: 'ANIME' | 'MANGA' | 'ALL';
}

// Franchise request
export interface FranchiseRequest {
  platform: Platform;
  media_id: number;
  mal_id?: number;
  compact?: boolean;
}

// User info request
export interface UserInfoRequest {
  platform: Platform;
  user_id: number | string;
  token?: string;
}

// Status track register request
export interface StatusTrackRegisterRequest {
  platform: Platform;
  user_id: number | string;
  token: string;
  media_type?: 'ANIME' | 'MANGA' | 'ALL';
  webhook_url?: string;
  check_interval_hours?: number;
}

// Status track status request
export interface StatusTrackStatusRequest {
  platform: Platform;
  user_id: number | string;
}

// Status track unregister request
export interface StatusTrackUnregisterRequest {
  platform: Platform;
  user_id: number | string;
}

// API error
export interface ApiError {
  success: false;
  error: string;
  message: string;
  code: number;
  [key: string]: unknown;
}

// Base success response
export interface ApiSuccess {
  success: true;
}
