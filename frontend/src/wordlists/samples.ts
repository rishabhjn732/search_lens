import type { ListType } from './rules';

export interface SavedFile {
  id: string;
  type: ListType;
  name: string;
  enabled: boolean;
  updated: number;
  entries: string[];
}

export interface SavedData {
  files: SavedFile[];
}

const DAY = 86_400_000;

// Shown on the first visit, the same as the prototype (R2.9).
export function sampleData(now: number, id: () => string): SavedData {
  const file = (type: ListType, name: string, enabled: boolean, age: number, entries: string[]): SavedFile => ({
    id: id(),
    type,
    name,
    enabled,
    updated: now - age,
    entries,
  });
  return {
    files: [
      file('entity', 'entity.txt', true, 0, [
        'ai supplychain',
        'machine learning',
        'new york',
        'data lake',
        'purchase order',
        'supply chain management',
        'large language model',
        'cloud native',
      ]),
      file('entity', 'brands-2026.txt', false, 2 * DAY, ['north face', 'under armour', 'new balance']),
      file('protected', 'protected.txt', true, 0, ['iphone', 'adidas', 'running', 'news', 'kubernetes', 'opensearch', 'wifi']),
      file('synonym', 'synonyms.txt', true, 0, [
        'sneakers, running shoes',
        'tv => television',
        'mobile, cell phone, smartphone',
        'laptop, notebook',
        'couch, sofa',
      ]),
      file('synonym', 'abbreviations.txt', true, 7 * DAY, [
        'scm => supply chain management',
        'ai => artificial intelligence',
        'po => purchase order',
      ]),
      file('hunspell', 'en_US-sample', true, 3 * DAY, ['run', 'mouse', 'study', 'good', 'shoe', 'walk']),
    ],
  };
}
