import { z } from 'zod';

export const checkRequestSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  token: z.string().optional(),
  media_type: z.enum(['ANIME', 'MANGA', 'ALL']).optional().default('ALL'),
  include_upcoming: z.boolean().optional().default(true),
  include_adaptations: z.boolean().optional().default(false),
  sort_by: z.enum(['relation_priority', 'release_date', 'popularity', 'score']).optional().default('relation_priority'),
  compact: z.boolean().optional().default(true),
}).refine(data => {
  if (data.platform === 'mal' && !data.token) return false;
  if (data.platform === 'anilist' && !data.user_id && !data.token) return false;
  return true;
}, { message: 'token is required for MAL; user_id or token is required for AniList' });

export const statusCheckRequestSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  token: z.string().optional(),
  media_type: z.enum(['ANIME', 'MANGA', 'ALL']).optional().default('ALL'),
  compact: z.boolean().optional().default(true),
}).refine(data => {
  if (data.platform === 'mal' && !data.token) return false;
  if (data.platform === 'anilist' && !data.user_id && !data.token) return false;
  return true;
}, { message: 'token is required for MAL; user_id or token is required for AniList' });

export const franchiseRequestSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  media_id: z.number().int().positive(),
  mal_id: z.number().int().positive().optional(),
  compact: z.boolean().optional().default(true),
});

export const userInfoRequestSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]),
  token: z.string().optional(),
});

export const statusTrackRegisterSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]),
  token: z.string().min(1),
  media_type: z.enum(['ANIME', 'MANGA', 'ALL']).optional().default('ALL'),
  webhook_url: z.string().url().optional(),
  check_interval_hours: z.number().int().min(1).max(168).optional().default(6),
});

export const statusTrackStatusSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]),
});

export const statusTrackUnregisterSchema = z.object({
  platform: z.enum(['anilist', 'mal']),
  user_id: z.union([z.number().int().positive(), z.string().min(1)]),
});

export function validateRequest<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
