const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Strips ANSI/VT100 escape codes and normalizes line breaks from terminal output.
 */
export function stripAnsi(text: string): string {
  if (!text) return "";
  return text.replace(ANSI_PATTERN, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
