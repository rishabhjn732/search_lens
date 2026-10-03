# Requirements: cluster overview

Status: approved

## Summary

After connecting, the user sees one screen that answers "what is in this cluster?". It shows the
biggest indexes as a bar chart, lets the user open any index to see its fields and settings, and
lets the user search for an index by name. The screen loads once and again only when the user asks.

## Requirements

### R1. Open the overview after connecting

As a search engineer, I want the tool to take me straight to the cluster overview once I am
connected, so that I do not have to find it myself.

Acceptance criteria:

- R1.1 WHEN the connect screen reports a successful connection THE SYSTEM SHALL show the cluster
  overview screen.
- R1.2 WHEN the user chooses the Cluster overview card on the home page while already connected
  THE SYSTEM SHALL show the cluster overview screen without connecting again.

### R2. See the biggest indexes

As a search engineer, I want to see the biggest indexes first, so that I find what matters without
digging through thousands of small ones.

Acceptance criteria:

- R2.1 WHEN the overview screen loads THE SYSTEM SHALL show the 10 largest indexes by storage size
  as a bar chart, each bar labelled with the index name, its size, and its health as a word and a
  coloured dot.
- R2.2 WHEN the user switches the sort to "by documents" THE SYSTEM SHALL redraw the same 10-index
  chart ordered by document count instead of size.
- R2.3 THE SYSTEM SHALL NOT list indexes whose name starts with a dot (system indexes) in the chart,
  and SHALL show how many such indexes exist as a count.
- R2.4 THE SYSTEM SHALL show how many indexes exist beyond the top 10 as a count.
- R2.5 WHEN there are no indexes on the cluster THE SYSTEM SHALL show "This cluster has no indexes
  yet." instead of an empty chart.

### R3. Find any index by name

As a search engineer, I want to find an index that is not one of the 10 biggest, so that I can
inspect any index on the cluster.

Acceptance criteria:

- R3.1 THE SYSTEM SHALL show a search box above the chart.
- R3.2 WHEN the user types in the search box THE SYSTEM SHALL show a list of index names
  (including system indexes) that contain the typed text, updated as the user types.
- R3.3 WHEN the user chooses an index from the search results or from the chart THE SYSTEM SHALL
  open that index's detail view (R4, R5).
- R3.4 WHEN the typed text matches no index name THE SYSTEM SHALL show "No index matches
  '<text>'."

### R4. See an index's fields

As a search engineer, I want to see an index's fields and how each one is analyzed, so that I can
explain why a search did or did not match.

Acceptance criteria:

- R4.1 WHEN the user opens an index THE SYSTEM SHALL show its fields as a tree, with nested and
  object fields shown as branches under their parent.
- R4.2 THE SYSTEM SHALL describe each field in one plain sentence, naming the field by its full
  path (for example: "title is text, analyzed with product_text"; "address.city is keyword").
- R4.3 WHEN a field has an analyzer THE SYSTEM SHALL show the analyzer's steps as a row of
  coloured pills (for example: lowercase, then stop words, then stemming).
- R4.4 THE SYSTEM SHALL show a "Try it" button next to each analyzed field. Choosing it opens
  the field's analyzer playground (R9).
- R4.5 WHEN the mapping has more than one type for the same field name across the index's types
  or when a field cannot be read THE SYSTEM SHALL show "This field could not be read." for that
  field and continue showing the rest of the tree.

### R5. See an index's settings

As a search engineer, I want to see an index's shard layout and key settings in pictures, so that
I can judge its health without reading raw JSON.

Acceptance criteria:

- R5.1 WHEN the user opens the Settings tab for an index THE SYSTEM SHALL show a picture of its
  shards and replicas placed on each node.
- R5.2 THE SYSTEM SHALL mark any unassigned shard copy in red.
- R5.3 THE SYSTEM SHALL show the index's key settings (number of shards, number of replicas,
  refresh interval) in plain words next to the picture.

### R6. Reload on request

As a search engineer, I want to control when the overview re-reads the cluster, so that I am not
surprised by data changing under me.

Acceptance criteria:

- R6.1 WHEN the overview screen first opens THE SYSTEM SHALL load the index list once.
- R6.2 THE SYSTEM SHALL show a Refresh button.
- R6.3 WHEN the user chooses Refresh THE SYSTEM SHALL reload the index list and, if an index
  detail view is open, that index's fields and settings.
- R6.4 THE SYSTEM SHALL NOT reload any data by itself (no timer, no polling).

### R7. Missing permission

As a search engineer connected with a restricted user, I want to still use the parts of the
overview I am allowed to see, so that one blocked API does not block the whole screen.

Acceptance criteria:

- R7.1 WHEN one API call needed by the overview is refused for lack of permission THE SYSTEM
  SHALL show "You do not have permission to see this." in that part of the screen only, and SHALL
  keep the rest of the screen working.
- R7.2 WHEN the index list itself cannot be read for lack of permission THE SYSTEM SHALL show
  "This user cannot read the list of indexes." for the whole screen.

### R8. Loading and errors

As a search engineer, I want to know when the screen is working or has failed, so that I am not
left guessing.

Acceptance criteria:

- R8.1 WHILE the index list or an index's detail is loading THE SYSTEM SHALL show that it is
  working.
- R8.2 WHEN a call fails because the cluster cannot be reached THE SYSTEM SHALL show that the
  connection is lost and offer to connect again (same wording as spec 001 R4.3).

### R9. A field's analyzer playground

As a search engineer, I want to see exactly how one field's analyzer works and try changing the
order of its steps, so that I can understand or debug why text is tokenized the way it is.

Acceptance criteria:

- R9.1 WHEN the user chooses "Try it" for an analyzed field THE SYSTEM SHALL open a full view for
  that field, showing its analyzer's steps in order (any character filters, the tokenizer, then
  any token filters) and a box to type text.
- R9.2 WHEN the user types text THE SYSTEM SHALL show the tokens produced after each step, so the
  user can see where a token appeared, changed, or disappeared.
- R9.3 THE SYSTEM SHALL let the user move a token filter earlier or later in the order.
- R9.4 WHEN the user changes the order THE SYSTEM SHALL immediately show the tokens that order
  would produce, without any change on the cluster.
- R9.5 THE SYSTEM SHALL show a way to put the order back to how the cluster actually has it.
- R9.6 WHEN the user leaves this view THE SYSTEM SHALL return to the index detail they came from,
  with the Fields tab and any typed text in other fields unchanged.
- R9.7 THE SYSTEM SHALL say plainly that this view computes tokens in the browser and does not
  change the field's real analyzer on the cluster.

## Out of scope

- The "search and explain" tab on the index detail view. It belongs to spec 004 (query lab).
- Editing or creating any index, mapping, or setting.
- Index templates and component templates as a separate view (may become a later spec).
- Node-level health and load (belongs to spec 005, load monitor).
- Reordering character filters or changing the tokenizer in the field playground (R9) — only
  the order of token filters can be changed there.
- Saving a changed filter order anywhere, or sending it to the cluster.
- Sorting or filtering the chart by anything other than size and document count.

## Open questions

- none
