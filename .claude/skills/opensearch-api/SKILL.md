---
name: opensearch-api
description: Reference for the OpenSearch REST APIs that Search Lens calls (analyze, explain, profile, validate, search templates, node stats, cat APIs) and which calls the read-only guard allows. Use when writing a design, code, or tests that touch OpenSearch.
---

# OpenSearch APIs used by Search Lens

Read `reference.md` in this skill folder for the list of calls, their important parameters,
and things that often go wrong.

When you use an API from the reference:

- Copy the method and path exactly. Do not invent parameters.
- If the reference does not have the call you need, say so, and check the official OpenSearch
  documentation before using it. Then add the call to `reference.md` in the same change.
- Every call from the app goes through `src/opensearch/client.ts` and must pass the read-only guard before it is sent.
- Response shapes can differ between OpenSearch versions. When a field may be missing, the design
  must say what the screen shows in that case.
