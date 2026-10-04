// Cluster overview reads (spec 002). All calls go through the request function the
// ConnectionProvider hands out, which already applies the read-only guard.
import { listFields, resolveAnalyzer, type ChainResult } from "../analysis/definition";
import type { AnalyzeResponse, Chain, Field, StepDef } from "../analysis/types";
import { ClusterError } from "./errors";

export type Request = (method: string, path: string, body?: unknown) => Promise<unknown>;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Json => (isObj(v) ? v : {});

function asClusterError(err: unknown): ClusterError {
  return err instanceof ClusterError ? err : new ClusterError("cluster_error", String(err));
}

export interface IndexSummary {
  name: string;
  health: string;
  docsCount: number;
  sizeBytes: number;
  isSystem: boolean;
}

interface CatIndexRow {
  index: string;
  health: string;
  "docs.count": string | null;
  "store.size": string | null;
}

export async function listIndexSummaries(request: Request): Promise<IndexSummary[]> {
  const rows = (await request(
    "GET",
    "/_cat/indices?format=json&bytes=b&h=index,health,status,docs.count,store.size",
  )) as CatIndexRow[];

  return rows
    .map((row) => ({
      name: row.index,
      health: row.health,
      docsCount: Number(row["docs.count"] ?? 0),
      sizeBytes: Number(row["store.size"] ?? 0),
      isSystem: row.index.startsWith("."),
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);
}

export interface IndexSettings {
  shards: number;
  replicas: number;
  refreshInterval: string;
}

export interface IndexDetail {
  fields: Field[] | null;
  fieldsError: ClusterError | null;
  // One resolved analyzer chain per analyzer name used by a text field. A field whose
  // analyzer could not be resolved is left out; FieldTree (task 5) shows that field's
  // row with no pills rather than failing the whole tree (R4.5).
  analyzers: Record<string, Chain>;
  settings: IndexSettings | null;
  settingsError: ClusterError | null;
}

function readIndexSettings(indexSettings: Json): IndexSettings {
  return {
    shards: Number(indexSettings.number_of_shards ?? 1),
    replicas: Number(indexSettings.number_of_replicas ?? 0),
    refreshInterval: String(indexSettings.refresh_interval ?? "1s"),
  };
}

// Reads _mapping and _settings on their own, so a forbidden answer from one leaves the
// other's data usable (R7.1, R4.1-R4.3, R5.3).
export async function getIndexDetail(request: Request, name: string): Promise<IndexDetail> {
  const [mappingResult, settingsResult] = await Promise.allSettled([
    request("GET", `/${name}/_mapping`),
    request("GET", `/${name}/_settings`),
  ]);

  const settingsError =
    settingsResult.status === "rejected" ? asClusterError(settingsResult.reason) : null;
  const indexSettings =
    settingsResult.status === "fulfilled"
      ? obj(obj(obj(settingsResult.value)[name]).settings).index
      : {};
  const analysis = obj(indexSettings).analysis;
  const settings = settingsResult.status === "fulfilled" ? readIndexSettings(obj(indexSettings)) : null;

  if (mappingResult.status === "rejected") {
    return {
      fields: null,
      fieldsError: asClusterError(mappingResult.reason),
      analyzers: {},
      settings,
      settingsError,
    };
  }

  const mappingBody = obj(mappingResult.value);
  const mappings = obj(obj(mappingBody[name]).mappings);

  const fields = listFields(mappings, obj(analysis));

  // Resolves both the save-time and search-time analyzer for every field — a field can use
  // a different analyzer to search than it used to save (e.g. one that adds synonyms), and
  // that search-time chain must be shown too, not just the save-time one.
  const analyzers: Record<string, Chain> = {};
  for (const field of fields) {
    for (const analyzerName of [field.indexAnalyzer, field.searchAnalyzer]) {
      if (!analyzerName || analyzerName in analyzers) continue;
      const resolved: ChainResult = resolveAnalyzer(analyzerName, obj(analysis));
      if (!("error" in resolved)) {
        analyzers[analyzerName] = resolved;
      }
    }
  }

  return { fields, fieldsError: null, analyzers, settings, settingsError };
}

interface CatShardRow {
  index: string;
  shard: string;
  prirep: "p" | "r";
  state: string;
  node: string | null;
}

export interface ShardBox {
  shard: string;
  kind: "primary" | "replica";
  assigned: boolean;
}

export interface NodeShards {
  node: string | null;
  shards: ShardBox[];
}

export type ShardLayout = NodeShards[];

// Groups one index's shard copies by node (R5.1), marking UNASSIGNED copies (R5.2).
export async function getShardLayout(request: Request, name: string): Promise<ShardLayout> {
  const rows = (await request(
    "GET",
    "/_cat/shards?format=json&h=index,shard,prirep,state,node",
  )) as CatShardRow[];

  const byNode = new Map<string | null, ShardBox[]>();
  for (const row of rows) {
    if (row.index !== name) continue;
    const node = row.node ?? null;
    const box: ShardBox = {
      shard: row.shard,
      kind: row.prirep === "p" ? "primary" : "replica",
      assigned: row.state !== "UNASSIGNED",
    };
    const existing = byNode.get(node);
    if (existing) {
      existing.push(box);
    } else {
      byNode.set(node, [box]);
    }
  }

  return Array.from(byNode.entries()).map(([node, shards]) => ({ node, shards }));
}

export interface PlaygroundSpec {
  tokenizer: string;
  charFilters: string[];
  // Each entry is a cluster filter's real name, except one entry that may be an inline
  // StepDef when the user chose "Use a saved list" for that step (R10.3).
  filters: (string | StepDef)[];
  text: string;
}

// Runs the field playground's current chain for real (R9.4, R10): the `filter` array can be
// given in any order and can mix named cluster filters with an inline override, so a
// cluster-only filter (a hand-named synonym or stop filter) shows its real effect instead of
// an unknown passthrough.
export async function analyzePlaygroundStep(
  request: Request,
  name: string,
  spec: PlaygroundSpec,
): Promise<AnalyzeResponse> {
  return (await request("POST", `/${name}/_analyze`, {
    tokenizer: spec.tokenizer,
    char_filter: spec.charFilters,
    filter: spec.filters,
    text: spec.text,
    explain: true,
  })) as AnalyzeResponse;
}
