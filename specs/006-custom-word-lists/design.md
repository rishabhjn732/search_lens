# Design: custom word lists

Status: approved

## Overview

All of this runs in the browser. There are no cluster calls in this spec.

The checks and the saving rules move from `prototypes/home/wordlists.js` into TypeScript, almost
unchanged, because the user tested them there. Screens read and change lists only through one
hook, `useWordLists()`. The hook tells every screen to redraw when a list changes, so the home
page boxes and the Word lists page always agree.

Real-life picture: a filing cabinet with four drawers (the four types). The clerk (`rules.ts`) reads
every page before it goes in a drawer and sends back pages with mistakes, marked by line.
The cabinet (`store.ts`) sits in this browser.

## Code (`src/wordlists/`)

| File | Job |
|---|---|
| `rules.ts` | `TYPES` (label, one/many words, accepted extensions, hint), `checkLine(type, line)`, `parseList(type, text)`, `parseHunspell(files)`, `normalise`. Pure functions, no browser objects. |
| `store.ts` | `createStore(storage: Storage)` with `load`, `list(type)`, `enabledEntries(type)`, `addFiles(type, files)`, `remove(id)`, `toggle(id)`, `addEntry(id, text)`, `removeEntry(id, entry)`, `reset()`, `used()`. Takes the storage as a parameter, so tests pass a fake one. Each change returns an error sentence or `null`. |
| `useWordLists.ts` | React hook over one shared store on `window.localStorage`. Redraws subscribers after each change. |
| `samples.ts` | The sample lists (R2.9), the same as the prototype. |

### Saved data

`localStorage` key `searchlens.wordlists.v1`:

```json
{ "files": [ { "id": "f…", "type": "entity", "name": "entity.txt", "enabled": true,
               "updated": 1791000000000, "entries": ["ai supplychain", "new york"] } ] }
```

Size shown = (key length + JSON length) × 2 bytes, because browsers count text in UTF-16.
A failed `setItem` (quota) becomes the "Storage is full" message (R4.3).

### Checks and messages

The messages are the prototype's, word for word. The main ones:

| Case | Message |
|---|---|
| Entity with one word | `"ai" is one word. An entity needs two or more words. Put single words in Protected words.` |
| Protected word with a space | `"running shoes" has a space. A protected word must be one word. Put phrases in Entities.` |
| Character not allowed | `"<word>" has a character that is not allowed. Use letters, numbers, - _ . or '.` |
| Synonym `=>` twice | `Use "=>" only once in a rule.` |
| Synonym side empty | `Put words on both sides of "=>", for example: tv => television` |
| Synonym `a,,b` | `There is an empty word between commas. Remove the extra comma.` |
| Synonym one word | `"sofa" has only one word. Write two or more words with commas, for example: couch, sofa` |
| Duplicate line | `"<line>" is already on line <m>. Kept once.` (warning) |
| No entries | `The file has no entries. Lines that start with # are comments.` |
| Wrong extension | `<name>: this list needs a .txt file.` (or `.aff or .dic`) |
| Empty file | `<name> is empty.` |
| Too big | `The file is <size>. The limit is <limit>. Split it into smaller files.` |
| Not text | `<name> does not look like a text file. Save it as UTF-8 text and try again.` |
| Hunspell pair | `Choose two files together: one .aff and one .dic, for example en_US.aff and en_US.dic.` |
| Hunspell names | `The names do not match: <a> and <b>. Use two files for the same language.` |
| Hunspell `.aff` | `<name> has no SET, PFX or SFX lines. Is it a Hunspell .aff file?` |
| Hunspell `.dic` line 1 | `<name>, line 1: the first line must be the number of words, for example 49000.` |
| Hunspell count | `<name> says <n> words on line 1, but has <m>. Saved anyway.` (warning) |
| Duplicate entry | `"<entry>" is already in <file>.` |
| Last entry | `This is the last entry. Remove the whole file instead.` |
| Storage full | `Storage is full. Saving needs about <size>, and the browser allows about 5.0 MB. Remove a list and try again.` |

## Screens

