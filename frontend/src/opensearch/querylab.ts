// Query lab reads (spec 004). All calls go through the request function the
// ConnectionProvider hands out, which already applies the read-only guard.
import { ClusterError } from "./errors";
import type { RawExplanationNode } from "../analysis/explain";

export type Request = (method: string, path: string, body?: unknown) => Promise<unknown>;
export type { RawExplanationNode };

export interface Hit {
  id: string;
  score: number;
  source: Record<string, unknown>;
  explanation: RawExplanationNode | null;
}

export interface QueryLabResult {
  total: number;
  hits: Hit[];
}

interface SearchResponseHit {
  _id: string;
  _score: number;
  _source?: Record<string, unknown>;
  _explanation?: RawExplanationNode;
}

interface SearchResponse {
  hits: {
    total: { value: number } | number;
    hits: SearchResponseHit[];
  };
}

// Runs the request exactly as parsed from the request block — path comes from its first line,
// body already has explain/profile/size applied by withToggles (R2.5). A browser's fetch cannot
// send a body on a GET request (it throws before any network call, which client.ts then
// reports as the cluster being unreachable), so GET is sent as POST instead — OpenSearch treats
// them the same for _search and _validate/query.
export async function runQuery(
  request: Request,
  method: string,
  path: string,
  body: unknown,
): Promise<QueryLabResult> {
  const effectiveMethod = method.toUpperCase() === "GET" ? "POST" : method;
  const response = (await request(effectiveMethod, path, body)) as SearchResponse;

  const totalRaw = response.hits.total;
  const total = typeof totalRaw === "number" ? totalRaw : totalRaw.value;

  const hits: Hit[] = response.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    source: hit._source ?? {},
    explanation: hit._explanation ?? null,
  }));

  return { total, hits };
}

export type ExplainDocResult =
  | { kind: "matched"; explanation: RawExplanationNode }
  | { kind: "not_matched"; explanation: RawExplanationNode }
  | { kind: "not_found" };

interface ExplainResponse {
  matched: boolean;
  explanation: RawExplanationNode;
}

// Checks one document id against the query, even when the search above did not return it
// (R5.2). A missing document (404) is reported as `not_found` rather than thrown (R5.3).
export async function explainDoc(
  request: Request,
  indexName: string,
  query: unknown,
  docId: string,
): Promise<ExplainDocResult> {
  let response: ExplainResponse;
  try {
    response = (await request("POST", `/${indexName}/_explain/${docId}`, {
      query,
    })) as ExplainResponse;
  } catch (err) {
    if (err instanceof ClusterError && err.status === 404) {
      return { kind: "not_found" };
    }
    throw err;
  }

  return response.matched
    ? { kind: "matched", explanation: response.explanation }
    : { kind: "not_matched", explanation: response.explanation };
}

export interface ValidateExplanation {
  index: string;
  valid: boolean;
  explanation?: string;
  error?: string;
}

export interface ValidateResult {
  valid: boolean;
  explanations: ValidateExplanation[];
}

interface ValidateResponse {
  valid: boolean;
  explanations?: ValidateExplanation[];
}

// Checks a query is well formed, shown alongside the search result when the Validate toggle
// is on (R2.6). The pasted body's extra keys (explain, profile, size) are harmless here —
// OpenSearch ignores keys this endpoint does not use.
export async function validateQuery(request: Request, index: string, body: unknown): Promise<ValidateResult> {
  const response = (await request(
    "POST",
    `/${index}/_validate/query?explain=true&rewrite=true`,
    body,
  )) as ValidateResponse;

  return { valid: response.valid, explanations: response.explanations ?? [] };
}
