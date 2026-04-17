import { Hono } from 'hono';
import { fetchAniListUserList, verifyAniListToken, AniListError } from '../services/anilist.js';
import { fetchMalProfile, MalError } from '../services/mal.js';
import { validateRequest, userInfoRequestSchema } from '../middleware/validator.js';

const user = new Hono();

user.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(userInfoRequestSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  const { platform, user_id, token } = validation.data;

  try {
    if (platform === 'anilist') {
      // Verify token first
      if (token) {
        const viewer = await verifyAniListToken(token);
        if (viewer.id !== user_id) {
          return c.json({
            success: false,
            error: 'TOKEN_MISMATCH',
            message: `Token belongs to a different user. Token user: ${viewer.id}, requested user_id: ${user_id}`,
            code: 403,
          }, 403);
        }
      }

      const { user } = await fetchAniListUserList(user_id, 'ANIME', token);

      return c.json({
        success: true,
        user: {
          id: user.id,
          id_mal: null,
          id_anilist: user.id,
          username: user.name,
          name: user.name,
          platform: 'anilist' as const,
          avatar: user.avatar,
          banner: user.banner?.large || null,
          options: {
            title_language: user.options.titleLanguage,
            display_adult_content: user.options.displayAdultContent,
            profile_color: user.options.profileColor,
          },
          stats: {
            anime: {
              total: user.statistics.anime.count,
              watching: 0, completed: 0, on_hold: 0, dropped: 0, plan_to_watch: 0,
              total_episodes_watched: user.statistics.anime.episodesWatched,
              mean_score: user.statistics.anime.meanScore,
            },
            manga: {
              total: user.statistics.manga.count,
              reading: 0, completed: 0, on_hold: 0, dropped: 0, plan_to_read: 0,
              total_chapters_read: user.statistics.manga.chaptersRead,
              mean_score: user.statistics.manga.meanScore,
            },
          },
        },
      });
    } else {
      // MAL
      if (!token) {
        return c.json({
          success: false,
          error: 'AUTH_REQUIRED',
          message: 'MAL user info requires a token',
          code: 401,
        }, 401);
      }

      const profile = await fetchMalProfile(token);

      return c.json({
        success: true,
        user: {
          id: profile.id,
          id_mal: profile.id,
          id_anilist: null,
          username: profile.name,
          name: profile.name,
          platform: 'mal' as const,
          avatar: profile.picture,
          banner: null,
          options: {
            title_language: null,
            display_adult_content: false,
            profile_color: null,
          },
          stats: {
            anime: {
              total: (profile.anime_statistics?.numItemsCompleted || 0) + (profile.anime_statistics?.numItemsWatching || 0) + (profile.anime_statistics?.numItemsOnHold || 0) + (profile.anime_statistics?.numItemsDropped || 0) + (profile.anime_statistics?.numItemsPlanToWatch || 0),
              watching: profile.anime_statistics?.numItemsWatching || 0,
              completed: profile.anime_statistics?.numItemsCompleted || 0,
              on_hold: profile.anime_statistics?.numItemsOnHold || 0,
              dropped: profile.anime_statistics?.numItemsDropped || 0,
              plan_to_watch: profile.anime_statistics?.numItemsPlanToWatch || 0,
              total_episodes_watched: profile.anime_statistics?.numEpisodesWatched || 0,
              mean_score: profile.anime_statistics?.meanScore || 0,
            },
            manga: {
              total: (profile.manga_statistics?.numItemsCompleted || 0) + (profile.manga_statistics?.numItemsReading || 0) + (profile.manga_statistics?.numItemsOnHold || 0) + (profile.manga_statistics?.numItemsDropped || 0) + (profile.manga_statistics?.numItemsPlanToRead || 0),
              reading: profile.manga_statistics?.numItemsReading || 0,
              completed: profile.manga_statistics?.numItemsCompleted || 0,
              on_hold: profile.manga_statistics?.numItemsOnHold || 0,
              dropped: profile.manga_statistics?.numItemsDropped || 0,
              plan_to_read: profile.manga_statistics?.numItemsPlanToRead || 0,
              total_chapters_read: profile.manga_statistics?.numChaptersRead || 0,
              mean_score: profile.manga_statistics?.meanScore || 0,
            },
          },
        },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    let code = 'INTERNAL_ERROR';
    let status = 500;

    if (msg.includes('not found') || msg.includes('Not Found')) {
      code = 'USER_NOT_FOUND';
      status = 404;
    } else if (msg.includes('token') || msg.includes('Token') || msg.includes('auth') || msg.includes('401')) {
      code = 'INVALID_TOKEN';
      status = 401;
    } else if (msg.includes('private') || msg.includes('Private')) {
      code = 'LIST_PRIVATE';
      status = 403;
    }

    return c.json({
      success: false,
      error: code,
      message: msg,
      platform,
      code: status,
    }, status as 400);
  }
});

export default user;
