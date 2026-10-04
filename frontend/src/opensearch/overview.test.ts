import { describe, expect, it, vi } from "vitest";
import { getIndexDetail, getShardLayout, listIndexSummaries } from "./overview";
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
