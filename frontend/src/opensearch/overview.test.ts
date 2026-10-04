import { describe, expect, it, vi } from "vitest";
import { analyzePlaygroundStep, getIndexDetail, getShardLayout, listIndexSummaries } from "./overview";
import { ClusterError } from "./errors";

describe("listIndexSummaries", () => {
  it("sorts by size, descending", async () => {
    const request = vi.fn().mockResolvedValue([
      { index: "small", health: "green", "docs.count": "10", "store.size": "100" },
      { index: "big", health: "yellow", "docs.count": "5000", "store.size": "900000" },
    ]);

    const result = await listIndexSummaries(request);

    expect(result.map((r) => r.name)).toEqual(["big", "small"]);
    expect(result[0]).toEqual({
      name: "big",
      health: "yellow",
      docsCount: 5000,
      sizeBytes: 900000,
      isSystem: false,
    });
  });

  it("returns an empty list for a cluster with no indexes", async () => {
    const request = vi.fn().mockResolvedValue([]);

    const result = await listIndexSummaries(request);

    expect(result).toEqual([]);
  });

  it("flags names starting with a dot as system indexes, mixed with normal ones", async () => {
    const request = vi.fn().mockResolvedValue([
      { index: "products_v7", health: "green", "docs.count": "48213", "store.size": "92340112" },
      { index: ".kibana_1", health: "green", "docs.count": "12", "store.size": "40112" },
    ]);

    const result = await listIndexSummaries(request);

    expect(result.find((r) => r.name === ".kibana_1")?.isSystem).toBe(true);
    expect(result.find((r) => r.name === "products_v7")?.isSystem).toBe(false);
  });

  it("calls _cat/indices and passes through a forbidden error unchanged", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ClusterError("forbidden", "This user is not allowed to read cluster information."));

    await expect(listIndexSummaries(request)).rejects.toMatchObject({ code: "forbidden" });
    expect(request).toHaveBeenCalledWith(
      "GET",
      "/_cat/indices?format=json&bytes=b&h=index,health,status,docs.count,store.size",
    );
  });
});

const MAPPING_BODY = {
  products_v7: {
    mappings: {
      properties: {
        title: { type: "text", analyzer: "product_text" },
        brand: { type: "keyword" },
      },
    },
  },
};

const SETTINGS_BODY = {
  products_v7: {
    settings: {
      index: {
        number_of_shards: "1",
        number_of_replicas: "1",
        analysis: {
          analyzer: {
            product_text: { type: "custom", tokenizer: "standard", filter: ["lowercase"] },
          },
        },
      },
    },
  },
};

describe("getIndexDetail", () => {
  it("builds fields and resolved analyzer chains from a normal mapping and settings", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(MAPPING_BODY)
      .mockResolvedValueOnce(SETTINGS_BODY);

    const detail = await getIndexDetail(request, "products_v7");

    expect(detail.fieldsError).toBeNull();
    expect(detail.fields?.map((f) => f.path)).toEqual(["title", "brand"]);
    expect(detail.analyzers.product_text).toBeDefined();
    expect(detail.analyzers.product_text.tokenizer.name).toBe("standard");
    expect(detail.settingsError).toBeNull();
    expect(detail.settings).toEqual({ shards: 1, replicas: 1, refreshInterval: "1s" });
    expect(request).toHaveBeenCalledWith("GET", "/products_v7/_mapping");
    expect(request).toHaveBeenCalledWith("GET", "/products_v7/_settings");
  });

  it("still returns fields when a field's data is not a usable object", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      products_v7: { mappings: { properties: { broken: null } } },
    }).mockResolvedValueOnce(SETTINGS_BODY);

    const detail = await getIndexDetail(request, "products_v7");

    expect(detail.fieldsError).toBeNull();
    expect(detail.fields?.map((f) => f.path)).toEqual(["broken"]);
  });

  it("returns fieldsError and no fields when the mapping call is forbidden", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ClusterError("forbidden", "This user is not allowed to read cluster information."))
      .mockResolvedValueOnce(SETTINGS_BODY);

    const detail = await getIndexDetail(request, "products_v7");

    expect(detail.fields).toBeNull();
    expect(detail.fieldsError?.code).toBe("forbidden");
  });

  it("still returns fields when only the settings call is forbidden", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(MAPPING_BODY)
      .mockRejectedValueOnce(new ClusterError("forbidden", "This user is not allowed to read cluster information."));

    const detail = await getIndexDetail(request, "products_v7");

    expect(detail.fieldsError).toBeNull();
    expect(detail.fields?.map((f) => f.path)).toEqual(["title", "brand"]);
    expect(detail.settings).toBeNull();
    expect(detail.settingsError?.code).toBe("forbidden");
    // No settings means no analyzer definition for product_text; it falls back to
    // "not defined" rather than crashing, so no chain is recorded for it.
    expect(detail.analyzers.product_text).toBeUndefined();
  });

  it("resolves the search-time analyzer too, when a field searches with a different one", async () => {
    const mapping = {
      products_v7: {
        mappings: {
          properties: {
            description: {
              type: "text",
              analyzer: "standard",
              fields: { syn_hc: { type: "text", analyzer: "standard", search_analyzer: "english_search_syn_hc" } },
            },
          },
        },
      },
    };
    const settings = {
      products_v7: {
        settings: {
          index: {
            analysis: {
              analyzer: {
                english_search_syn_hc: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "synonym_filter_hc", "english_stop"],
                },
              },
              filter: {
                synonym_filter_hc: { type: "synonym", synonyms: ["ai supplychain, ai_supplychain"] },
                english_stop: { type: "stop", stopwords: "_english_" },
              },
            },
          },
        },
      },
    };
    const request = vi.fn().mockResolvedValueOnce(mapping).mockResolvedValueOnce(settings);

    const detail = await getIndexDetail(request, "products_v7");

    const synField = detail.fields?.find((f) => f.path === "description.syn_hc");
    expect(synField?.searchAnalyzer).toBe("english_search_syn_hc");
    const searchChain = detail.analyzers.english_search_syn_hc;
    expect(searchChain).toBeDefined();
    expect(searchChain.filters.map((s) => s.name)).toEqual(["lowercase", "synonym_filter_hc", "english_stop"]);
  });
});

