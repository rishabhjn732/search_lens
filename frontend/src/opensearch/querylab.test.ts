import { describe, expect, it, vi } from "vitest";
import { explainDoc, runQuery, validateQuery } from "./querylab";
import { ClusterError } from "./errors";

describe("runQuery", () => {
  it("sends a GET request as POST instead, since a browser cannot fetch GET with a body", async () => {
    const request = vi.fn().mockResolvedValue({
      hits: {
        total: { value: 42 },
        hits: [
          {
            _id: "1",
            _score: 3.2,
            _source: { title: "Nike running shoes" },
            _explanation: { value: 3.2, description: "sum of:", details: [] },
          },
        ],
      },
    });

    const result = await runQuery(request, "GET", "/products/_search", {
      query: { match: { title: "nike" } },
      explain: true,
      profile: true,
      size: 10,
    });

    expect(request).toHaveBeenCalledWith("POST", "/products/_search", {
      query: { match: { title: "nike" } },
      explain: true,
      profile: true,
      size: 10,
    });
    expect(result).toEqual({
      total: 42,
      hits: [
        {
          id: "1",
          score: 3.2,
          source: { title: "Nike running shoes" },
          explanation: { value: 3.2, description: "sum of:", details: [] },
        },
      ],
    });
  });

  it("accepts a plain number for hits.total", async () => {
    const request = vi.fn().mockResolvedValue({ hits: { total: 0, hits: [] } });

    const result = await runQuery(request, "GET", "/products/_search", { query: { match_all: {} } });

    expect(result).toEqual({ total: 0, hits: [] });
  });

  it("passes through a ClusterError unchanged", async () => {
    const request = vi.fn().mockRejectedValue(new ClusterError("unreachable", "Cannot reach the cluster at x."));

    await expect(runQuery(request, "GET", "/products/_search", {})).rejects.toMatchObject({ code: "unreachable" });
  });
});

describe("validateQuery", () => {
  it("sends the body to _validate/query and parses the result", async () => {
    const request = vi.fn().mockResolvedValue({
      valid: true,
      explanations: [{ index: "products", valid: true, explanation: "+title:nike" }],
    });

    const result = await validateQuery(request, "products", { query: { match: { title: "nike" } } });

    expect(request).toHaveBeenCalledWith(
      "POST",
      "/products/_validate/query?explain=true&rewrite=true",
      { query: { match: { title: "nike" } } },
    );
    expect(result).toEqual({
      valid: true,
      explanations: [{ index: "products", valid: true, explanation: "+title:nike" }],
    });
  });

  it("defaults explanations to an empty list when the cluster omits it", async () => {
    const request = vi.fn().mockResolvedValue({ valid: false });

    const result = await validateQuery(request, "products", {});

    expect(result).toEqual({ valid: false, explanations: [] });
  });

  it("passes through a ClusterError unchanged", async () => {
    const request = vi.fn().mockRejectedValue(new ClusterError("forbidden", "This user is not allowed to read cluster information."));

    await expect(validateQuery(request, "products", {})).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("explainDoc", () => {
  it("reports a match", async () => {
    const request = vi.fn().mockResolvedValue({
      matched: true,
      explanation: { value: 1.2, description: "sum of:", details: [] },
    });

    const result = await explainDoc(request, "products", { match_all: {} }, "1");

    expect(request).toHaveBeenCalledWith("POST", "/products/_explain/1", { query: { match_all: {} } });
    expect(result).toEqual({
      kind: "matched",
      explanation: { value: 1.2, description: "sum of:", details: [] },
    });
  });

  it("reports a miss", async () => {
    const request = vi.fn().mockResolvedValue({
      matched: false,
      explanation: { value: 0, description: "no match", details: [] },
    });

    const result = await explainDoc(request, "products", {}, "2");

    expect(result.kind).toBe("not_matched");
  });

  it("maps a 404 to not_found instead of throwing", async () => {
    const request = vi.fn().mockRejectedValue(new ClusterError("cluster_error", "not found", { status: 404 }));

    const result = await explainDoc(request, "products", {}, "missing");

    expect(result).toEqual({ kind: "not_found" });
  });

  it("re-throws any other ClusterError", async () => {
    const request = vi.fn().mockRejectedValue(new ClusterError("forbidden", "This user is not allowed to read cluster information."));

    await expect(explainDoc(request, "products", {}, "1")).rejects.toMatchObject({ code: "forbidden" });
  });
});
