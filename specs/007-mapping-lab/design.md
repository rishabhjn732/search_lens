# Design: mapping lab

Status: approved

## Overview

The Mapping lab is a new screen at `/mapping-lab`, with a "Mapping lab" link in the header.
It has four parts, top to bottom, like the approved prototype `prototypes/lab/mapping-lab.html`:
paste, fields, tests, create.

The work is split in three layers:

1. **Analysis in the browser** (`src/analysis/`): plain TypeScript with no React and no network.
   It reads the pasted JSON, lists the fields, finds each field's steps (a "chain": character
   filters, tokenizer, token filters), runs a close copy of those steps, compares tokens and gives
   the reason for a miss. It is a port of `prototypes/lab/analyzer.js`. The Token playground
   (spec 003) can use it later.
2. **Analysis on the cluster** (`src/opensearch/analyze.ts`): turns one chain and one text into
   one `POST /_analyze` call with the steps written inside the body, through the client of spec 001.
3. **The screen** (`src/screens/MappingLab/`): React components that draw the answers.

Both analysis sources give back the same shape: the raw answer of `_analyze` with
`"explain": true`. The screen does not know which source made it (frontend rule: draw from the raw
OpenSearch shape). A small runner sends the work to the chosen source: at most 4 at a time,
never the same chain and text twice, and it drops the old run when the definition changes.

Without a cluster the browser copy is used. With a cluster the cluster is used. The browser-only
mode does not need spec 001 tasks 4 to 8, so it is built first; the cluster mode is built after them.

## OpenSearch calls

| Purpose | Method and path | Important parameters |
|---|---|---|
| Tokens of one text through one chain, step by step | `POST /_analyze` | body: `text`, `explain: true`, `char_filter`, `tokenizer`, `filter`. Each step is a name (built in) or an object with `type` (custom, copied from the pasted `settings.analysis`). No index in the path, so nothing is needed or created on the cluster. |

The guard of spec 001 allows it: `POST` with a path that ends in `_analyze`.

Example request for the field `title` of the "Online shop" example:

```json
{
  "text": "Wi-Fi Router",
  "explain": true,
  "char_filter": ["html_strip", {"type": "mapping", "mappings": ["& => and"]}],
  "tokenizer": "whitespace",
  "filter": [
    {"type": "word_delimiter_graph", "preserve_original": true, "catenate_all": true},
    "lowercase", "asciifolding",
    {"type": "stemmer", "language": "english"}
  ]
}
```

Example response (shortened):

```json
{
  "detail": {
    "custom_analyzer": true,
    "charfilters": [{"name": "html_strip", "filtered_text": ["Wi-Fi Router"]}],
    "tokenizer": {"name": "whitespace", "tokens": [
      {"token": "Wi-Fi", "start_offset": 0, "end_offset": 5, "type": "word", "position": 0, "keyword": false}
    ]},
    "tokenfilters": [
      {"name": "__anonymous__word_delimiter_graph", "tokens": [
        {"token": "Wi-Fi", "position": 0}, {"token": "Wi", "position": 0},
        {"token": "WiFi", "position": 0}, {"token": "Fi", "position": 1}
      ]}
    ]
  }
}
```

Error example: a step that does not exist.

```json
{"error": {"root_cause": [{"type": "illegal_argument_exception",
  "reason": "failed to find global token filter under [foo]"}]}, "status": 400}
```

Notes:
- Custom steps come back with names like `__anonymous__stemmer`. The screen does not use these
  names. It matches answers to steps by order (tokenfilters[i] belongs to chain.filters[i]) and
  shows the names from the pasted definition.
- `"keyword": true` on a token means a `keyword_marker` protected it. The screen shows it as "protected".
- A built-in analyzer like `english` gives only its final tokens when sent by name. So built-in
  analyzers are sent as their documented parts (for `english`: standard tokenizer, then
  `stemmer/possessive_english`, `lowercase`, `stop/_english_`, `stemmer/english`), so every step shows.

## Analysis code (`src/analysis/`, new, no network)

