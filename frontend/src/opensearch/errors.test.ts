import { describe, expect, it } from "vitest";
import { ClusterError, clusterError, clusterErrorReason } from "./errors";

describe("clusterErrorReason", () => {
  it("reads error.reason from an OpenSearch error body", () => {
    const err = clusterError(400, {
      error: { type: "illegal_argument_exception", reason: "Cannot use a preconfigured filter [x] here." },
      status: 400,
    });
    expect(clusterErrorReason(err)).toBe("Cannot use a preconfigured filter [x] here.");
  });

  it("prefers root_cause[0].reason when present", () => {
    const err = clusterError(400, {
      error: {
        reason: "a less specific wrapper reason",
        root_cause: [{ reason: "the specific root cause" }],
      },
    });
    expect(clusterErrorReason(err)).toBe("the specific root cause");
  });

  it("returns undefined when there is no body or no error.reason", () => {
    expect(clusterErrorReason(clusterError(500, undefined))).toBeUndefined();
    expect(clusterErrorReason(clusterError(500, {}))).toBeUndefined();
    expect(clusterErrorReason(new ClusterError("forbidden", "x"))).toBeUndefined();
  });
});
