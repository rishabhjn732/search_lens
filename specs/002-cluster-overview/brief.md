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

## Added by the user (2026-10-03)

- Start with the **10 biggest indexes** (by size, switch to sort by documents), as a bar chart,
  with health shown as a word and a dot. Smaller and system indexes are counted, not listed.
- After choosing an index: its **fields** as a tree with a plain sentence per field and the
  analyzer steps as coloured pills, a "try it" box per field, and its **settings** as pictures
  (shards and copies on each server, unassigned copies in red, key settings in plain words).
- On the same page, a tab to **search and explain** (see 004).
- Prototype: `prototypes/lab/index-explorer.html`, tabs "Fields" and "Settings".
