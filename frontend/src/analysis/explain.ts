// Reading a _search/_explain explanation tree and a query body, in plain words (spec 004).
// No network; see opensearch/querylab.ts for the calls that fetch these trees.
import type { Field } from './types';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface RawExplanationNode {
  value: number;
  description: string;
  details?: RawExplanationNode[];
}

export interface ExplainRow {
  id: string;
  label: string;
  description: string;
  value: number;
  sentence: string;
  children: ExplainRow[];
  kind: 'contributing' | 'non-scoring';
  // Set when this row is specifically the idf, tf, or boost factor of a parent row, so the UI
  // can group the three into one BM25 formula card instead of a flat list (R4.2).
  metric?: 'idf' | 'tf' | 'boost';
}

const WEIGHT_RE = /weight\(([^)]+?)(?: in \d+)?\)/;
const CONSTANT_SCORE_RE = /ConstantScoreQuery\(([^)]+)\)/;
const COMBINATOR_RE = /^(sum of|max of|product of|ConstantScoreQuery)/i;

function labelFor(node: RawExplanationNode, fallback: string): string {
  const match = node.description.match(WEIGHT_RE);
  return match ? match[1] : fallback;
}

function metricFor(description: string): ExplainRow['metric'] {
  const d = description.toLowerCase();
  if (d.startsWith('idf')) return 'idf';
  if (d.startsWith('tf,') || d.startsWith('tf ')) return 'tf';
  if (d.startsWith('boost')) return 'boost';
  return undefined;
}

function findByPrefix(nodes: RawExplanationNode[] | undefined, prefix: string): RawExplanationNode | undefined {
  return nodes?.find((n) => n.description.toLowerCase().startsWith(prefix));
}

// Turns a node's idf/tf/boost children (R4.2) into one plain sentence. A node with none of
// these (a sum, or a filter) falls back to its own raw description.
function sentenceFor(node: RawExplanationNode): string {
  const details = node.details ?? [];
  const idf = findByPrefix(details, 'idf');
  const tf = findByPrefix(details, 'tf');
  const boost = findByPrefix(details, 'boost');
  const parts: string[] = [];
  if (idf) parts.push(`how rare this word is (idf ${idf.value.toFixed(2)})`);
  if (tf) parts.push(`how much the word fills the field (tf ${tf.value.toFixed(2)})`);
  if (boost) parts.push(`a boost of ${boost.value.toFixed(2)}`);
  if (parts.length === 0) return node.description;
  return `This score comes from ${parts.join(', ')}.`;
}

function buildRow(node: RawExplanationNode, id: string, fallbackLabel: string): ExplainRow {
  const label = labelFor(node, fallbackLabel);
  const children = (node.details ?? []).map((child, i) => buildRow(child, `${id}.${i}`, label));
  return {
    id,
    label,
    description: node.description,
    value: node.value,
    sentence: sentenceFor(node),
    children,
    kind: node.value > 0 ? 'contributing' : 'non-scoring',
    metric: metricFor(node.description),
  };
}

// The top-level rows (R4.1): one per field/term that contributed. A root like "sum of:" or
// "ConstantScoreQuery(...)" is a combinator with no score of its own, so its direct children
// become the top-level rows. Anything else — most often a single "weight(field:term in N)"
// node for a plain (non-bool) query — IS the meaningful row itself, and must not be unwrapped
// into its idf/tf/boost children (that produced the generic "clause 1" labels this replaces).
export function scoreRows(explanation: RawExplanationNode): ExplainRow[] {
  const isCombinator = COMBINATOR_RE.test(explanation.description);
  if (isCombinator && explanation.details && explanation.details.length > 0) {
    return explanation.details.map((node, i) => buildRow(node, String(i), `clause ${i + 1}`));
  }
  return [buildRow(explanation, '0', 'score')];
}

// Splits a Lucene-style variable description ("n, number of documents containing term") into
// its short symbol and the rest, for a labelled stat row. Descriptions that are not of this
// shape (no comma, or the first segment reads like a sentence) are left whole.
export function splitVariable(description: string): { symbol: string | null; desc: string } {
  const comma = description.indexOf(',');
  if (comma === -1) return { symbol: null, desc: description };
  const symbol = description.slice(0, comma).trim();
  const desc = description.slice(comma + 1).trim();
  if (symbol.length > 0 && symbol.length <= 8 && /^[a-zA-Z][a-zA-Z0-9]*$/.test(symbol)) {
    return { symbol, desc };
  }
  return { symbol: null, desc: description };
}

