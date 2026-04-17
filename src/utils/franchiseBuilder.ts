import type { UnifiedMedia, FranchiseEntry } from '../types/media.js';

interface FranchiseGroup {
  id: string;
  name: string;
  mediaIds: Set<number>;
  entries: UnifiedMedia[];
}

export function buildFranchises(mediaMap: Map<number, UnifiedMedia>): FranchiseEntry[] {
  const groups: Map<string, FranchiseGroup> = new Map();
  const visited = new Set<number>();

  // DFS to find all connected media through relations
  function traverse(mediaId: number, groupId: string, group: FranchiseGroup): void {
    if (visited.has(mediaId)) return;
    visited.add(mediaId);

    const media = mediaMap.get(mediaId);
    if (!media) return;

    group.mediaIds.add(mediaId);
    group.entries.push(media);

    // Follow relations
    for (const rel of media.relations) {
      if (!visited.has(rel.media.id)) {
        traverse(rel.media.id, groupId, group);
      }
    }
  }

  // For each media item, start a franchise group if not visited
  for (const [mediaId, media] of mediaMap) {
    if (visited.has(mediaId)) continue;

    const groupId = `franchise_${mediaId}`;
    const groupName = media.title.preferred;
    const group: FranchiseGroup = {
      id: groupId,
      name: groupName,
      mediaIds: new Set(),
      entries: [],
    };

    traverse(mediaId, groupId, group);
    groups.set(groupId, group);
  }

  return Array.from(groups.values()).map(group => ({
    franchise_id: group.id,
    franchise_name: group.name,
    entries: sortFranchiseEntries(group.entries),
    is_fully_completed: group.entries.every(m => m.user_list_entry?.status === 'COMPLETED'),
  }));
}

function sortFranchiseEntries(entries: UnifiedMedia[]): UnifiedMedia[] {
  return entries.sort((a, b) => {
    // Sort by start_date
    const aYear = a.start_date?.year || 9999;
    const bYear = b.start_date?.year || 9999;
    if (aYear !== bYear) return aYear - bYear;

    const aMonth = a.start_date?.month || 12;
    const bMonth = b.start_date?.month || 12;
    if (aMonth !== bMonth) return aMonth - bMonth;

    const aDay = a.start_date?.day || 30;
    const bDay = b.start_date?.day || 30;
    return aDay - bDay;
  });
}
