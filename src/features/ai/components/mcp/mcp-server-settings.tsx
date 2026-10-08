import { useMemo, useState } from "react";
import type { McpServerSetting } from "@/features/ai/types/mcp-server.types";
import { useToast } from "@/features/layout/contexts/toast-context";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { Button } from "@/ui/button";
import Input from "@/ui/input";
import Badge from "@/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown";
import { CheckIcon, ChevronDownIcon, DownloadIcon, SearchIcon } from "@/ui/icons";
import { marketplaceMcpServers } from "@/features/ai/components/mcp/mcp-marketplace-data";
import AppDialog from "@/ui/dialog";
import { cn } from "@/utils/cn";
import { McpServerIcon } from "./mcp-server-icon";

const categoriesList = [
  "Ecommerce",
  "Marketing",
  "Messaging",
  "Productivity",
  "Sales",
  "Security",
  "Google",
  "Microsoft",
  "Tools",
  "Data",
  "Search",
  "Code",
  "Other",
];

function getCategory(s: (typeof marketplaceMcpServers)[0]) {
  const text = (s.name + " " + s.description).toLowerCase();
  if (
    text.includes("search") ||
    text.includes("web") ||
    text.includes("fetch") ||
    text.includes("exa") ||
    text.includes("firecrawl")
  )
    return "Search";
  if (
    text.includes("data") ||
    text.includes("sql") ||
    text.includes("postgres") ||
    text.includes("mysql") ||
    text.includes("sqlite") ||
    text.includes("database")
  )
    return "Data";
  if (
    text.includes("code") ||
    text.includes("git") ||
    text.includes("github") ||
    text.includes("gitlab")
  )
    return "Code";
  if (text.includes("memory") || text.includes("brain")) return "Productivity";
  if (text.includes("google")) return "Google";
  if (text.includes("tool") || text.includes("api")) return "Tools";
  return "Other";
}

function matchesServer(
  installed: { command?: string; args: string[] },
  target: { command: string; args: string[] },
) {
  return installed.command === target.command && installed.args.join(" ") === target.args.join(" ");
}

