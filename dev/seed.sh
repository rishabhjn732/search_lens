#!/usr/bin/env bash
# Creates the "products" practice index, 8 documents and one search template.
# This script writes to the cluster, so it is run by you, not by Search Lens.
set -euo pipefail
cd "$(dirname "$0")"

URL="${OPENSEARCH_URL:-https://localhost:9200}"
PASS="${OPENSEARCH_ADMIN_PASSWORD:-$(grep '^OPENSEARCH_ADMIN_PASSWORD=' .env | cut -d= -f2-)}"
call() { curl -k -sS -u "admin:${PASS}" -H 'Content-Type: application/json' "$@"; echo; }

call -X DELETE "$URL/products" >/dev/null || true
call -X PUT "$URL/products" -d @sample/products-index.json
call -X POST "$URL/products/_bulk?refresh=true" --data-binary @sample/products.ndjson
call -X PUT "$URL/_scripts/product_search" -d @sample/product-search-template.json
call "$URL/_cat/indices/products?v"
