import { describe, expect, it } from "vitest";

import {
  BLIMY_POLICY_FILE,
  MAX_POLICY_BYTES,
  parseBlimyPolicy,
} from "@/features/capsules/policy/blimy-policy";

describe("parseBlimyPolicy", () => {
  it("reads a policy with ordered verification commands", () => {
    const policy = parseBlimyPolicy(
      JSON.stringify({
        version: 1,
        verify: [
          { kind: "typecheck", command: "bun typecheck" },
          { kind: "unit", command: "bunx vp test run" },
        ],
      }),
    );

    expect(policy.verify.map((entry) => entry.kind)).toEqual(["typecheck", "unit"]);
    expect(policy.verify[0]?.command).toBe("bun typecheck");
  });

  it("trims commands and allows a policy with no checks", () => {
    expect(parseBlimyPolicy('{"version":1,"verify":[]}').verify).toEqual([]);
    expect(
      parseBlimyPolicy('{"version":1,"verify":[{"kind":"lint","command":"  bun lint  "}]}')
        .verify[0]?.command,
    ).toBe("bun lint");
  });

  it("rejects a policy it cannot act on", () => {
    expect(() => parseBlimyPolicy("{")).toThrow(`${BLIMY_POLICY_FILE} must contain valid JSON`);
    expect(() => parseBlimyPolicy("[]")).toThrow("must contain an object");
    expect(() => parseBlimyPolicy('{"version":2,"verify":[]}')).toThrow("version must be 1");
    expect(() => parseBlimyPolicy('{"version":1,"verify":[],"extra":true}')).toThrow(
      "Unknown policy field: extra",
    );
    expect(() => parseBlimyPolicy('{"version":1,"verify":[{"kind":"smoke"}]}')).toThrow(
      "kind must be one of",
    );
    expect(() =>
      parseBlimyPolicy('{"version":1,"verify":[{"kind":"unit","command":"  "}]}'),
    ).toThrow("must be a command");
    expect(() =>
      parseBlimyPolicy(
        '{"version":1,"verify":[{"kind":"unit","command":"a"},{"kind":"unit","command":"b"}]}',
      ),
    ).toThrow("Duplicate verify kind: unit");
  });

  it("rejects a policy larger than the size budget", () => {
    expect(() => parseBlimyPolicy("x".repeat(MAX_POLICY_BYTES + 1))).toThrow("exceeds");
  });
});
