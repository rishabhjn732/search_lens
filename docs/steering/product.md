# Product

## What it is

Search Lens is a tool for people who build and debug search on OpenSearch.
You connect it to a cluster, and it shows in pictures what OpenSearch does with a query.

## Who uses it

Search engineers and backend developers who need to answer questions like:

- "Why is this document not found?"
- "Why is this document ranked above that one?"
- "Is the cluster slow, or is my query slow?"

## The five screens

1. **Connect.** Enter the cluster URL, username and password.
2. **Cluster overview.** Indexes, mappings, settings, templates, nodes, health.
3. **Token playground.** Type text and watch the analyzer cut and change it, step by step.
4. **Query lab.** Pick an index and a search template, run a query, and see why each hit matched
   and how its score was built.
5. **Load monitor.** Live CPU, memory, search queue and running searches.

## What it is not

- Not an admin tool. It does not create, change or delete anything on the cluster.
- Not a replacement for OpenSearch Dashboards. It does one job: explain search behaviour.
