import sqliteImage from "../../extensions/official/sqlite/icon.svg";
import duckdbImage from "../../extensions/official/duckdb/icon.svg";
import postgresImage from "../../extensions/official/postgres/icon.svg";
import mysqlImage from "../../extensions/official/mysql/icon.svg";
import mongodbImage from "../../extensions/official/mongodb/icon.svg";
import redisImage from "../../extensions/official/redis/icon.svg";
import claudeImage from "../../extensions/official/claude-code/icon.svg";
import geminiImage from "../../extensions/official/gemini-cli/icon.svg";
import antigravityImage from "../../extensions/official/antigravity/icon.svg";
import copilotImage from "../../extensions/official/github-copilot/icon.svg";
import kimiImage from "../../extensions/official/kimi-cli/icon.svg";
import opencodeImage from "../../extensions/official/opencode/icon.svg";
import qwenImage from "../../extensions/official/qwen-code/icon.svg";
import type { SVGProps } from "react";

/**
 * Brand marks are not UI icons.
 *
 * They carry a third party's fixed artwork, so they keep their own viewBox and
 * fill, opt out of the `src/ui/icons` stroke system, and must not be redrawn to
 * match the icon grid. Product concepts belong in `src/ui/icons` instead.
 */
export type BrandMarkProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export function GithubMark({ size = "1em", ...props }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M7.499 0.25A7.25 7.25 0 0 0 5.208 14.38c.363.066.495-.158.495-.35 0-.172-.006-.628-.01-1.233-2.016.438-2.442-.972-2.442-.972-.33-.838-.805-1.061-.805-1.061-.658-.449.05-.44.05-.44.728.051 1.11.747 1.11.747.647 1.108 1.697.788 2.11.602.066-.468.254-.788.46-.969-1.61-.183-3.302-.806-3.302-3.583 0-.792.283-1.438.747-1.945-.075-.184-.324-.92.07-1.919 0 0 .609-.195 1.994.743a6.97 6.97 0 0 1 1.815-.244A6.97 6.97 0 0 1 9.315 4c1.384-.938 1.992-.743 1.992-.743.396.998.147 1.735.073 1.919.464.507.745 1.153.745 1.945 0 2.785-1.696 3.398-3.31 3.577.26.224.491.666.491 1.343 0 .969-.009 1.751-.009 1.989 0 .194.131.42.499.349A7.25 7.25 0 0 0 7.499.25Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GoogleMark({ size = "1em", ...props }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export const agentBrandImages: Readonly<Record<string, string>> = {
  blimy: "/logo.png",
  "claude-acp": claudeImage,
  anthropic: claudeImage,
  "gemini-cli": geminiImage,
  google: geminiImage,
  gemini: geminiImage,
  "antigravity-acp": antigravityImage,
  "github-copilot-cli": copilotImage,
  "kimi-cli": kimiImage,
  opencode: opencodeImage,
  "qwen-code": qwenImage,
  qwen: qwenImage,
};

const databaseBrandImages = {
  sqlite: sqliteImage,
  duckdb: duckdbImage,
  postgres: postgresImage,
  mysql: mysqlImage,
  mongodb: mongodbImage,
  redis: redisImage,
};

type DatabaseBrand = keyof typeof databaseBrandImages;

export function getDatabaseBrandImage(providerOrExtensionId: string): string | undefined {
  const provider = providerOrExtensionId.replace(/^blimy\.database\./, "");
  return Object.prototype.hasOwnProperty.call(databaseBrandImages, provider)
    ? databaseBrandImages[provider as DatabaseBrand]
    : undefined;
}

export function DatabaseBrandMark({
  provider,
  size = "1em",
}: {
  provider: DatabaseBrand;
  size?: number | string;
}) {
  return (
    <img
      src={getDatabaseBrandImage(provider)}
      alt=""
      draggable={false}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
