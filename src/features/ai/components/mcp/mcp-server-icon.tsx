import { cn } from "@/utils/cn";
import { GithubMark, GoogleMark } from "@/ui/brand-marks";
import {
  ASSET_ICONS,
  BRAND_MAP,
  SIMPLE_ICON_DATA,
  isNamedMarkAsset,
} from "./mcp-server-icons.generated";

type SimpleIconGlyph = (typeof SIMPLE_ICON_DATA)[string];

const NAMED_MARKS: Record<string, () => React.ReactNode> = {
  github: () => <GithubMark size="100%" />,
  google: () => <GoogleMark size="100%" />,
};

/**
 * Renders the real brand glyph for a marketplace server: the brand's own Simple Icons
 * path filled with its brand hex, a shipped official mark, or a brand-system mark such
 * as GitHub/Google. Server ids without a recognizable logo fall back to a monogram on
 * the surface token, so every row reads as a distinct service.
 */
export function McpServerIcon({
  serverId,
  name,
  size = 40,
  className,
}: {
  serverId: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const entry = BRAND_MAP[serverId];

  let content: React.ReactNode = null;

  if (entry?.kind === "si" && SIMPLE_ICON_DATA[entry.icon]) {
    const glyph: SimpleIconGlyph = SIMPLE_ICON_DATA[entry.icon];
    content = (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" className="size-full" fill={entry.hex}>
        <path d={glyph.path} />
      </svg>
    );
  } else if (entry?.kind === "asset" && isNamedMarkAsset(entry.asset) && NAMED_MARKS[entry.asset]) {
    content = NAMED_MARKS[entry.asset]!();
  } else if (entry?.kind === "asset" && ASSET_ICONS[entry.asset]) {
    content = (
      <img
        src={ASSET_ICONS[entry.asset]}
        alt=""
        draggable={false}
        className="size-full object-contain"
      />
    );
  }

  if (!content) {
    const source = name?.trim() || serverId.replace(/^mcp[-_. ]+/i, "").replace(/\.git$/, "");
    const letter = source[0]?.toUpperCase() || "M";
    content = <span aria-hidden="true">{letter}</span>;
  }

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        "bg-surface text-muted-foreground",
        "font-semibold leading-none",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {content}
    </span>
  );
}
