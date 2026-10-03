# Backlog

Ideas that do not have a spec yet. Use `/spec-new <name>` to start one.

- **home-page**: a home page before the Connect screen. The user chose the design in
  `prototypes/home/a-clean-lab.html` (2026-10-03). The user wants it as the first page of the
  React app, so add it to spec 001 (as `src/screens/Home/`) before task 2 is built.
- **custom-word-lists**: the user adds a protected words file, a synonyms file and a Hunspell
  dictionary, and the Token playground and Query lab use them during analysis. Read-only idea:
  send the lists inline in `_analyze` (`keyword_marker`, `synonym` filters); never store them on
  the cluster. Open question: Hunspell only reads dictionaries from the node's disk, so either
  pick one already on the cluster, or stem in the browser (not exact OpenSearch behaviour).
  Visual reference: the "Bring your own word lists" section in `prototypes/home/a-clean-lab.html`.
  A fourth list type, **entities** (the user's company has an `entity` file): a multi-word phrase
  such as `ai supplychain` is kept as one token and matches only as the exact phrase.
  A "Word lists" tab shows all saved lists with an on/off switch per file:
  `prototypes/home/a-word-lists.html`.
  Decided by the user (2026-10-03): saved lists live in the browser's `localStorage` for now
  (about 5 MB per site). Word lists are not secret, so this is allowed; passwords never go there.
  To handle in the spec: what happens when storage is full, lists are per browser (not shared
  with teammates, lost if browser data is cleared), and large Hunspell `.dic` files may not fit.
  Draft file checks (per type, with line numbers in the error) are in
  `prototypes/home/wordlists.js`, with good and bad test files in `prototypes/home/samples/`.
  Use them as a starting point for the spec's error cases.
  Open question: how entities map to OpenSearch (for example a `synonym_graph` rule
  `ai supplychain => ai_supplychain`, or a phrase query).
- **why-not-matched**: paste a document id that you expected to see, and the tool shows which
  part of the query failed for it.
- **compare-queries**: run two queries side by side and show which documents moved up or down.
- **what-if-sliders**: change boost, `k1` and `b` with sliders and recalculate the score in the
  browser, without changing the cluster.
- **mapping-warnings**: warn about common mistakes, for example a `term` query on a `text` field.
- **save-and-share**: one link that opens the same query, index and result for a teammate.
- **profile-timeline**: draw the `profile` output as a timeline per shard.
- **export-video**: export one explanation as a short video for sharing.
