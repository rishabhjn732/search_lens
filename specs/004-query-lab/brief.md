# Brief: query lab

## The idea in simple words

The user picks an index, picks a search template or writes a query, runs it, and sees the results.
For every result the tool shows why it matched and how its score was built, as a picture.

## A real example

For the search "nike shoes", product A is ranked above product B, and the business wants B first.
The developer opens both results. The picture shows that A wins because "nike" is in its title,
and the title has boost 2. Now the developer knows what to change.

## OpenSearch APIs that will probably be needed

`_search` with `explain` and with `profile`, `_validate/query`, `_explain/<id>`,
`_render/template`, `_search/template`, `_scripts/<id>`.
See `.claude/skills/opensearch-api/reference.md`.

## Questions to answer in the requirements

- This is a big feature. Should it be split into smaller specs (run and list, score picture, timing)?
- How does the user find the stored search templates?
- The score explanation is a deep tree. How much is shown first, and how does the user open more?
- How are numbers like `idf` and `tf` explained to someone who does not know them?
- What happens with a query that is not valid?
- How many results are explained at once?

## Added by the user (2026-10-03)

- The query box sits on the same page as the index overview (002), as a third tab.
- Each hit gets a stacked score bar, one colour per word and field; the chosen hit gets a panel
  that explains rarity (idf), how much the word fills the field (tf) and boost in plain words,
  marks the fields that did not count in `best_fields`, and lists the filters it passed.
- "Why the others did not match" lists each document that missed, with the reason.
- A "your query in plain words" box, and warnings for common mistakes (`term` on a text field).
- An optional "Ask AI" button, off by default: see `ai-helper` in `specs/BACKLOG.md`.
- Prototype: `prototypes/lab/index-explorer.html`, tab "Search and explain".
