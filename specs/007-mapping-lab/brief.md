# Brief: mapping lab

## The idea in simple words

The user pastes the mapping and settings of an index. Each field has its own analyzer, with
tokenizer and filters. Search Lens shows, in pictures that a non-technical person can follow, how
each field saves words (index side) and how it reads a search (search side), and runs a set of about
100 test searches against every field to show which are found and why the others are not.
At the end it shows the request that creates the index, for the user to copy and run themselves.

## A real example

A team is about to create a new `products` index. They paste their draft definition. The tool shows
that the `title` field finds 34 of 100 test searches: "wifi" does not find "Wi-Fi Router", "cafe"
does not find "Café Crème", "shoe" does find "Running Shoes". For each miss it says what would help
(word_delimiter_graph, asciifolding, a stemmer). They change the definition, see 78 of 100, and copy
the `PUT /products` request.

## What already exists

`prototypes/lab/mapping-lab.html` (approved by the user on 2026-10-03 as the look and behaviour),
with a simplified copy of analysis in `prototypes/lab/analyzer.js` and the 100 tests in
`prototypes/lab/samples.js`. Ideas and open points are under `mapping-lab` in `specs/BACKLOG.md`.

## OpenSearch APIs that will probably be needed

`POST /_analyze` with `char_filter`, `tokenizer` and `filter` given inline in the body, and
`"explain": true`. No index is needed and nothing is created. See
`.claude/skills/opensearch-api/reference.md`.

## Questions to answer in the requirements

- Does the lab need a connected cluster (exact results), or can it also run without one (close copy)?
- How many `_analyze` calls may run at once, and what does the user see while 100 tests × fields run?
- Filters that read files from the server disk (`synonyms_path`, Hunspell) cannot be sent inline.
  What does the user see for them?
- Are the user's own tests kept after a reload?
- Do the user's saved word lists (spec 006) take part?
