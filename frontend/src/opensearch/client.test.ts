import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClusterClient } from "./client";
import { ClusterError } from "./errors";

const ROOT_BODY = {
  name: "node-1",
  cluster_name: "docker-cluster",
  version: { distribution: "opensearch", number: "2.19.0" },
};
const HEALTH_BODY = {
  cluster_name: "docker-cluster",
  status: "green",
  number_of_nodes: 1,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createClusterClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("throws invalid_url before any fetch, for a bad address", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      createClusterClient({ url: "not-a-url", username: "a", password: "b" }),
    ).toThrow(expect.objectContaining({ code: "invalid_url" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws credentials_incomplete when only the username is filled in", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      createClusterClient({ url: "https://localhost:9200", username: "admin", password: "" }),
    ).toThrow(expect.objectContaining({ code: "credentials_incomplete" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws credentials_incomplete when only the password is filled in", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      createClusterClient({ url: "https://localhost:9200", username: "", password: "secret" }),
    ).toThrow(expect.objectContaining({ code: "credentials_incomplete" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends no Authorization header when both username and password are empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ROOT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "",
      password: "",
    });
    await client.request("GET", "/");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("connect() returns the cluster facts from the two calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, ROOT_BODY))
      .mockResolvedValueOnce(jsonResponse(200, HEALTH_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "admin",
      password: "secret",
    });
    const facts = await client.connect();

    expect(facts).toEqual({
      cluster_name: "docker-cluster",
      version: "2.19.0",
      distribution: "opensearch",
      status: "green",
      number_of_nodes: 1,
    });
  });

  it("sends the Authorization header and credentials: omit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ROOT_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "admin",
      password: "secret",
    });
    await client.request("GET", "/");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("omit");
    expect(init.headers.Authorization).toBe(`Basic ${btoa("admin:secret")}`);
  });

  it("maps a 401 answer to auth_failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "wrong",
    });

    await expect(client.request("GET", "/")).rejects.toMatchObject({
      code: "auth_failed",
      message: "The username or password is wrong.",
    });
  });

  it("maps a 403 answer to forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {})));
    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "b",
    });

    await expect(client.request("GET", "/")).rejects.toMatchObject({
      code: "forbidden",
      message: "This user is not allowed to read cluster information.",
    });
  });

  it("maps any other non-2xx answer to cluster_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, { error: "boom" })),
    );
    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "b",
    });

    await expect(client.request("GET", "/")).rejects.toMatchObject({
      code: "cluster_error",
      message: "The cluster answered with error 500.",
      status: 500,
    });
  });

  it("maps an abort (5 second timeout) to timeout, with the url in the message", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "b",
    });
    const promise = client.request("GET", "/");
    const assertion = expect(promise).rejects.toMatchObject({
      code: "timeout",
      message: "The cluster at https://localhost:9200 did not answer in 5 seconds.",
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("maps a fetch rejection (network, CORS, bad certificate) to unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "b",
    });

    await expect(client.request("GET", "/")).rejects.toMatchObject({
      code: "unreachable",
      message: "Cannot reach the cluster at https://localhost:9200.",
    });
  });

  it("refuses a write call before fetch, with read_only", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "a",
      password: "b",
    });

    await expect(client.request("PUT", "/products/_doc/1")).rejects.toMatchObject(
      { code: "read_only" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never puts the password in the client object, an error, or a console call", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));

    const client = createClusterClient({
      url: "https://localhost:9200",
      username: "admin",
      password: "super-secret",
    });
    expect(JSON.stringify(client)).not.toContain("super-secret");

    let caught: unknown;
    try {
      await client.request("GET", "/");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ClusterError);
    expect(JSON.stringify(caught)).not.toContain("super-secret");
    expect((caught as ClusterError).message).not.toContain("super-secret");
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("super-secret");
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain("super-secret");
  });
});
