import { Hono } from 'hono';
import { validateRequest, adviseRequestSchema } from '../middleware/validator.js';
import { verifyAniListToken } from '../services/anilist.js';
import { verifyMalToken } from '../services/mal.js';
import { getUserListSummary, formatListForPrompt } from '../services/listSummarizer.js';
import type { UserListSummary, CompactEntry } from '../services/listSummarizer.js';
import { askAi } from '../services/ai.js';
import { searchMediaByTitle } from '../services/mediaSearch.js';
import type { MediaRef } from '../services/mediaSearch.js';

const SYSTEM_PROMPT = `You are an expert anime/manga advisor. You have the user's complete anime and manga list with scores, genres, and watch status.

Your job:
- Analyze the user's taste patterns from their list
- Give personalized, specific recommendations
- Reference specific titles from their list to show you understand their taste
- Be concise but insightful — don't write essays
- If recommending something, explain WHY based on their list

Guidelines:
- Use the user's scores to understand what they like/dislike
- Consider genres, formats, episode counts, and years they prefer
- If they have many dropped titles in a genre, note that pattern
- Compare their scores vs what's typical when relevant
- Keep responses conversational and friendly
- Never make up information about anime/manga — only recommend things you know exist

IMPORTANT FORMATTING RULES:
- When recommending anime or manga, always wrap the title in **bold** markdown, e.g. **Steins;Gate**
- When referencing titles from the user's list, use their ID marker if available
- When suggesting NEW titles not in the user's list, wrap them in **bold** — they will be clickable
- Format: **Title Name** (reason) — keep it concise
- Use bullet points for multiple recommendations`;

// Cache user list summaries for 30 minutes to avoid refetching on every message
const listCache = new Map<string, { summary: string; username: string; listData: UserListSummary; fetchedAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCacheKey(platform: string, userId: string | number): string {
  return `${platform}:${userId}`;
}

// --- Media ref resolution ---

/**
 * Build a lookup map from title -> CompactEntry from the user's list.
 * Keys are lowercased titles for case-insensitive matching.
 */
function buildTitleLookup(summary: UserListSummary): Map<string, CompactEntry> {
  const map = new Map<string, CompactEntry>();
  const allEntries = [...summary.animeList, ...summary.mangaList];
  for (const entry of allEntries) {
    map.set(entry.title.toLowerCase(), entry);
    // Also index by common title variants (romaji, english, etc. could be different)
    if (entry.title.includes(':')) {
      // Handle "Title: Subtitle" -> try without subtitle
      const base = entry.title.split(':')[0].trim().toLowerCase();
      if (!map.has(base)) map.set(base, entry);
    }
  }
  return map;
}

/**
 * Extract all **bold** titles from the AI response text.
 */
function extractBoldTitles(text: string): string[] {
  const regex = /\*\*(.+?)\*\*/g;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    titles.push(match[1]);
  }
  return titles;
}

/**
 * Strip **bold** markdown markers from text, leaving just the plain titles.
 */
function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

/**
 * Resolve a single title to a MediaRef.
 * First checks the user's list (instant), then searches AniList/MAL (with timeout).
 */
async function resolveTitleToRef(
  title: string,
  titleLookup: Map<string, CompactEntry>,
  platform: 'anilist' | 'mal',
): Promise<MediaRef | null> {
  // Check user's list first
  const entry = titleLookup.get(title.toLowerCase());
  if (entry) {
    return {
      title: entry.title,
      id: String(entry.id),
      type: entry.type === 'MANGA' ? 'MANGA' : 'ANIME',
      cover: null,
      service: platform,
    };
  }

  // Search external services with a 10-second timeout
  try {
    const result = await Promise.race([
      searchMediaByTitle(title, 'ANIME'),
      new Promise<null>(resolve => setTimeout(resolve, 10_000)),
    ]);
    if (result) return result;
  } catch {
    // Search failed, try manga
  }

  try {
    const result = await Promise.race([
      searchMediaByTitle(title, 'MANGA'),
      new Promise<null>(resolve => setTimeout(resolve, 10_000)),
    ]);
    if (result) return result;
  } catch {
    // Both searches failed
  }

  return null;
}

