/**
 * The repository policy file. It is JSON so it needs no dependency and parses the same way as
 * `blimy.workspace.json`.
 */
export const BLIMY_POLICY_FILE = "blimy.json";

/** A policy larger than this is a mistake, not a policy. */
export const MAX_POLICY_BYTES = 64 * 1024;

/** The checks a repository can declare. Reproduction is decided per capsule, not declared. */
export const VERIFY_KINDS = [
  "typecheck",
  "lint",
  "unit",
  "integration",
  "e2e",
  "api_check",
  "security",
] as const;

export type VerifyKind = (typeof VERIFY_KINDS)[number];

export interface PolicyVerifyCommand {
  kind: VerifyKind;
  command: string;
}

export interface BlimyPolicy {
  version: 1;
  verify: PolicyVerifyCommand[];
}

const POLICY_KEYS = ["version", "verify"];
const VERIFY_KEYS = ["kind", "command"];
const MAX_VERIFY_COMMANDS = 40;
const MAX_COMMAND_LENGTH = 4_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, allowed: string[], where: string) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown ${where} field: ${unknown}`);
}

function readCommand(value: unknown, index: number): PolicyVerifyCommand {
  if (!record(value)) throw new Error(`verify[${index}] must be an object.`);
  assertKeys(value, VERIFY_KEYS, `verify[${index}]`);

  const kind = value.kind;
  if (typeof kind !== "string" || !VERIFY_KINDS.includes(kind as VerifyKind)) {
    throw new Error(`verify[${index}].kind must be one of ${VERIFY_KINDS.join(", ")}.`);
  }

  const command = value.command;
  if (
    typeof command !== "string" ||
    command.trim() === "" ||
    command.length > MAX_COMMAND_LENGTH ||
    command.includes("\0")
  ) {
    throw new Error(
      `verify[${index}].command must be a command of up to ${MAX_COMMAND_LENGTH} characters.`,
    );
  }

  return { kind: kind as VerifyKind, command: command.trim() };
}

/**
 * Parses `blimy.json`. Every field is validated: a policy that cannot be understood must fail
 * loudly rather than silently disabling verification.
 */
export function parseBlimyPolicy(content: string): BlimyPolicy {
  if (content.length > MAX_POLICY_BYTES) {
    throw new Error(`${BLIMY_POLICY_FILE} exceeds ${MAX_POLICY_BYTES} characters.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error(`${BLIMY_POLICY_FILE} must contain valid JSON.`);
  }

  if (!record(value)) throw new Error(`${BLIMY_POLICY_FILE} must contain an object.`);
  if (value.version !== 1) throw new Error("Policy version must be 1.");
  assertKeys(value, POLICY_KEYS, "policy");

  if (!Array.isArray(value.verify)) {
    throw new Error("Policy verify must be an array.");
  }
  if (value.verify.length > MAX_VERIFY_COMMANDS) {
    throw new Error(`A policy can declare up to ${MAX_VERIFY_COMMANDS} commands.`);
  }

  const seen = new Set<VerifyKind>();
  const verify = value.verify.map((entry, index) => {
    const command = readCommand(entry, index);
    if (seen.has(command.kind)) {
      throw new Error(`Duplicate verify kind: ${command.kind}`);
    }
    seen.add(command.kind);
    return command;
  });

  return { version: 1, verify };
}