function McpMarketplaceList({
  servers,
  saveServers,
}: {
  servers: McpServerSetting[];
  saveServers: (next: McpServerSetting[]) => void;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedServer, setSelectedServer] = useState<(typeof marketplaceMcpServers)[0] | null>(
    null,
  );

  const activeCategories = useMemo(() => {
    const cats = new Set(marketplaceMcpServers.map((s) => getCategory(s)));
    return categoriesList.filter((c) => cats.has(c as any));
  }, []);

  const getCategoryCount = (cat: string) => {
    return marketplaceMcpServers.filter((s) => getCategory(s) === cat).length;
  };

  const filtered = marketplaceMcpServers.filter((s) => {
    const text = (s.name + " " + s.description).toLowerCase();
    const matchSearch = text.includes(search.toLowerCase());
    const matchCat = category === "All" || category === "Enabled" || getCategory(s) === category;

    if (category === "Enabled") {
      const isInstalled = servers.some((installed) => matchesServer(installed, s.settings));
      return matchSearch && isInstalled;
    }

    return matchSearch && matchCat;
  });

  const isInstalled = (server: (typeof marketplaceMcpServers)[0]) =>
    servers.some((installed) => matchesServer(installed, server.settings));

  const handleInstall = (marketServer: (typeof marketplaceMcpServers)[0], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    saveServers([...servers, { ...marketServer.settings, enabled: true, id: crypto.randomUUID() }]);
    showToast({ message: `${marketServer.name} connected successfully`, type: "success" });
  };

  const handleUninstall = (marketServer: (typeof marketplaceMcpServers)[0]) => {
    saveServers(servers.filter((s) => !matchesServer(s, marketServer.settings)));
    showToast({ message: `${marketServer.name} disconnected`, type: "info" });
  };

  return (
    <div className="flex flex-col gap-px rounded-lg bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between shrink-0 px-4 py-3 border-b border-border bg-surface">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-2 rounded-md py-1.5 px-2 hover:bg-accent text-foreground font-semibold ui-text-chrome transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            }
          >
            <span className="ui-text-base">MCP servers {category !== "All" ? `· ${category}` : ""}</span>
            <ChevronDownIcon className="text-muted-foreground" size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent viewport="default" size="wide" align="start">
            <DropdownMenuItem onClick={() => setCategory("Enabled")}>
              <span className="flex-1">Enabled</span>
              <span className="text-subtle-foreground tabular-nums">{servers.length}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategory("All")}>
              <span className="flex-1">All</span>
              <span className="text-subtle-foreground tabular-nums">{marketplaceMcpServers.length}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              {activeCategories.map((c) => (
                <DropdownMenuItem key={c} onClick={() => setCategory(c)}>
                  <span className="flex-1">{c}</span>
                  <span className="text-subtle-foreground tabular-nums">{getCategoryCount(c)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-64">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MCP servers..."
            aria-label="Search MCP servers"
            leftIcon={SearchIcon}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col bg-surface">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <Empty variant="region" tone="neutral">
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No connectors found</EmptyTitle>
                <EmptyDescription>
                  {search.trim()
                    ? `Nothing matches "${search}" in this category.`
                    : "Enable a connector from the list to make its tools available to agents."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            {filtered.map((server) => {
              const enabled = isInstalled(server);
              return (
                <div
                  key={server.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedServer(server)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedServer(server);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border p-3",
                    "border-border bg-surface outline-none transition-colors",
                    "hover:border-border-strong hover:bg-accent text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-focus",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium ui-text-chrome text-foreground">{server.name}</span>
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-3">
                    {enabled ? (
                      <Badge tone="success">
                        Installed
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        iconOnly
                        onClick={(e) => handleInstall(server, e)}
                        aria-label={`Install ${server.name}`}
                      >
                        <DownloadIcon />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedServer ? (
        <ServerSettingsDialog
          server={selectedServer}
          isInstalled={isInstalled(selectedServer)}
          onClose={() => setSelectedServer(null)}
          onInstall={() => handleInstall(selectedServer)}
          onUninstall={() => handleUninstall(selectedServer)}
        />
      ) : null}
    </div>
  );
}

function ServerSettingsDialog({
  server,
  isInstalled,
  onClose,
  onInstall,
  onUninstall,
}: {
  server: (typeof marketplaceMcpServers)[0];
  isInstalled: boolean;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <AppDialog title="Connector details" size="settings" contentLayout="flush" onClose={onClose}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start gap-4">
          <McpServerIcon serverId={server.id} name={server.name} size={48} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-semibold ui-text-base">{server.name}</h2>
              {isInstalled ? (
                <Badge tone="success">
                  <CheckIcon />
                  Enabled
                </Badge>
              ) : null}
            </div>
            {server.description ? (
              <p className="line-clamp-2 text-muted-foreground ui-text-caption">
                {server.description}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          variant={isInstalled ? "outline" : "accent"}
          onClick={isInstalled ? onUninstall : onInstall}
        >
          {isInstalled ? "Disable for workspace" : "Enable for workspace"}
        </Button>

        <div className="flex flex-col gap-2">
          <h3 className="font-medium ui-text-chrome">Execution command</h3>
          <code className="block rounded-md border border-border bg-surface p-3 font-mono ui-text-caption text-foreground">
            {server.settings.command} {server.settings.args.join(" ")}
          </code>
        </div>
      </div>
    </AppDialog>
  );
}

export function McpServerSettings() {
  const servers = useSettingsStore((state) => state.settings.mcpServers);
  const updateSetting = useSettingsStore((state) => state.actions.updateSetting);

  const saveServers = (next: McpServerSetting[]) => updateSetting("mcpServers", next);

  return <McpMarketplaceList servers={servers} saveServers={saveServers} />;
}