| Component | What it shows | Data it needs |
|---|---|---|
| `WordListsScreen` (`src/screens/WordLists/`, address `/word-lists`, `#entity` etc. opens a tab) | Title, storage bar, four count tiles, four tabs | `useWordLists()` |
| `FilesBox` | Saved files with switch and Remove, "Add file" (Hunspell: "Add .aff + .dic"), the result message, the help text for the type | same |
| `EntriesBox` | Chosen file's entries (20, filter), Remove per entry, Add box (not for Hunspell) | same |
| `EntityTry` | Text box, "normal" and "with entities" token rows, the result sentence; plus the "ai + supplychain" picture | enabled entities |
| `WordListsSection` (`src/screens/Home/`) | The four upload boxes and the "iPhone sneakers" picture | `useWordLists()` |
| `AppHeader` | New menu link "Word lists" | none |

Remove uses the browser's `window.confirm`, like the prototype. Tests replace it with a fake.

The look (colours, the purple for entities, dashed upload boxes, switches) is copied from the two
prototypes into `wordlists.css` and the home page CSS. Movement stops with reduced motion.

## Decisions

- **Rules copied from the prototype**, because the user tested them; changing wording would need a
  spec change. Other option: rewrite the checks from scratch.
- **Store takes `Storage` as a parameter**, so tests use a fake storage and check "storage full".
  Other option: tests touch jsdom's real `localStorage`.
- **Sample lists on first visit** (R2.9), like the prototype, so the page and the entity "try it"
  are not empty. Other option: start empty with a "Load sample lists" button.
- **Text is saved in lower case**, like the prototype. Other option: keep case (OpenSearch's
  `keyword_marker` has an `ignore_case` setting).

## Test plan

All tests run in jsdom with a fake storage or jsdom's `localStorage`, and `File` objects made in the test.

- Rules: every row of the messages table; good files from `prototypes/home/samples/` give the right
  count; bad ones give the right line numbers.
- Store: save, replace keeps on/off, toggle, remove, add entry (good, bad, duplicate), remove entry,
  last entry refused, reset, storage full (fake storage that throws), reload keeps data (new store
  on the same storage).
- Word lists page: tabs and counts; add a good file → listed and message shown; add a bad file →
  not listed, line numbers shown; Remove with confirm yes → gone, with confirm no → still there;
  switch off → shown as off and not used by "try it"; entries filter; add and remove entry;
  Hunspell has no add box; "try it" joins `ai supplychain`; no `fetch` call.
- Home section: four boxes; upload good file → "✓ Saved" and link to `/word-lists#<type>`;
  bad file → "✕ Not saved."; header has "Word lists".
- By hand: compare both screens with the prototypes; upload the sample files; reload and check the
  lists are still there; reduce motion.

## Coverage

| Criterion | Handled by |
|---|---|
| R1.1 | `store.addFiles`, `FilesBox` message |
| R1.2 | `rules.parseList`, `FilesBox` message list (5 + "more") |
| R1.3 | `parseList` duplicates warning |
| R1.4 | `parseList` skips empty and `#`; "no entries" |
| R1.5 | `addFiles` extension, size, empty and text checks |
| R1.6 | `addFiles` replace by name and type |
| R1.7 | `rules.parseHunspell` |
| R2.1 | `WordListsScreen` tabs and tiles, header link |
| R2.2 | `FilesBox` |
| R2.3 | `store.toggle`, switch |
| R2.4 | `store.remove` after `window.confirm` |
| R2.5 | `EntriesBox` filter and first 20 |
| R2.6 | `store.addEntry` |
| R2.7 | `store.removeEntry` |
| R2.8 | `EntriesBox` without add or remove for Hunspell |
| R2.9 | `samples.ts`, `store.reset` |
| R3.1 to R3.3 | `EntityTry` |
| R4.1 | `localStorage` key `searchlens.wordlists.v1` |
| R4.2 | `store.used`, storage bar |
| R4.3 | `setItem` failure → "Storage is full" |
| R4.4 | no network code in `src/wordlists/`; test that no `fetch` happens |
| R5.1 to R5.3 | `WordListsSection` |
