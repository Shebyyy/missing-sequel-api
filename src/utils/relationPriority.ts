import type { UnifiedRelationType } from '../types/media.js';

export const RELATION_PRIORITY: Record<string, number> = {
  SEQUEL: 1,
  PREQUEL: 2,
  SIDE_STORY: 3,
  ALTERNATIVE_VERSION: 4,
  ALTERNATIVE_SETTING: 5,
  SPIN_OFF: 6,
  ADAPTATION: 7,
  CHARACTER: 8,
  SUMMARY: 9,
  FULL_STORY: 10,
  PARENT: 11,
  SOURCE: 12,
  COMPILATION: 13,
  CONTAINS: 14,
  OTHER: 15,
};

export function getRelationPriority(relationType: string): number {
  return RELATION_PRIORITY[relationType] ?? 99;
}

export function getHighestPriorityRelation(relations: Array<{ relationType: string }>): UnifiedRelationType {
  let highest: { relationType: string; priority: number } = { relationType: 'OTHER', priority: 99 };

  for (const rel of relations) {
    const priority = getRelationPriority(rel.relationType);
    if (priority < highest.priority) {
      highest = { relationType: rel.relationType, priority };
    }
  }

  return highest.relationType as UnifiedRelationType;
}

export function isAdaptationRelation(relationType: string): boolean {
  return relationType === 'ADAPTATION' || relationType === 'SOURCE';
}

export function isSequelRelation(relationType: string): boolean {
  return relationType === 'SEQUEL';
}
