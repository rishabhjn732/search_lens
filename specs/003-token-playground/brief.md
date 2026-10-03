# Brief: token playground

## The idea in simple words

The user types some text, picks an index and a field, and watches how the analyzer cuts the text
into tokens and changes them, one step at a time. The document side and the search side are shown
next to each other, and at the end the tool shows which tokens are equal.

## A real example

A customer searches for "shoe" and does not find the product "Running Shoes". The developer puts
both texts into the playground and sees that the document token is `shoes` and the search token is
`shoe`. They are not equal, so there is no match. The fix is a stemmer.

## What already exists

`prototypes/token-playground.html` is a working picture of this screen with a built-in sample analyzer.
The real screen keeps the look and the step player, and gets its data from the cluster instead.

## OpenSearch APIs that will probably be needed

`<index>/_analyze` with `"explain": true`, `<index>/_mapping`, `<index>/_settings`.
Read the notes about built-in analyzers in `.claude/skills/opensearch-api/reference.md`.

## Questions to answer in the requirements

- How does the user choose the analyzer: by field, by analyzer name, or both?
- What is shown when the field has a different `search_analyzer`?
- What is shown for a `keyword` field, which has no analyzer?
- How long may the text be?
- Is the raw API answer shown somewhere, for people who want to see it?
