import type { McpServerSetting } from "@/features/ai/types/mcp-server.types";

export interface MarketplaceMcpServer {
  id: string;
  name: string;
  description: string;
  settings: Omit<McpServerSetting, "id">;
}

export const marketplaceMcpServers: MarketplaceMcpServer[] = [
  {
    id: "mcp-postgres",
    name: "PostgreSQL",
    description: "Read-only database access with schema inspection.",
    settings: {
      name: "PostgreSQL",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-google-drive",
    name: "Google Drive",
    description: "File access and search for Google Drive.",
    settings: {
      name: "Google Drive",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-gdrive"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-fetch",
    name: "Fetch",
    description: "Web content fetching and conversion for LLM usage.",
    settings: {
      name: "Fetch",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-puppeteer",
    name: "Puppeteer",
    description: "Browser automation and web scraping.",
    settings: {
      name: "Puppeteer",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-github",
    name: "GitHub",
    description: "Repository management, file operations, and GitHub API access.",
    settings: {
      name: "GitHub",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-brave-search",
    name: "Brave Search",
    description: "Web search capabilities using Brave's Search API.",
    settings: {
      name: "Brave Search",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-sqlite",
    name: "SQLite",
    description: "Database interaction and querying for SQLite databases.",
    settings: {
      name: "SQLite",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-slack",
    name: "Slack",
    description: "Channel management and messaging capabilities.",
    settings: {
      name: "Slack",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-memory",
    name: "Memory",
    description: "Knowledge graph-based persistent memory system.",
    settings: {
      name: "Memory",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-google-maps",
    name: "Google Maps",
    description: "Location services, routing, and places data.",
    settings: {
      name: "Google Maps",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-google-maps"],
      env: {},
      enabled: true,
    },
  },
  {
    id: "mcp-filesystem",
    name: "Filesystem",
    description: "Secure file operations with configurable access controls.",
    settings: {
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      env: {},
      enabled: true,
    },
  },
];
