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
