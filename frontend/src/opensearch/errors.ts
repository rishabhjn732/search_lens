// Error codes and exact messages, from specs/001-connect-cluster/design.md,
// section "Mapping problems to errors".

export type ClusterErrorCode =
  | "invalid_url"
  | "credentials_incomplete"
  | "auth_failed"
  | "forbidden"
  | "timeout"
  | "unreachable"
  | "read_only"
  | "cluster_error";

export class ClusterError extends Error {
  code: ClusterErrorCode;
  status?: number;
  body?: unknown;

  constructor(
    code: ClusterErrorCode,
    message: string,
    extra?: { status?: number; body?: unknown },
  ) {
    super(message);
    this.code = code;
    this.status = extra?.status;
    this.body = extra?.body;
  }
}

export function invalidUrlError(): ClusterError {
  return new ClusterError(
    "invalid_url",
    "This is not a valid address. Use http:// or https://, for example https://localhost:9200.",
  );
}

export function credentialsIncompleteError(): ClusterError {
  return new ClusterError(
    "credentials_incomplete",
    "Enter both username and password, or leave both empty.",
  );
}

export function authFailedError(): ClusterError {
  return new ClusterError("auth_failed", "The username or password is wrong.");
}

export function forbiddenError(): ClusterError {
  return new ClusterError(
    "forbidden",
    "This user is not allowed to read cluster information.",
  );
}

export function timeoutError(url: string): ClusterError {
  return new ClusterError(
    "timeout",
    `The cluster at ${url} did not answer in 5 seconds.`,
  );
}

export function unreachableError(url: string): ClusterError {
  return new ClusterError("unreachable", `Cannot reach the cluster at ${url}.`);
}

export function readOnlyError(): ClusterError {
  return new ClusterError(
    "read_only",
    "Search Lens is read-only. This call would change the cluster.",
  );
}

export function clusterError(status: number, body: unknown): ClusterError {
  return new ClusterError(
    "cluster_error",
    `The cluster answered with error ${status}.`,
    { status, body },
  );
}
