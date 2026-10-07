const fs = require("fs");
const data = JSON.parse(fs.readFileSync("clean_mcp_market.json", "utf8"));

const servers = data.map((d) => d.item).filter((i) => !!i);

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

fs.writeFileSync("src/features/ai/components/mcp/mcp-marketplace-data.ts", fileContent);
console.log("Generated mcp-marketplace-data.ts with", result.length, "servers");
