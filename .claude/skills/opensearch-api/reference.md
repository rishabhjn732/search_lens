# OpenSearch API reference for Search Lens

Check each call against the official OpenSearch documentation for the cluster version in use.
This file is a working list for the project, not a full manual.

## Connection and cluster overview

| Purpose | Call |
|---|---|
| Version and cluster name | `GET /` |
| Health (green, yellow, red) | `GET /_cluster/health` |
| Index list with size and doc count | `GET /_cat/indices?format=json&bytes=b` |
| Fields and types | `GET /<index>/_mapping` |
| Analyzers and other settings | `GET /<index>/_settings` |
| Index templates | `GET /_index_template`, `GET /_component_template` |
| Aliases | `GET /_cat/aliases?format=json` |
| Nodes | `GET /_cat/nodes?format=json&h=name,ip,node.role,heap.percent,cpu,load_1m` |
| Shards | `GET /_cat/shards?format=json` |

## Text analysis (token playground)

`POST /<index>/_analyze` with body `{"field": "title", "text": "Running Shoes", "explain": true}`
or `{"analyzer": "my_analyzer", "text": "...", "explain": true}`.

- With a custom analyzer, `detail` has `charfilters`, `tokenizer`, and `tokenfilters`, each with its tokens.
- With a built-in analyzer such as `standard`, `detail` has only the final tokens under `analyzer`.
  To show every step, read the tokenizer and filters from `GET /<index>/_settings` and send them
  in the body as `tokenizer`, `filter`, and `char_filter`.
- The search-time analyzer can differ from the index-time one. Check `search_analyzer` in the mapping.

## Query lab

| Purpose | Call |
|---|---|
| Run a query with score details | `POST /<index>/_search` with `"explain": true` |
| Time spent per query part and shard | `POST /<index>/_search` with `"profile": true` |
| Check a query and see the rewrite | `POST /<index>/_validate/query?explain=true&rewrite=true` |
| Why one document matched or not | `POST /<index>/_explain/<doc_id>` with the query in the body |
| Fill a search template without running it | `POST /_render/template` |
| Run a stored search template | `POST /<index>/_search/template` |
| Read one stored template | `GET /_scripts/<id>` |
| Terms stored for one document | `GET /<index>/_termvectors/<doc_id>?fields=title` |
| Which fields exist and their types | `GET /<index>/_field_caps?fields=*` |

Notes:

- The `_explanation` tree in a hit is nested: each node has `value`, `description`, and `details`.
  Draw from this tree as it is.
- `profile` output is large. Ask for a small `size` when profiling.
- Scores are computed per shard. With little data and many shards, the same document can score
  differently than expected. The practice index uses one shard to avoid this.

## Load monitor

| Purpose | Call |
|---|---|
| CPU, heap, disk, thread pools per node | `GET /_nodes/stats/os,jvm,fs,thread_pool` |
| Search queue and rejected count | `GET /_cat/thread_pool/search?format=json&h=node_name,active,queue,rejected` |
| Searches running now | `GET /_tasks?actions=*search*&detailed=true` |
| What a busy node is doing | `GET /_nodes/hot_threads` (plain text) |
| Query count and total time per index | `GET /<index>/_stats/search` |
| Waiting cluster tasks | `GET /_cat/pending_tasks?format=json` |

Notes:

- Counters in `_stats` and `_nodes/stats` only go up. To show "searches per second", take two
  readings and divide the difference by the seconds between them.
- Some managed services block `_nodes/hot_threads` and a few other calls. Show a clear
  "not allowed on this cluster" message instead of an error.

## Read-only guard

Allowed without question: `GET`, `HEAD`.

`POST` is allowed only when the path ends with one of these:
`_search`, `_msearch`, `_count`, `_analyze`, `_validate/query`, `_search/template`,
`_render/template`, `_field_caps`, `_termvectors`, `_mtermvectors`, `_rank_eval`,
or matches `_explain/<doc_id>`.

Everything else is refused in the browser, before it is sent, with the code `read_only` and the message
"Search Lens is read-only. This call would change the cluster."
`PUT`, `DELETE`, and `PATCH` are always rejected.
