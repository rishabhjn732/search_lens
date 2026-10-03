# Requirements: mapping lab

Status: approved

## Summary

The user pastes an index definition (settings and mappings). Search Lens shows each field as a
picture: the steps that turn text into tokens when a document is saved, and when a search is typed.
Then it runs about 100 built-in test searches, in 10 lessons, against every text and keyword field,
and shows which are found, which are not, and what would help. At the end it shows the request that
creates the index, for the user to copy. The tool never sends that request.

It works without a cluster, using a close copy of OpenSearch analysis that runs in the browser.
When a cluster is connected, it asks the cluster for exact tokens instead. Nothing is created on
the cluster in either mode.

The look and behaviour follow `prototypes/lab/mapping-lab.html`, approved by the user on 2026-10-03.

## Words used here

| Word | Meaning |
|---|---|
| index definition | the JSON with `settings` and `mappings` that would be sent to create an index |
| saved tokens | the tokens a field makes from document text (index side) |
| typed tokens | the tokens a field makes from what a shopper types (search side) |
| test | one pair: a text saved in the index, and what a shopper types |
| lesson | a group of 10 tests about one problem, for example "Plurals and word forms" |
| found / partly found / not found | all / some / none of the typed tokens are in the saved tokens |

## Requirements

### R1. Paste an index definition

As a search engineer, I want to paste my index definition and be told clearly when it cannot be
read, so that I can test it before I create the index.

Acceptance criteria:

- R1.1 WHEN the user pastes or types an index definition THE SYSTEM SHALL read it without a button
  press, within one second after typing stops.
- R1.2 THE SYSTEM SHALL accept these shapes: `{settings, mappings}`, the answer of `GET /<index>`
  (one index name around `settings` and `mappings`), and `{mappings}` alone.
  WHEN the answer of `GET /<index>` is pasted THE SYSTEM SHALL use that index name in R6.
- R1.3 WHEN the text is not valid JSON THE SYSTEM SHALL show "Cannot read this yet. Line <n>, column
  <m>: <what is wrong>", in simple words (for example "Remove the comma before }."), and SHALL keep
  showing the last good result below.
- R1.4 WHEN the JSON has no `mappings.properties` THE SYSTEM SHALL say: "No "mappings.properties"
  found. Paste the body you would send to PUT /<index>, or the answer of GET /<index>."
- R1.5 WHEN the definition is read THE SYSTEM SHALL say how many fields and how many custom analyzers
  it found, and how many problems (R2.6) must be fixed.
- R1.6 THE SYSTEM SHALL offer three example definitions to start from ("Just the defaults",
  "English analyzers", "Online shop"), each with one sentence and how many of the 100 tests its best
  field finds.
- R1.7 THE SYSTEM SHALL offer "Tidy the JSON" (indent it) and "Clear".
- R1.8 THE SYSTEM SHALL keep the last pasted definition in this browser and show it again after a
  reload. WHEN nothing was pasted before THE SYSTEM SHALL show the "Online shop" example.
- R1.9 THE SYSTEM SHALL NOT send the pasted definition anywhere, except the analyzer parts sent for
  analysis in R7.

### R2. See each field as a picture

As a person who is new to search, I want to see what each field does to text, in pictures and plain
words, so that I understand my index without reading JSON.

Acceptance criteria:

- R2.1 THE SYSTEM SHALL show one card per field, including extra ways to save a field
  (`fields` inside a field, shown as "extra way to save <field>"), and fields inside objects with
  dotted names (`http.status`).
- R2.2 For a text field, the card SHALL show: one plain sentence that lists the steps (for example
  "Cut at spaces, then split at hyphens, then small letters, then cut to the root."), the steps as
  coloured labels in three colours (changes the text first / cuts into tokens / changes the tokens)
  with a legend, and the saved tokens of an example text.
- R2.3 WHEN a text field searches with other steps than it saves with THE SYSTEM SHALL show
  "Searching uses other steps", those steps, and the typed tokens of the same example text.
- R2.4 For a keyword field, the card SHALL say it is saved whole, and SHALL show its normalizer steps
  if it has one. For other types (numbers, dates, yes/no, nested) the card SHALL say in one sentence
  how they are found, and show no tokens.
