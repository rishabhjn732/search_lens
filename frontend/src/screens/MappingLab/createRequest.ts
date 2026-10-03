// The request that creates the index, as text to copy, and what it creates in plain words
// (spec 007, R6.1 to R6.3, R6.6). Nothing here sends anything.
import { plainChain } from '../../analysis/compare';
import { createBody, listFields, resolveAnalyzer, type Definition } from '../../analysis/definition';
import type { Chain } from '../../analysis/types';

export const DEFAULT_NAME = 'products';
export type Format = 'dev' | 'curl';

// OpenSearch index names are lower case, and cannot hold spaces or most marks.
export function indexName(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-') || 'my-index';
}

export function requestText(def: Definition, name: string, format: Format): string {
  const path = indexName(name);
  const json = JSON.stringify(createBody(def), null, 2);
  if (format === 'dev') return `PUT /${path}\n${json}`;
  // No password: -u with only a user name makes curl ask for it (R6.3).
  return `curl -X PUT "https://localhost:9200/${path}" \\\n  -u admin \\\n  -H 'Content-Type: application/json' \\\n  -d '${json.replace(/'/g, `'\\''`)}'`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// R6.6: the name, shards and copies, each custom analyzer, and the fields by kind.
export function plainSummary(def: Definition, name: string): string[] {
  const settings = createBody(def).settings ?? {};
  const shards = Number(settings.number_of_shards ?? 1) || 1;
  const replicas = Number(settings.number_of_replicas ?? 1);
  const lines = [
    `An empty index called "${indexName(name)}".`,
    `Split into ${shards} ${plural(shards, 'part', 'parts')} (shards), each with ${replicas} backup ${plural(replicas, 'copy', 'copies')} (replicas).`,
  ];
  Object.keys((def.analysis.analyzer as object | undefined) ?? {}).forEach((k) => {
    const chain = resolveAnalyzer(k, def.analysis);
    if ('error' in chain) return;
    const sentence = plainChain(chain as Chain);
    // "Cut into words…" continues a sentence in lower case; "HTML removed…" keeps its capitals.
    const lower = /^[A-Z][a-z]/.test(sentence) ? `${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` : sentence;
    lines.push(`Your analyzer "${k}": ${lower}`);
  });
  const count = { text: 0, keyword: 0, other: 0 };
  listFields(def.mappings, def.analysis).forEach((f) => {
    if (f.kind !== 'object') count[f.kind]++;
  });
  lines.push(
    `${count.text} text ${plural(count.text, 'field', 'fields')} (searched by words), ` +
      `${count.keyword} keyword ${plural(count.keyword, 'field', 'fields')} (exact values, for filters and sorting), ` +
      `and ${count.other} other (numbers, dates, yes/no).`,
    'No documents. You add them later.',
  );
  return lines;
}
