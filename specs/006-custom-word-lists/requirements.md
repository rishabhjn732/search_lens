# Requirements: custom word lists

Status: approved

## Summary

The user saves their own word lists in Search Lens: entities, protected words, synonyms and a
Hunspell dictionary. Each file is checked line by line before it is saved, and problems are shown
with line numbers. Saved lists can be turned on and off, edited and removed on a "Word lists" page.
The home page has a section to add files. The look and behaviour follow
`prototypes/home/a-clean-lab.html` (section "Bring your own word lists") and
`prototypes/home/a-word-lists.html`.

Lists are saved in this browser only and are never sent to the cluster by this feature.
Using the lists during analysis comes with the Token playground and Query lab specs.

## The four list types

| Type | One line is | Good example | Bad example and why |
|---|---|---|---|
| Entities | two or more words that form one token | `ai supplychain` | `ai`: only one word |
| Protected words | one word the stemmer must not change | `iphone` | `running shoes`: has a space |
| Synonyms | `a, b, c` (same meaning) or `a, b => c` (replace) | `tv => television` | `tv =>`: nothing after `=>` |
| Hunspell | a `.aff` file and a `.dic` file for one language | `en_US.aff` + `en_US.dic` | `en_US.aff` + `de_DE.dic`: names differ |

Words may use letters, numbers and `- _ . '`. All text is saved in lower case.

## Requirements

### R1. Add a file

As a search engineer, I want to add my company's word list files and be told exactly what is wrong
with them, so that I can fix them before I rely on them.

Acceptance criteria:

- R1.1 WHEN the user chooses a file for a list type and every line is fine THE SYSTEM SHALL save it
  and show "Saved <file name>: <count> <entities|words|rules>."
- R1.2 WHEN one or more lines break the rule for the list type THE SYSTEM SHALL NOT save the file
  and SHALL show "Not saved. <file name> has <n> problem(s):" with, for each problem, the line number
  and a sentence that says what to fix. At most 5 problems are listed, then "… and <n> more."
- R1.3 WHEN the same line appears more than once THE SYSTEM SHALL keep it once, save the file,
  and show a warning: "Line <n>: "<line>" is already on line <m>. Kept once."
- R1.4 THE SYSTEM SHALL skip empty lines and lines that start with `#`. WHEN no entries are left
  THE SYSTEM SHALL NOT save the file and SHALL show
  "The file has no entries. Lines that start with # are comments."
- R1.5 WHEN the file has the wrong extension, is empty, is larger than the limit (1 MB for a list,
  4 MB for a Hunspell pair), or is not text THE SYSTEM SHALL NOT save it and SHALL say which of these it is.
- R1.6 WHEN a file with the same name and type is already saved THE SYSTEM SHALL replace it, keep its
  on/off setting, and say "Replaced" instead of "Saved".
- R1.7 WHEN the user chooses a Hunspell `.aff` and `.dic` together THE SYSTEM SHALL check that there
  is exactly one of each, that their names match, that the `.aff` has a `SET`, `PFX` or `SFX` line,
  and that line 1 of the `.dic` is a number; and SHALL warn (but save) when that number differs from
  the number of words.

### R2. Manage saved lists

As a search engineer, I want one place that shows all my lists, so that I can see and change
what Search Lens will use.

Acceptance criteria:

- R2.1 THE SYSTEM SHALL have a "Word lists" page, reachable from the header, with four tabs
  (Entities, Protected words, Synonyms, Hunspell), a count on each tab, and four count tiles.
- R2.2 THE SYSTEM SHALL list each saved file of the chosen type with its name, its number of entries,
  when it was last changed, an on/off switch and a Remove button.
- R2.3 WHEN the user turns a file off THE SYSTEM SHALL keep the file and show it as off.
- R2.4 WHEN the user chooses Remove THE SYSTEM SHALL ask "Remove <file name>? Its <count> <entries>
  will be deleted from this browser." and delete the file only if the user agrees.
- R2.5 WHEN the user chooses a file name THE SYSTEM SHALL show its entries, the first 20 that match
  a filter box, and how many there are.
- R2.6 WHEN the user adds an entry THE SYSTEM SHALL check it with the rules of its type and add it at
  the top, or show the problem and keep the typed text. A duplicate entry SHALL be refused.
- R2.7 WHEN the user removes an entry THE SYSTEM SHALL remove it. WHEN it is the last entry
  THE SYSTEM SHALL refuse and say "This is the last entry. Remove the whole file instead."
- R2.8 Hunspell words SHALL NOT be added or removed one by one; the page says to change the file
  and add it again.
- R2.9 WHEN nothing has been saved yet THE SYSTEM SHALL show sample lists, and a
  "Reset sample data" button SHALL, after the user agrees, delete all lists and load the samples again.

### R3. Try entities

As a search engineer, I want to type text and see which words join into one entity token,
so that I can check my entity list.

Acceptance criteria:

- R3.1 WHEN the user types text on the Entities tab THE SYSTEM SHALL show the words as tokens, and
  below them the tokens with entities joined into one, using only files that are on.
- R3.2 WHEN two entities overlap THE SYSTEM SHALL use the longest one.
- R3.3 THE SYSTEM SHALL say how many tokens became how many, or that no entity was found,
  or that no entity file is on.

### R4. Storage

As a search engineer, I want my lists to stay after I close the browser, and to know when
space runs out.

Acceptance criteria:

- R4.1 THE SYSTEM SHALL keep saved lists in this browser after a reload.
- R4.2 THE SYSTEM SHALL show how much storage the lists use, out of about 5 MB.
- R4.3 WHEN saving would go over the browser's limit THE SYSTEM SHALL NOT save and SHALL show
  "Storage is full. … Remove a list and try again."
- R4.4 THE SYSTEM SHALL NOT send the lists over the network.

### R5. Home page section

As a search engineer who opens the tool, I want to add a list right from the home page.

Acceptance criteria:

- R5.1 THE SYSTEM SHALL show a "Bring your own word lists" section on the home page with four boxes
  (Entities, Protected words, Synonyms, Hunspell dictionary), each with a short example of its file.
- R5.2 WHEN the user chooses a file in a box THE SYSTEM SHALL check and save it by the R1 rules and
  show the result in the box: on success "✓ Saved …" and a link "See it in Word lists" that opens the
  page on that tab; on failure "✕ Not saved." with the first problem.
- R5.3 THE SYSTEM SHALL show the "iPhone sneakers" example: without lists, with lists, and a legend.

## Out of scope

- Using the lists in `_analyze` or searches. That is part of the Token playground and Query lab specs.
- How Hunspell will be applied (dictionaries on the cluster or in the browser). Still open in BACKLOG.
- Sharing or exporting lists, and lists for more than one browser.
- Creating a new empty list in the page (add a file instead).
