# Brief: cluster overview

## The idea in simple words

After connecting, the user wants one screen that answers "what is in this cluster?".
It shows the indexes, the fields of each index, the analyzers, the templates, and the nodes.

## A real example

A developer joins a new team. The search index is called `products_v7`. Nobody remembers which
analyzer the `title` field uses. The developer opens the overview, clicks the index, and sees
`title: text, analyzer product_text` and what `product_text` is made of.

## OpenSearch APIs that will probably be needed

`_cat/indices`, `<index>/_mapping`, `<index>/_settings`, `_index_template`, `_component_template`,
`_cat/aliases`, `_cat/nodes`, `_cat/shards`. See `.claude/skills/opensearch-api/reference.md`.

## Questions to answer in the requirements

- A cluster can have thousands of indexes. How does the user find one? Search box, paging, both?
- Are system indexes (names starting with a dot) shown or hidden at first?
- Nested and object fields: shown as a tree, or as a flat list with dotted names?
- When is the data loaded again? Only on a Refresh button, or by itself?
- What does the user see when they are not allowed to read one of the APIs?
