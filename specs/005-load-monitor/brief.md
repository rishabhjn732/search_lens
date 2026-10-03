# Brief: load monitor

## The idea in simple words

One screen that shows how busy the cluster is right now: CPU, memory, disk, the search queue,
and the searches that are running. It updates by itself every few seconds.

## A real example

A query that normally takes 50 ms now takes 3 seconds. Before changing the query, the developer
opens the load monitor and sees that one node has a full search queue and is rejecting requests.
The problem is the cluster, not the query.

## OpenSearch APIs that will probably be needed

`_nodes/stats`, `_cat/thread_pool/search`, `_tasks`, `_nodes/hot_threads`, `<index>/_stats/search`,
`_cat/pending_tasks`. See `.claude/skills/opensearch-api/reference.md`.

## Questions to answer in the requirements

- How often does the screen update, and can the user pause it?
- The monitor itself puts load on the cluster. How do we keep that small?
- How much history is kept, and where? It is lost when the page closes?
- Which numbers get a warning colour, and at which values?
- What is shown when the cluster does not allow one of these calls?