- R2.5 WHEN the user changes the example text THE SYSTEM SHALL update the tokens on every card.
- R2.6 THE SYSTEM SHALL show a list of things to check, in three levels:
  problem (OpenSearch would refuse the index: an analyzer, normalizer, tokenizer or filter that is
  neither defined nor built in, or a custom analyzer without a tokenizer), warning (a filter that
  reads a file from the server disk, such as `synonyms_path` or Hunspell; or a step the browser copy
  does not know, see R7.3), and tip (a keyword field without a normalizer; a field that searches with
  other steps; no `number_of_shards`).
- R2.7 WHEN a field has a problem THE SYSTEM SHALL show the problem on its card instead of tokens,
  and SHALL leave it out of the tests.
- R2.8 Each card SHALL show how many tests the field finds, and a "Test this field" action that
  opens R3 for that field.

### R3. Test 100 searches

As a search engineer, I want to see at a glance which kinds of searches my index finds and misses,
so that I know what to fix first.

Acceptance criteria:

- R3.1 THE SYSTEM SHALL include 100 tests in 10 lessons of 10: plurals and word forms; big and small
  letters; accents and special letters; hyphens and joined words; numbers and units; little words
  (stop words); same meaning, other word; typos; half-typed words; brands, codes and symbols.
  Each lesson SHALL have one sentence that says what it teaches.
- R3.2 THE SYSTEM SHALL run every test against every text and keyword field without a problem.
- R3.3 THE SYSTEM SHALL show a grid with one row per lesson and one column per field. Each cell
  SHALL show "<found>/<tests>" with a background that gets darker as more are found, and a
  "0 found … all found" scale. A last row SHALL show the totals.
- R3.4 WHEN the user chooses a cell THE SYSTEM SHALL show that field and lesson below the grid;
  choosing a column name SHALL show that field with all lessons; choosing a lesson name SHALL
  show that lesson.
- R3.5 THE SYSTEM SHALL let the user choose "Any word" (one typed token found is enough, like a
  normal match query) or "All words" (every typed token must be found, like `"operator": "and"`),
  with one sentence that explains the choice. Tokens at the same position (synonyms) SHALL count as
  one word.
- R3.6 For the chosen field THE SYSTEM SHALL show "The field <name> finds <n> of <m> searches", and
  one bar split into found, partly found and not found, with a legend.
- R3.7 THE SYSTEM SHALL show "What would help most": up to four changes, each in one plain sentence,
  ordered by how many of the shown tests they would help.
- R3.8 THE SYSTEM SHALL list the tests, filtered by lesson and by All / Found / Partly / Not found,
  30 at a time with "Show more (<n> left)". Each row SHALL show: the result as a word and a colour,
  the lesson, the saved text with its saved tokens, and the typed text with its typed tokens.
  Typed tokens that are found SHALL be green, typed tokens that are missing SHALL be red; saved
  tokens SHALL be green when found and plain otherwise.
- R3.9 WHEN a test is not found or partly found THE SYSTEM SHALL show one reason in plain words and
  the name of the change that would help. The reasons SHALL cover at least: big and small letters
  (lowercase), accents (asciifolding), joined or split words (word_delimiter_graph), word forms
  (stemmer), the start of a word (edge_ngram), the middle of a word (ngram), a typo (fuzziness),
  every typed word removed (stop words), and no similar word (synonym).
- R3.10 WHEN the user opens a test THE SYSTEM SHALL show the saved side and the typed side next to
  each other, step by step: the original text, then each step with its name, one sentence about what
  it does, and its tokens marked as changed (with "was <old>"), new, synonym, protected or removed.
  THE SYSTEM SHALL also offer the raw analysis answer.
- R3.11 THE SYSTEM SHALL let the user add their own test (saved text and typed text). Own tests SHALL
  appear as a lesson "My tests", be kept in this browser after a reload, and each have a Remove action.
- R3.12 WHEN the window is narrower than 900 pixels THE SYSTEM SHALL show the test rows, the two
  sides of an open test, and the summary in one column, and let the grid scroll sideways.

### R4. Results while analysis is running

As a search engineer, I want the page to stay usable while 100 tests run on a cluster, so that I am
not left waiting without knowing why.

Acceptance criteria:

- R4.1 WHILE tests are running on the cluster THE SYSTEM SHALL show progress ("<done> of <total>")
  and SHALL show each result as soon as it is ready.
- R4.2 WHEN the definition changes while tests run THE SYSTEM SHALL stop the old run and start again.
- R4.3 THE SYSTEM SHALL NOT start the same analysis twice (same steps and same text).

### R5. Without and with a cluster

As a search engineer, I want to use the lab before I connect, and to get exact results when I am
connected.

Acceptance criteria:

