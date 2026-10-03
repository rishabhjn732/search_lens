# Practice cluster

A one-node OpenSearch on your own machine, so you can try things without touching a real cluster.
You need Docker.

1. Copy `dev/.env.example` to `dev/.env` and write your own password in it.
2. Start the cluster: `docker compose -f dev/docker-compose.yml up -d`
3. Wait about one minute, then test it:
   `curl -k -u admin:<your password> https://localhost:9200`
4. Load the sample data: `bash dev/seed.sh`

The cluster uses a self-made security certificate, so tools will say it is "not trusted".
That is why the `curl` commands use `-k`, and why Search Lens has a "Skip certificate check" option.

In Search Lens, connect with URL `https://localhost:9200`, username `admin`, and your password.

To stop it: `docker compose -f dev/docker-compose.yml down`. Add `-v` to also delete the data.

## What is in the sample data

- Index `products` with 8 documents and one shard.
- A custom analyzer `product_text`: standard tokenizer, then lowercase, accent removal,
  synonyms (sneakers and trainers also become shoes), stop words, and an English stemmer.
- A stored search template `product_search` with one value, `q`.

Good searches to try later: `shoe`, `sneakers`, `running`, `television`, `cafe`.
