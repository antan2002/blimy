/** One cron field, expanded to the values it allows. */
export interface CronField {
  values: number[];
  /** True when the field was `*` (or an equivalent step), so every value is allowed. */
  wildcard: boolean;
}

export interface ParsedCron {
  /** The normalized five-field expression. */
  expression: string;
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  /** 0-6 with Sunday as 0; 7 is accepted and normalized to 0. */
  dayOfWeek: CronField;
}

export interface CronFieldRange {
  min: number;
  max: number;
}

/** Presets the tool accepts in place of a five-field expression. */
export const CRON_PRESETS: Record<string, string> = {
  "@hourly": "0 * * * *",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@weekly": "0 0 * * 0",
  "@monthly": "0 0 1 * *",
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
};

const FIELDS: [keyof Omit<ParsedCron, "expression">, CronFieldRange][] = [
  ["minute", { min: 0, max: 59 }],
  ["hour", { min: 0, max: 23 }],
  ["dayOfMonth", { min: 1, max: 31 }],
  ["month", { min: 1, max: 12 }],
  ["dayOfWeek", { min: 0, max: 7 }],
];

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function namedValue(token: string, names: string[]): string {
  const index = names.indexOf(token.toLowerCase());
  return index < 0 ? token : String(index + (names === MONTH_NAMES ? 1 : 0));
}

function parseNumber(token: string, range: CronFieldRange, names?: string[]) {
  const resolved = names ? namedValue(token, names) : token;
  const value = Number(resolved);
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new Error(`"${token}" is outside ${range.min}-${range.max}.`);
  }
  return value;
}

function parseField(source: string, range: CronFieldRange, names?: string[]): CronField {
  const spec = source.trim();
  if (!spec) throw new Error("Empty cron field.");

  const values = new Set<number>();
  for (const part of spec.split(",")) {
    const [segment, stepSource] = part.split("/");
    if (!segment) throw new Error(`Invalid cron field "${spec}".`);
    const step = stepSource === undefined ? undefined : Number(stepSource);
    if (step !== undefined && (!Number.isInteger(step) || step < 1)) {
      throw new Error(`Step "${stepSource}" must be a positive integer.`);
    }

    let start: number;
    let end: number;
    if (segment === "*" || segment === "?") {
      start = range.min;
      end = range.max;
    } else if (segment.includes("-")) {
      const [from, to] = segment.split("-");
      start = parseNumber(from, range, names);
      end = parseNumber(to, range, names);
      if (end < start) throw new Error(`Range "${segment}" is reversed.`);
    } else {
      start = parseNumber(segment, range, names);
      end = step === undefined ? start : range.max;
    }
    for (let value = start; value <= end; value += step ?? 1) values.add(value);
  }

  if (values.size === 0) throw new Error(`Cron field "${spec}" matches nothing.`);
  return {
    values: Array.from(values).sort((left, right) => left - right),
    wildcard: spec.startsWith("*"),
  };
}

/** Expands a five-field expression or a preset, and validates every field. */
export function parseCron(expression: string): ParsedCron {
  const trimmed = expression.trim().replace(/\s+/g, " ");
  const expanded = CRON_PRESETS[trimmed.toLowerCase()] ?? trimmed;
  const parts = expanded.split(" ");
  if (parts.length !== 5) {
    throw new Error(`A cron expression needs 5 fields, got ${parts.length}.`);
  }

  const parsed: Record<string, CronField> = {};
  FIELDS.forEach(([name, range], index) => {
    const names = name === "month" ? MONTH_NAMES : name === "dayOfWeek" ? DAY_NAMES : undefined;
    parsed[name] = parseField(parts[index], range, names);
  });
  // Both 0 and 7 mean Sunday.
  const dayOfWeek = new Set(parsed.dayOfWeek.values.map((value) => (value === 7 ? 0 : value)));
  return {
    expression: expanded,
    minute: parsed.minute,
    hour: parsed.hour,
    dayOfMonth: parsed.dayOfMonth,
    month: parsed.month,
    dayOfWeek: { ...parsed.dayOfWeek, values: Array.from(dayOfWeek).sort((a, b) => a - b) },
  };
}

/** Standard cron day rule: when both day fields are restricted, either one matching is enough. */
function matchesDay(cron: ParsedCron, date: Date) {
  const dayOfMonthRestricted = !cron.dayOfMonth.wildcard;
  const dayOfWeekRestricted = !cron.dayOfWeek.wildcard;
  const dayOfMonth = cron.dayOfMonth.values.includes(date.getDate());
  const dayOfWeek = cron.dayOfWeek.values.includes(date.getDay());
  if (dayOfMonthRestricted && dayOfWeekRestricted) return dayOfMonth || dayOfWeek;
  if (dayOfMonthRestricted) return dayOfMonth;
  if (dayOfWeekRestricted) return dayOfWeek;
  return true;
}

const CRON_SEARCH_YEARS = 4;

/**
 * The first minute strictly after `from` that the expression matches, or null when it never
 * matches (for example 30 February). Whole months and days are skipped rather than scanned
 * minute by minute.
 */
export function nextCronRun(cron: ParsedCron, from: Date = new Date()): Date | null {
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  const limit = new Date(candidate.getTime());
  limit.setFullYear(limit.getFullYear() + CRON_SEARCH_YEARS);

  while (candidate.getTime() < limit.getTime()) {
    if (!cron.month.values.includes(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!matchesDay(cron, candidate)) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!cron.hour.values.includes(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!cron.minute.values.includes(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }
    return candidate;
  }
  return null;
}

/** Whether the text is a usable cron expression. Used to reject a tool call early. */
export function isCronExpression(expression: string): boolean {
  try {
    parseCron(expression);
    return true;
  } catch {
    return false;
  }
}