describe("getShardLayout", () => {
  it("groups an index's shards by node and marks an unassigned one", async () => {
    const request = vi.fn().mockResolvedValue([
      { index: "products_v7", shard: "0", prirep: "p", state: "STARTED", node: "node-1" },
      { index: "products_v7", shard: "0", prirep: "r", state: "UNASSIGNED", node: null },
      { index: "other_index", shard: "0", prirep: "p", state: "STARTED", node: "node-1" },
    ]);

    const layout = await getShardLayout(request, "products_v7");

    expect(layout).toEqual([
      { node: "node-1", shards: [{ shard: "0", kind: "primary", assigned: true }] },
      { node: null, shards: [{ shard: "0", kind: "replica", assigned: false }] },
    ]);
    expect(request).toHaveBeenCalledWith("GET", "/_cat/shards?format=json&h=index,shard,prirep,state,node");
  });
});

describe("analyzePlaygroundStep", () => {
  it("sends an explicit tokenizer/char_filter/filter/text body and returns the response", async () => {
    const response = {
      detail: {
        custom_analyzer: true,
        charfilters: [],
        tokenizer: { name: "standard", tokens: [] },
        tokenfilters: [{ name: "english_stop", tokens: [{ token: "shoes", start_offset: 4, end_offset: 9, type: "word", position: 1 }] }],
      },
    };
    const request = vi.fn().mockResolvedValue(response);

    const result = await analyzePlaygroundStep(request, "products_v7", {
      tokenizer: "standard",
      charFilters: [],
      filters: ["lowercase", "english_stop"],
      text: "The Shoes",
    });

    expect(result).toEqual(response);
    expect(request).toHaveBeenCalledWith("POST", "/products_v7/_analyze", {
      tokenizer: "standard",
      char_filter: [],
      filter: ["lowercase", "english_stop"],
      text: "The Shoes",
      explain: true,
    });
  });

  it("can send an inline filter definition in place of a named filter (R10.3)", async () => {
    const request = vi.fn().mockResolvedValue({
      detail: { custom_analyzer: true, charfilters: [], tokenizer: { name: "standard", tokens: [] }, tokenfilters: [] },
    });
    const inlineSynonym = { type: "synonym", synonyms: ["ai supplychain, ai_supplychain"] };

    await analyzePlaygroundStep(request, "products_v7", {
      tokenizer: "standard",
      charFilters: [],
      filters: ["lowercase", inlineSynonym],
      text: "ai supplychain",
    });

    expect(request).toHaveBeenCalledWith(
      "POST",
      "/products_v7/_analyze",
      expect.objectContaining({ filter: ["lowercase", inlineSynonym] }),
    );
  });
});
