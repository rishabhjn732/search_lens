import { describe, expect, it } from "vitest";
import { isAllowed } from "./guard";

describe("isAllowed", () => {
  it.each(["GET", "get", "HEAD", "head"])("allows %s to any path", (method) => {
    expect(isAllowed(method, "/_cluster/health")).toBe(true);
    expect(isAllowed(method, "/products/_doc/1")).toBe(true);
  });

  it.each([
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
  ])("allows POST ending with %s", (suffix) => {
    expect(isAllowed("POST", `/products/${suffix}`)).toBe(true);
    expect(isAllowed("post", `/products/${suffix}`)).toBe(true);
  });

  it("allows POST matching _explain/<doc_id>", () => {
    expect(isAllowed("POST", "/products/_explain/42")).toBe(true);
  });

  it("allows an allowed POST path with a query string", () => {
    expect(isAllowed("POST", "/products/_search?pretty=true")).toBe(true);
  });

  it("refuses POST to a path that is not in the allow-list", () => {
    expect(isAllowed("POST", "/products/_doc/1")).toBe(false);
  });

  it("refuses POST to a path that only contains an allowed name, not at the end", () => {
    expect(isAllowed("POST", "/_search/this-is-not-allowed")).toBe(false);
  });

  it.each(["PUT", "DELETE", "PATCH"])("always refuses %s", (method) => {
    expect(isAllowed(method, "/_search")).toBe(false);
    expect(isAllowed(method, "/products")).toBe(false);
  });
});