| File | What it has |
|---|---|
| `types.ts` | `AnalyzeResponse` (the raw `_analyze` explain shape above), `Token`, `Chain` (`{ name, charFilters, tokenizer, filters, note? }`, each part `{ name, def, known }`), `Field` (`{ path, type, kind: 'text' \| 'keyword' \| 'other' \| 'object', parent?, indexAnalyzer?, searchAnalyzer?, normalizer? }`) |
| `engine.ts` | The browser copy: tokenizers (standard, whitespace, letter, lowercase, keyword, pattern, edge_ngram, ngram), character filters (html_strip, mapping, pattern_replace), token filters (lowercase, uppercase, asciifolding, stop, stemmer, porter_stem, kstem, keyword_marker, synonym, synonym_graph, word_delimiter, word_delimiter_graph, edge_ngram, ngram, shingle, trim, unique, length, truncate, apostrophe, elision, reverse, pattern_replace), each with one plain sentence. `analyzeInBrowser(chain, text): AnalyzeResponse` and the list of notes for steps it does not know (R7.3). `finalTokens(response)`. |
| `definition.ts` | `readDefinition(text)`: returns `{ name?, mappings, settings, analysis }` or `{ error: { line?, col?, message } }` (R1.2 to R1.4). A small JSON scanner finds the line, column and a plain message, because browsers do not say where JSON breaks. `listFields`, `chainFor(field, 'index' \| 'search')` (search order: field `search_analyzer`, index `default_search`, field `analyzer`, index `default`, `standard`), `checkDefinition` (R2.6 levels: `problem`, `warning`, `tip`), `createBody` (R6.2). |
| `compare.ts` | `compareTokens(saved, typed, 'any' \| 'all')`: `found`, `partly`, `not_found` or `nothing_left`; tokens at the same position count as one word (R3.5). `reasonFor(missingToken, savedTokens)`: one sentence and a fix name (R3.9). `plainChain(chain)`: the one sentence of R2.2. |
| `tests.ts` | The 100 tests in 10 lessons, and the three example definitions (R1.6, R3.1), copied from `prototypes/lab/samples.js`. |

## Cluster code (`src/opensearch/`)

| Function | What it calls | What it returns | Errors |
|---|---|---|---|
| `analyze.ts`: `analyzeOnCluster(request, chain, text, signal?)` | `request('POST', '/_analyze', body)` from spec 001 | `AnalyzeResponse` | The codes of spec 001. A `cluster_error` with an `error.root_cause[0].reason` keeps that reason. When the failing step has `synonyms_path`, `keywords_path`, `stopwords_path` or type `hunspell`, the message is "<step> reads a file on the server. Paste the words inline to test them here." (R7.2) |
| `analyze.ts`: `toAnalyzeBody(chain, text)` | none | the request body above | none |

## Runner (`src/screens/MappingLab/runner.ts`)

`createRunner(source, { parallel: 4 })` with `source(chain, text, signal) => Promise<AnalyzeResponse>`.

- `get(chain, text)`: returns the saved answer or starts one. The key is the chain's steps as JSON
  plus the text, so two fields with the same steps share answers (R4.3).
- At most 4 calls are open at once; the rest wait in a queue (R4.1).
- `progress`: `{ done, total }`, and a listener that fires when an answer arrives, so results show
  one by one (R4.1).
- `cancel()`: aborts open calls and empties the queue. A new definition or a new source makes a
  new runner (R4.2).
- The browser source answers at once, so in browser mode everything is ready in one go.

## Frontend

