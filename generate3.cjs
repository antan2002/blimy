const fs = require("fs");
const { execSync } = require("child_process");

const all = JSON.parse(execSync("node scraper.js", { encoding: "utf8" }));
const servers = all.map((d) => d.item).filter((i) => !!i);

const result = servers.map((server) => {
  const id = server.url.split("/").pop();
  return {
    id: id,
    name: server.name,
    description: server.description || "",
    settings: {
      name: server.name,
      transport: "stdio",
      command: "npx",
      args: ["-y", `@modelcontextprotocol/server-${id}`],
      env: {},
      enabled: true,
    },
  };
});

const fileContent = `import type { McpServerSetting } from "@/features/ai/types/mcp-server.types";

export interface MarketplaceMcpServer {
  id: string;
  name: string;
  description: string;
  settings: Omit<McpServerSetting, "id">;
}

export const marketplaceMcpServers: MarketplaceMcpServer[] = ${JSON.stringify(result, null, 2)};
`;

fs.writeFileSync("src/features/ai/components/mcp/mcp-marketplace-data.ts", fileContent, "utf8");
console.log("Done:", result.length);
