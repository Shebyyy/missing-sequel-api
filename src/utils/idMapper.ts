// Map between AniList and MAL IDs using the cross-reference data
// AniList includes idMal on media, MAL doesn't include AniList ID directly

export interface IdMapping {
  anilistId: number;
  malId: number;
}

// Simple in-memory cache for ID mappings
const idMapCache = new Map<string, number>();

export function setMapping(anilistId: number, malId: number): void {
  if (anilistId) idMapCache.set(`al_${anilistId}`, malId);
  if (malId) idMapCache.set(`mal_${malId}`, anilistId);
}

export function getMalId(anilistId: number): number | undefined {
  return idMapCache.get(`al_${anilistId}`);
}

export function getAnilistId(malId: number): number | undefined {
  return idMapCache.get(`mal_${malId}`);
}

export function buildMappingsFromMedia(mediaList: Array<{ id?: number; idMal?: number | null; id_mal?: number | null }>): void {
  for (const media of mediaList) {
    const alId = media.id;
    const malId = media.idMal ?? media.id_mal;
    if (alId && malId) {
      setMapping(alId, malId);
    }
  }
}
