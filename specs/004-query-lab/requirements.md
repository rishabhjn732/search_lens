# Requirements: query lab

Status: approved

## Summary

Query lab is its own top-level page, next to Connect and Cluster overview, shown once the user
is connected. The left side is one block where the user writes a request the way OpenSearch's
own console accepts it — a line such as `GET products/_search` followed by the full JSON body,
pasted as-is. Toggles above the block turn Explain, Validate and Profile on or off. The right
side shows the result: the top 10 matching documents with a score picture, and for one chosen
document, its score explained in plain words, one step at a time. The user can also check one
document id to learn why it is missing, and see their query restated in plain words with
warnings about common mistakes. This replaces the version of spec 004 that put query lab inside
the index detail view's tabs — see "Changed from the first version" below.

## Requirements

### R1. Open the query lab

As a search engineer, I want to reach query lab on its own, without first opening a particular
index, so that I can jump straight to testing a query.

Acceptance criteria:

- R1.1 WHILE the user is connected THE SYSTEM SHALL show "Query lab" as a top-level choice, next
  to Connect and Cluster overview.
- R1.2 WHEN the user is not connected and opens Query lab THE SYSTEM SHALL show the connect
  screen first.
- R1.3 WHEN the user opens Query lab for the first time THE SYSTEM SHALL show an empty request
  block and no results.
- R1.4 WHEN the user navigates away and back without reloading the page THE SYSTEM SHALL keep
  the typed request, the toggle choices, and the last results.

### R2. Write a request as one block and run it

As a search engineer, I want to paste a request the way I would type it in a console, so that I
do not have to split it into an index field and a separate query field myself.

Acceptance criteria:

- R2.1 THE SYSTEM SHALL show one text block where the first line is a method and a path (for
  example `GET products/_search`) and the rest is the JSON body, exactly as OpenSearch's own
  console accepts it.
- R2.2 WHILE the user types THE SYSTEM SHALL lay the JSON part out with indenting, so it is easy
  to read.
- R2.3 WHEN the first line is not a method and a path ending in `_search`, or the JSON body is
  not valid, THE SYSTEM SHALL mark the block in red, say what is wrong (and where, for a JSON
  mistake), and SHALL NOT send anything to the cluster.
- R2.4 THE SYSTEM SHALL show three toggles above the block: Explain (on by default), Validate
  (off by default), and Profile (off by default).
- R2.5 WHEN the user chooses Run with a valid request THE SYSTEM SHALL send the body to the
  method and path from the first line, setting `explain` and `profile` to match the toggles, and
  asking for the top 10 hits.
- R2.6 WHEN the Validate toggle is on THE SYSTEM SHALL also send the body to
  `_validate/query?explain=true&rewrite=true` for that index, and show what came back next to
  the results.
- R2.7 WHEN the cluster rejects the request (valid JSON, but not something OpenSearch accepts)
  THE SYSTEM SHALL show the error message OpenSearch returned, in place of the results.
- R2.8 WHILE the request is running THE SYSTEM SHALL show that it is working and not accept a
  second Run.
- R2.9 WHEN the connection to the cluster is lost THE SYSTEM SHALL show that the connection is
  lost and offer to connect again (same wording as spec 001).

### R3. See the top matching documents

As a search engineer, I want to see which documents matched and a picture of how each one
scored, so that I can compare them at a glance.

Acceptance criteria:

- R3.1 WHEN a request runs successfully THE SYSTEM SHALL list up to 10 hits on the right side,
  ordered by score, each showing its id, its score, and a stacked bar broken into one coloured
  segment per matching field and word.
- R3.2 WHEN the request matches no document THE SYSTEM SHALL show "No documents matched this
  query." instead of an empty list.
- R3.3 WHEN the index has fewer than 10 matches, or more than 10, THE SYSTEM SHALL say how many
  documents matched in total, above the list.

### R4. Understand one document's score

As a search engineer, I want to open one matching document and see its score explained in plain
words, one step at a time, so that I can learn why it ranked where it did without reading a raw
score tree.

Acceptance criteria:

- R4.1 WHEN the user chooses a hit from the list THE SYSTEM SHALL show that document's top-level
  score breakdown first (one row per field or word that contributed).
- R4.2 WHEN the user opens one row THE SYSTEM SHALL show that term's rarity (`idf`), how much the
  word fills the field (`tf`), and its boost, each in one plain sentence, plus the next level of
  the score tree underneath it.
- R4.3 WHEN the user opens a deeper row THE SYSTEM SHALL reveal only that row's children, leaving
  sibling rows collapsed, so the tree grows one step at a time.
- R4.4 THE SYSTEM SHALL mark any field that was in the query but did not count toward the score
  (for example a field not chosen by `best_fields`) as "did not count", with a one-line reason.
- R4.5 THE SYSTEM SHALL list the filters (non-scoring clauses) the document passed, by name.
- R4.6 THE SYSTEM SHALL only offer R4.1-R4.5 when the Explain toggle (R2.4) was on for that run.

### R5. See why other documents did not match

As a search engineer, I want to check a document I expected to see and find out why it is
missing, so that I can fix the query or the data.

Acceptance criteria:

- R5.1 THE SYSTEM SHALL show a "Why the others did not match" section on the right side, below
  the hit list.
- R5.2 WHEN the user types or pastes a document id in that section THE SYSTEM SHALL show, in
  plain words, which part of the query the document failed (for example "the 'brand' filter
  requires 'nike', this document has 'adidas'").
- R5.3 WHEN the typed id does not exist in the index THE SYSTEM SHALL show "No document with id
  '<id>' in this index."

### R6. Understand the query itself

As a search engineer, I want a plain-English restatement of my query and a warning about common
mistakes, so that I can catch problems before I run it against production data.

Acceptance criteria:

- R6.1 WHEN the request block holds a valid request THE SYSTEM SHALL show a "Your query in plain
  words" box that restates the query clauses in one or two sentences.
- R6.2 WHEN the query uses a clause that usually does not work as expected on the chosen index's
  mapping (for example `term` on a field mapped as `text`) THE SYSTEM SHALL show a warning next
  to the request block naming the clause and the field.

## Changed from the first version

- Query lab moved from a tab on the index detail view (spec 002) to its own top-level page.
- The request box now takes the whole console-style request (method, path, full JSON body,
  including the body's own `"query"` key) instead of only the clause that goes inside `query`.
  This also fixes the earlier version sending a query wrapped twice.
- Explain, Validate and Profile are now visible toggles instead of being always sent.
- The visual design of the results side (score bars, score tree, filters, warnings) is to be
  redone for a clearer, more polished look; the first version's plain styling is not carried over
  as-is.

## Out of scope

- More than one request in the block at a time (the real OpenSearch console allows several,
  separated by blank lines; this tool only reads the first one).
- `#` comment lines inside the block.
- Any method or path other than `_search` and `_validate/query` for the same index (for example
  `_analyze` or `_cat`); the request line must point at `_search`.
- Picking a query from the cluster's stored search templates.
- The "Ask AI" button and any call to an AI service. See `ai-helper` in `specs/BACKLOG.md`.
- Comparing two queries side by side (see `compare-queries` in the backlog).
- Changing boost, `k1`, `b`, or any other scoring setting from the screen.
- Drawing the `profile` timing output as a timeline (see `profile-timeline` in the backlog);
  Profile can be turned on (R2.4) but its output is not drawn by this spec.
- Explaining more than 10 hits at once.
- Any call that writes, deletes, or changes the cluster.

## Open questions

- none