| Component | What it shows | Data it needs |
|---|---|---|
| `MappingLabScreen` | Page title, mode banner, the four parts, step links | the stored definition and own tests, `useConnection()` (spec 001) for the mode |
| `ModeBanner` | "Close copy …" or "Exact: tokens come from <cluster name>. Nothing is created." (R5.1, R5.2); after a lost connection "Use the close copy instead" (R5.4) | mode, cluster name |
| `PasteBox` | Text box, status line (R1.3, R1.5), Tidy and Clear (R1.7) | text, read result, problem count |
| `ExampleList` | Three examples with sentence and "best field finds n of 100" (browser copy) (R1.6) | examples |
| `FieldCards`, `FieldCard` | One card per field (R2.1 to R2.5, R2.7, R2.8), example text input, steps as coloured labels with a legend | fields, chains, runner answers for the example text |
| `ChecksList` | Problems, warnings, tips (R2.6) | `checkDefinition` |
| `TestGrid` | Lessons × fields with "n/10", shaded cells, scale, totals; buttons for cell, column, lesson (R3.3, R3.4); horizontal scroll on narrow screens | results per field and test |
| `MatchChoice` | "Any word" / "All words" with the sentence (R3.5) | choice |
| `TestSummary` | "The field … finds n of m", bar, legend, "What would help most" (R3.6, R3.7), progress while running (R4.1) | results of the chosen field and lesson |
| `TestList`, `TestRow`, `TestDetail` | Filters, rows of 30 with "Show more", reason line, open test with the two sides step by step and the raw answer (R3.8 to R3.10) | results, answers |
| `OwnTestForm` | Two inputs and "Add test"; own tests have Remove (R3.11) | own tests |
| `CreateIndex` | Name, Dev Tools / curl, Copy, the "never sends" note, plain list, refusal warning (R6.1 to R6.7) | `createBody`, `checkDefinition` |
| `labStore.ts` | Saves `{ definition, ownTests }` in browser storage under `searchlens.mappinglab.v1`; at most 200 own tests; same "Storage is full" sentence as spec 006 (R1.8, R3.11) | browser storage |
| `useLabResults` | Builds the runner for the mode, asks for every test × field × side, and gives results to the components | definition, mode, choice |

Styles: `mappinglab.css` in the screen folder, using the colours in `src/styles/theme.css`.
The header gets a "Mapping lab" link. Narrow screens (under 900 pixels) use one column (R3.12).

## Errors and empty states

| Situation | What the user sees |
|---|---|
| Empty paste box | "Paste an index definition, or pick an example." Earlier results are not shown. |
| Not valid JSON | "Cannot read this yet. Line n, column m: …" (R1.3); the last good result stays below |
| No `mappings.properties` | the R1.4 sentence |
| A field's analyzer, normalizer or step does not exist | Red line in the checks list; on the card the problem instead of tokens; the field is not in the grid (R2.7) |
| No text or keyword field | "This index has no text or keyword fields to test." instead of the grid |
| A filter shows no tests | "No tests here. Try another filter." |
| Cluster refuses one analysis | On that field's card and grid column: the reason (R5.3). Other fields go on. |
| Cluster cannot be reached during a run | The run stops; the badge of spec 001 shows "Connection lost"; the banner offers "Use the close copy instead" (R5.4) |
| Copy fails | "Could not copy. Select the text and copy it by hand." (R6.4) |
| Storage full | the spec 006 sentence; what is on screen stays |
| 200 own tests | "You have 200 own tests, the most allowed. Remove one to add another." |

## Decisions

- Send built-in analyzers as their parts, because sending the name gives no steps.
  Other option: send `{"analyzer": "english"}` (exact, but no step-by-step view).
- Match cluster answers to steps by order, not by name, because inline steps get anonymous names.
  Other option: name every step on the cluster (not possible without creating an index).
- One shared runner with a cache key of steps + text, because fields often share steps
  (`title` and `description`, or many keyword fields), which cuts the number of calls.
  Other option: one call per field and test (simple, but up to twice as many calls).
- Put the analysis code in `src/analysis/`, outside the screen, because the Token playground
  (spec 003) needs the same reading of mappings and the same browser copy.
  Other option: keep it in the screen folder and move it later.
- Port the prototype's logic to TypeScript and keep its tests' numbers as checks (for example,
  the "Online shop" `title` finds 78 of 100 and "Just the defaults" `title` finds 34 of 100 with
  the browser copy), so the port is shown to behave like the approved prototype.
  Other option: write the engine from scratch.
- No new libraries.

## Test plan