- R5.1 WHEN no cluster is connected THE SYSTEM SHALL analyze in the browser and SHALL say at the top:
  "Close copy: tokens are made in this page and can differ a little from OpenSearch. Connect to a
  cluster for exact tokens."
- R5.2 WHEN a cluster is connected THE SYSTEM SHALL ask the cluster for the tokens of every test
  (R7) and SHALL say at the top: "Exact: tokens come from <cluster name>. Nothing is created."
- R5.3 WHEN the cluster refuses or fails an analysis call THE SYSTEM SHALL show the error for that
  field (the cluster's reason in simple words, for example "unknown filter type [foo]"), and SHALL
  NOT fall back to the browser copy for that field without saying so.
- R5.4 WHEN the cluster cannot be reached during a run THE SYSTEM SHALL stop the run, show the
  message of spec 001 R4.3, and offer "Use the close copy instead".
- R5.5 THE SYSTEM SHALL show the lab without asking the user to connect.

### R6. Create the index (copy only)

As a search engineer, I want the exact request that creates this index, so that I can run it myself
where I am allowed to.

Acceptance criteria:

- R6.1 THE SYSTEM SHALL show the request that creates the index with the pasted settings and
  mappings, for an index name the user can change (default "products", or the name from R1.2).
- R6.2 THE SYSTEM SHALL remove settings that OpenSearch sets by itself and refuses on create
  (`uuid`, `creation_date`, `version`, `provided_name`), and SHALL turn `settings.index.*` into
  `settings.*`.
- R6.3 THE SYSTEM SHALL offer two formats: Dev Tools (`PUT /<name>` and the body) and curl. The curl
  format SHALL NOT contain a password (it uses `-u <user>` so curl asks for it).
- R6.4 WHEN the user chooses Copy THE SYSTEM SHALL copy the text and say "Copied. Paste it in Dev
  Tools and press Run.", or say that copying failed and to select the text by hand.
- R6.5 THE SYSTEM SHALL say, next to the request: "Search Lens never sends this request. It is
  read-only."
- R6.6 THE SYSTEM SHALL list in plain words what the request creates: the name, the number of shards
  and copies, each custom analyzer as a sentence, and how many text, keyword and other fields.
- R6.7 WHEN the definition has a problem (R2.6) THE SYSTEM SHALL say that OpenSearch will refuse it.
- R6.8 THE SYSTEM SHALL NOT send the create request, or any other request that creates or changes
  something on the cluster.

### R7. Safety of analysis calls

As the owner of a cluster, I want the lab to only read, so that it is safe to use on a real cluster.

Acceptance criteria:

- R7.1 WHEN connected THE SYSTEM SHALL analyze with the analyze call that needs no index, with the
  character filters, tokenizer and token filters written inside the request. THE SYSTEM SHALL NOT
  create, change or delete an index for this, and every call SHALL pass the read-only guard
  (spec 001 R3).
- R7.2 WHEN a step reads a file from the server disk (`synonyms_path`, `keywords_path`,
  `stopwords_path`, Hunspell) THE SYSTEM SHALL still send it, and WHEN the cluster refuses it
  THE SYSTEM SHALL say: "<step> reads a file on the server. Paste the words inline to test them here."
- R7.3 WHEN no cluster is connected and a step is not known to the browser copy THE SYSTEM SHALL pass
  the tokens through unchanged, mark the step as "not copied", and say so in the open test (R3.10).

## Out of scope

- Using the user's saved word lists (spec 006) in the lab. Later, with the Token playground.
- Creating the index, or any other change to the cluster.
- Reading the definition of an index that already exists on the cluster (that is the index explorer,
  specs 002 and 004). The user can paste the answer of `GET /<index>` instead.
- Phrase, fuzzy and scoring behaviour. The lab compares tokens only; "fuzziness" is named as a fix,
  not tried.
- Editing the 100 built-in tests.
- Sharing results with a teammate.

## Open questions

None. Answered by the user on 2026-10-03 (all four proposals accepted):

- At most 4 analysis calls run at the same time against a cluster. A run has no extra limit;
  R4.2 and R4.3 keep it small.
- Own tests (R3.11) are limited to 200. At the limit, adding says
  "You have 200 own tests, the most allowed. Remove one to add another."
- When browser storage is full, saving the pasted definition or an own test shows the same message
  as spec 006 R4.3, and the page keeps working with what is on screen.
- The "best field finds" number for the examples (R1.6) always uses the browser copy, so it shows at once.