const advise = new Hono();

advise.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(adviseRequestSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      details: validation.errors.errors.map(e => e.message),
      code: 400,
    }, 400);
  }

  const { platform, token, question, user_id, conversation_history } = validation.data;

  try {
    // Resolve user identity
    let resolvedUserId: number | string = user_id ?? '';
    let username = '';

    if (platform === 'anilist' && !user_id) {
      const viewer = await verifyAniListToken(token);
      resolvedUserId = viewer.id;
      username = viewer.name;
    } else if (platform === 'mal' && !user_id) {
      const malUser = await verifyMalToken(token);
      resolvedUserId = malUser.name;
      username = malUser.name;
    }

    if (!resolvedUserId) {
      return c.json({
        success: false,
        error: 'MISSING_USER',
        message: 'Could not resolve user. Provide user_id or a valid token.',
        code: 400,
      }, 400);
    }

    // Fetch list summary (with cache)
    const cacheKey = getCacheKey(platform, resolvedUserId);
    const cached = listCache.get(cacheKey);
    let listContext: string;
    let listData: UserListSummary;

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      listContext = cached.summary;
      username = cached.username;
      listData = cached.listData;
    } else {
      const summary = await getUserListSummary(platform, resolvedUserId, token);
      listContext = formatListForPrompt(summary);
      username = summary.username;
      listData = summary;
      listCache.set(cacheKey, { summary: listContext, username, listData, fetchedAt: Date.now() });

      // Clean old cache entries (keep max 100)
      if (listCache.size > 100) {
        const cacheEntries = [...listCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        for (let i = 0; i < cacheEntries.length - 80; i++) {
          listCache.delete(cacheEntries[i][0]);
        }
      }
    }

    // Build messages for AI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + listContext },
    ];

    // Add conversation history if provided
    if (conversation_history) {
      for (const msg of conversation_history) {
        messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
      }
    }

    // Add current question
    messages.push({ role: 'user', content: question });

    // Call AI
    const startTime = Date.now();
    const aiResult = await askAi(messages);
    const totalTime = Date.now() - startTime;

    // Resolve bold titles to media_refs
    const boldTitles = extractBoldTitles(aiResult.text);
    const titleLookup = buildTitleLookup(listData);
    const seenIds = new Set<string>();
    const mediaRefs: MediaRef[] = [];

    const resolvePromises = boldTitles.map(async (title) => {
      const ref = await resolveTitleToRef(title, titleLookup, platform);
      if (ref && !seenIds.has(ref.id)) {
        seenIds.add(ref.id);
        return ref;
      }
      return null;
    });

    const resolvedRefs = await Promise.all(resolvePromises);
    for (const ref of resolvedRefs) {
      if (ref) mediaRefs.push(ref);
    }

    // Strip bold markers from the answer
    const cleanAnswer = stripBoldMarkers(aiResult.text);

    return c.json({
      success: true,
      answer: cleanAnswer,
      media_refs: mediaRefs,
      provider: aiResult.provider,
      model: aiResult.model,
      response_time_ms: totalTime,
      ai_time_ms: aiResult.responseTimeMs,
      username,
      cache_hit: !!cached,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';

    // If it's an auth error from MAL/AniList
    if (msg.includes('INVALID_TOKEN') || msg.includes('expired') || msg.includes('401')) {
      return c.json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or has expired',
        platform,
        code: 401,
      }, 401);
    }

    // AI provider errors
    if (msg.includes('AI provider') || msg.includes('API key') || msg.includes('API_KEYS')) {
      return c.json({
        success: false,
        error: 'AI_UNAVAILABLE',
        message: msg,
        code: 503,
      }, 503);
    }

    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: msg,
      code: 500,
    }, 500);
  }
});

export default advise;
