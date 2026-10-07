const fs = require("fs");

const data = JSON.parse(fs.readFileSync("merge_mcp_config2.json", "utf8"));

const result = [];
for (const [key, value] of Object.entries(data.mcpServers)) {
  result.push({
    id: key,
    name: value.meta && value.meta.name ? value.meta.name : key,
    description: value.meta && value.meta.description ? value.meta.description : "",
    settings: {
      name: value.meta && value.meta.name ? value.meta.name : key,
      transport: value.transport || "stdio",
      command: value.command || "npx",
      args: value.args || [],
      env: value.env || {},
      enabled: true,
    },
  });
}

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
