// Read-only guard: decides which OpenSearch calls Search Lens may send.
// Allow-list source: .claude/skills/opensearch-api/reference.md, section "Read-only guard".

const ALLOWED_POST_SUFFIXES = [
  "_search",
  "_msearch",
  "_count",
  "_analyze",
  "_validate/query",
  "_search/template",
  "_render/template",
  "_field_caps",
  "_termvectors",
  "_mtermvectors",
  "_rank_eval",
];

const EXPLAIN_PATTERN = /\/_explain\/[^/]+$/;

export function isAllowed(method: string, path: string): boolean {
  const upperMethod = method.toUpperCase();

  if (upperMethod === "GET" || upperMethod === "HEAD") {
    return true;
  }

  if (upperMethod === "POST") {
    const pathWithoutQuery = path.split("?")[0];
    if (EXPLAIN_PATTERN.test(pathWithoutQuery)) {
      return true;
    }
    return ALLOWED_POST_SUFFIXES.some((suffix) =>
      pathWithoutQuery.endsWith(suffix),
    );
  }

  return false;
}
