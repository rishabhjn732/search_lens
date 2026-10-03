import { isAllowed } from "./guard";
import {
  authFailedError,
  clusterError,
  credentialsIncompleteError,
  forbiddenError,
  invalidUrlError,
  readOnlyError,
  timeoutError,
  unreachableError,
} from "./errors";

const TIMEOUT_MS = 5000;

export interface ConnectDetails {
  url: string;
  username: string;
  password: string;
}

export interface ClusterFacts {
  cluster_name: string;
  version: string;
  distribution: string;
  status: string;
  number_of_nodes: number;
}

export interface ClusterClient {
  request: (method: string, path: string, body?: unknown) => Promise<unknown>;
  connect: () => Promise<ClusterFacts>;
}

function isValidClusterUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function createClusterClient(details: ConnectDetails): ClusterClient {
  if (!isValidClusterUrl(details.url)) {
    throw invalidUrlError();
  }
  const hasUsername = details.username !== "";
  const hasPassword = details.password !== "";
  if (hasUsername !== hasPassword) {
    throw credentialsIncompleteError();
  }

  const baseUrl = details.url.endsWith("/") ? details.url : `${details.url}/`;
  // Kept only in this closure, never on a field, so it cannot show up in
  // JSON.stringify or a console log of the client. Undefined when the
  // cluster has no security plugin and needs no login at all (R1.8).
  const authHeader = hasUsername
    ? `Basic ${btoa(`${details.username}:${details.password}`)}`
    : undefined;

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    if (!isAllowed(method, path)) {
      throw readOnlyError();
    }

    const fullUrl = new URL(path.replace(/^\//, ""), baseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        method,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "omit",
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw timeoutError(details.url);
      }
      throw unreachableError(details.url);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401) {
      throw authFailedError();
    }
    if (response.status === 403) {
      throw forbiddenError();
    }
    if (!response.ok) {
      throw clusterError(response.status, await parseErrorBody(response));
    }
    if (method.toUpperCase() === "HEAD") {
      return undefined;
    }
    return response.json();
  }

  async function connect(): Promise<ClusterFacts> {
    const root = (await request("GET", "/")) as {
      cluster_name: string;
      version: { number: string; distribution: string };
    };
    const health = (await request("GET", "/_cluster/health")) as {
      cluster_name: string;
      status: string;
      number_of_nodes: number;
    };

    return {
      cluster_name: health.cluster_name ?? root.cluster_name,
      version: root.version.number,
      distribution: root.version.distribution,
      status: health.status,
      number_of_nodes: health.number_of_nodes,
    };
  }

  return { request, connect };
}