- Automatic (Vitest, no real cluster):
  - `engine.test.ts`: each tokenizer and filter on a small text; `"Wi-Fi Router"`, `"Café Crème"`,
    `"Sneakers for kids"` through the "Online shop" chain; unknown steps pass tokens through with a note.
  - `definition.test.ts`: the three accepted shapes; JSON errors with line and column
    (trailing comma, single quotes, missing brace); missing `mappings.properties`; `listFields`
    with objects and extra fields; search analyzer order; each check level; `createBody` cleanup.
  - `compare.test.ts`: any/all, synonyms at one position, `nothing_left`; one case per reason.
  - `tests.test.ts`: 10 lessons × 10 tests; the "best field" numbers of the examples (34, 53, 78).
  - `analyze.test.ts` with a fake `fetch`: the body for custom, built-in and inline steps;
    the guard allows `POST /_analyze`; the `cluster_error` reason; the R7.2 message.
  - `runner.test.ts`: never more than 4 open; the same key is asked once; `cancel()` drops late answers;
    progress counts.
  - `labStore.test.ts`: saved and read back; 200 limit; storage full sentence.
  - Component tests: paste a broken JSON and see line and column; pick an example; the grid cell
    filter; Any/All changes the numbers; open a test and see both sides; add and remove an own test
    and see it after a new render; the curl text has `-u` and no password; the banner text in both
    modes with a fake connection; with a fake cluster that fails one field, other fields still show.
- By hand (practice cluster in `dev/`):
  - Without connecting: open `/mapping-lab`, pick each example, check the numbers and that no
    network call is made (browser dev tools, Network tab).
  - Connected: the banner says "Exact"; the Network tab shows only `POST /_analyze`, never more
    than 4 at once; numbers are close to the browser copy; a filter `foo` shows the cluster's reason;
    a `synonyms_path` filter shows the R7.2 sentence.
  - Paste the `PUT` text into Dev Tools on the practice cluster and check that it creates the index.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `PasteBox` reads 350 ms after typing stops |
| R1.2 | `readDefinition` shapes; name passed to `CreateIndex` |
| R1.3 | `readDefinition` JSON scanner; `PasteBox` keeps last good result |
| R1.4 | `readDefinition` |
| R1.5 | `PasteBox` status line with `checkDefinition` count |
| R1.6 | `ExampleList`, `tests.ts`, browser copy |
| R1.7 | `PasteBox` |
| R1.8 | `labStore` |
| R1.9 | `src/analysis/` has no network; only `analyzeOnCluster` sends, and only steps and text |
| R2.1 | `listFields`, `FieldCards` |
| R2.2 | `FieldCard`, `plainChain`, step labels and legend |
| R2.3 | `FieldCard` compares index and search chains |
| R2.4 | `FieldCard` for keyword and other kinds |
| R2.5 | `FieldCards` example text input, runner |
| R2.6 | `checkDefinition`, `ChecksList` |
| R2.7 | `FieldCard`, `useLabResults` skips fields with problems |
| R2.8 | `FieldCard` count and "Test this field" |
| R3.1 | `tests.ts` |
| R3.2 | `useLabResults` |
| R3.3 | `TestGrid` |
| R3.4 | `TestGrid` buttons, screen state |
| R3.5 | `MatchChoice`, `compareTokens` |
| R3.6 | `TestSummary` |
| R3.7 | `TestSummary` counts `reasonFor` fix names |
| R3.8 | `TestList`, `TestRow` |
| R3.9 | `reasonFor`, `TestRow` |
| R3.10 | `TestDetail` |
| R3.11 | `OwnTestForm`, `labStore` |
| R3.12 | `mappinglab.css` |
| R4.1 | runner `parallel: 4`, progress, `TestSummary` |
| R4.2 | runner `cancel()`, new runner per definition |
| R4.3 | runner cache key |
| R5.1 | `ModeBanner`, browser source |
| R5.2 | `ModeBanner`, cluster source |
| R5.3 | `analyzeOnCluster` errors, `FieldCard` and `TestGrid` show them per field |
| R5.4 | `useLabResults` stops on `unreachable`/`timeout`; `ModeBanner` offer |
| R5.5 | route without a connection check |
| R6.1 | `CreateIndex` name input |
| R6.2 | `createBody` |
| R6.3 | `CreateIndex` formats |
| R6.4 | `CreateIndex` Copy |
| R6.5 | `CreateIndex` note |
| R6.6 | `CreateIndex` plain list |
| R6.7 | `CreateIndex` with `checkDefinition` |
| R6.8 | only `POST /_analyze` exists in this feature; the guard refuses `PUT` |
| R7.1 | `analyzeOnCluster` through `request` and the guard |
| R7.2 | `analyzeOnCluster` file-step message |
| R7.3 | `engine.ts` notes, `TestDetail` |
