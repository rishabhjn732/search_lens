# Requirements: connect to a cluster

Status: approved

## Summary

The user gives the address of an OpenSearch cluster, a username and a password.
The tool checks that it can talk to the cluster and shows basic facts about it.
After that, every other screen uses this connection. The tool never changes the cluster.
The tool opens on a home page that explains what it does and leads to the connect screen.

## Requirements

### R1. Connect

As a search engineer, I want to connect with a URL, username and password,
so that I can inspect my cluster.

Acceptance criteria:

- R1.1 WHEN the user enters a URL, username and password and chooses Connect
  THE SYSTEM SHALL check the cluster and show its name, version, number of nodes and health status.
- R1.2 WHEN the username or password is wrong THE SYSTEM SHALL show
  "The username or password is wrong." and stay on the connect screen.
- R1.3 WHEN the cluster cannot be reached or does not answer within 5 seconds THE SYSTEM SHALL show
  "Cannot reach the cluster at <url>." and suggest checking the address and the network.
- R1.4 WHEN the cluster's security certificate is not trusted THE SYSTEM SHALL explain this
  and offer a "Skip certificate check" option.
- R1.5 WHEN the URL is not a valid http or https address THE SYSTEM SHALL say so
  before any call is made to the cluster.
- R1.6 WHEN the login is correct but the user is not allowed to read cluster information
  THE SYSTEM SHALL show "This user is not allowed to read cluster information."
- R1.7 WHILE the check is running THE SYSTEM SHALL show that it is working
  and not accept a second Connect.

### R2. Keep the password safe

As a search engineer, I want my password handled carefully,
so that using the tool does not create a security problem.

Acceptance criteria:

- R2.1 THE SYSTEM SHALL keep the password only in the memory of the backend.
- R2.2 THE SYSTEM SHALL NOT write the password to disk, to logs, or into error messages.
- R2.3 THE SYSTEM SHALL NOT keep the password in the browser after the connect request is sent.
- R2.4 WHEN the backend restarts THE SYSTEM SHALL ask the user to connect again.

### R3. Read-only

As a search engineer, I want the tool to be unable to change my cluster,
so that I can point it at production without fear.

Acceptance criteria:

- R3.1 WHEN any part of the tool tries a call that would change the cluster THE SYSTEM SHALL refuse it
  and show "Search Lens is read-only. This call would change the cluster."
- R3.2 THE SYSTEM SHALL allow read calls and the search-style calls listed in the project's API reference.

### R4. See the connection and disconnect

As a search engineer, I want to always see which cluster I am connected to,
so that I do not confuse test and production.

Acceptance criteria:

- R4.1 WHILE connected THE SYSTEM SHALL show the cluster name and health status on every screen.
- R4.2 WHEN the user chooses Disconnect THE SYSTEM SHALL forget the URL, username and password
  and return to the connect screen.
- R4.3 WHEN a later call fails because the cluster cannot be reached THE SYSTEM SHALL show
  that the connection is lost and offer to connect again.

### R5. Home page

As a search engineer who opens the tool for the first time, I want a page that explains
what the tool does and how to start, so that I know where to go next.

The look follows `prototypes/home/a-clean-lab.html` (design A), without the word lists section.

Acceptance criteria:

- R5.1 WHEN the user opens the tool THE SYSTEM SHALL show the home page with: a title that says
  what the tool does, a "Connect to a cluster" button, the five screens, "How it works" in three
  steps, and the sentence "Search Lens only reads from your cluster. It never creates, changes or
  deletes anything."
- R5.2 WHEN the user chooses "Connect to a cluster" THE SYSTEM SHALL show the connect screen.
- R5.3 THE SYSTEM SHALL show each of the five screens as a card with its name and one sentence.
  WHEN the user chooses the Connect card THE SYSTEM SHALL show the connect screen.
  The cards for screens that are not built yet SHALL show "Coming soon" and SHALL NOT be links.
- R5.4 THE SYSTEM SHALL show an example on the home page in which the query "Running Shoes!"
  becomes the tokens "run" and "shoe" and matches one product with a score, step by step.
- R5.5 WHEN the user's device asks for reduced motion THE SYSTEM SHALL show the example's
  final picture with no movement.
- R5.6 WHEN the user chooses the Search Lens name in the header THE SYSTEM SHALL show the home page.
- R5.7 WHEN the window is narrower than 900 pixels THE SYSTEM SHALL show the home page in one column
  with no sideways scrolling.
- R5.8 THE SYSTEM SHALL NOT call the cluster to show the home page.

## Out of scope

- Saving connections for next time.
- Connecting to more than one cluster at once.
- Login methods other than username and password (AWS request signing, API keys, single sign-on).
- More than one person using the same running tool.
- The "Bring your own word lists" section and the Word lists tab from the prototypes.
  They get their own spec (`custom-word-lists`).
- The content of screens 2 to 5. The home page only shows their cards.

## Open questions

- Should the tool disconnect by itself after a time without use? Proposal for version 1: no.
- What should the home page's main button do while the user is already connected?
  Proposal for version 1: it stays "Connect to a cluster", and the header badge (R4.1) shows the
  current cluster. Connecting again replaces the old connection.