// Pulls the formula out of a Lucene-style "idf, computed as log(...) from:" description, for
// showing next to the variables that feed it (R4.2).
export function formulaOf(description: string): string | null {
  const match = description.match(/computed as (.+?)(?: from:)?$/i);
  return match ? match[1].trim() : null;
}

// Non-scoring (filter) clauses the document passed, by name (R4.5). OpenSearch wraps a
// filter clause's explanation in "ConstantScoreQuery(<clause>)".
export function filtersPassed(explanation: RawExplanationNode): string[] {
  const names = new Set<string>();
  const visit = (node: RawExplanationNode) => {
    const match = node.description.match(CONSTANT_SCORE_RE);
    if (match) names.add(match[1]);
    (node.details ?? []).forEach(visit);
  };
  visit(explanation);
  return Array.from(names);
}

// Fields named in the query that never show up as a "weight(field:...)" node anywhere in
// the explanation tree — for example a field best_fields did not pick (R4.4).
export function fieldsNotCounted(
  queryFields: string[],
  explanation: RawExplanationNode,
): { field: string; reason: string }[] {
  const counted = new Set<string>();
  const visit = (node: RawExplanationNode) => {
    const match = node.description.match(WEIGHT_RE);
    if (match) counted.add(match[1].split(':')[0]);
    (node.details ?? []).forEach(visit);
  };
  visit(explanation);

  return queryFields
    .filter((field) => !counted.has(field))
    .map((field) => ({
      field,
      reason: `${field} did not add to this document's score (for example, it was not the best-matching field).`,
    }));
}

// ---- Plain words for the query itself (R6.1, R6.2) -------------------------------------

function clauseSentence(clause: Json): string {
  const type = Object.keys(clause)[0];
  const body = clause[type];

  if (type === 'match_all') return 'matches every document';
  if ((type === 'match' || type === 'match_phrase') && isObj(body)) {
    const field = Object.keys(body)[0];
    const value = body[field];
    const text = isObj(value) ? value.query : value;
    return `looks for the words of "${String(text)}" in ${field}`;
  }
  if ((type === 'term' || type === 'terms') && isObj(body)) {
    const field = Object.keys(body)[0];
    return `looks for an exact value in ${field}`;
  }
  if (type === 'bool' && isObj(body)) {
    const parts: string[] = [];
    const describe: [string, string][] = [
      ['must', 'must match'],
      ['should', 'should match'],
      ['filter', 'must also pass'],
      ['must_not', 'must not match'],
    ];
    for (const [key, verb] of describe) {
      const arr = body[key];
      if (Array.isArray(arr) && arr.length > 0) {
        parts.push(`${verb} ${arr.length} condition${arr.length === 1 ? '' : 's'}`);
      }
    }
    return parts.length > 0 ? parts.join(', and ') : 'has no conditions';
  }
  return `uses a "${type}" clause`;
}

export function plainWordsForQuery(query: unknown): string {
  if (!isObj(query)) return 'This is not a query this tool can read.';
  return `Your query ${clauseSentence(query)}.`;
}

export interface QueryWarning {
  clause: string;
  field: string;
  message: string;
}

function collectTermFields(query: unknown, acc: { clause: string; field: string }[]): void {
  if (Array.isArray(query)) {
    query.forEach((item) => collectTermFields(item, acc));
    return;
  }
  if (!isObj(query)) return;
  for (const [key, value] of Object.entries(query)) {
    if ((key === 'term' || key === 'terms') && isObj(value)) {
      const field = Object.keys(value)[0];
      if (field) acc.push({ clause: key, field });
    } else {
      collectTermFields(value, acc);
    }
  }
}

// Warns when a term/terms clause (an exact-value match) targets a field mapped as text,
// which is split into words and almost never equals the typed value (R6.2).
export function queryWarnings(query: unknown, fields: Field[]): QueryWarning[] {
  const found: { clause: string; field: string }[] = [];
  collectTermFields(query, found);

  const warnings: QueryWarning[] = [];
  for (const { clause, field } of found) {
    const mapped = fields.find((f) => f.path === field);
    if (mapped && mapped.kind === 'text') {
      warnings.push({
        clause,
        field,
        message: `"${clause}" looks for an exact value, but ${field} is a text field that gets split into words. Use "match" instead, or query a keyword sub-field.`,
      });
    }
  }
  return warnings;
}
