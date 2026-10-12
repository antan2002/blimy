import { useMemo, useState } from "react";
import type { McpServerSetting } from "@/features/ai/types/mcp-server.types";
import {
  storeMcpServerSecrets,
  removeMcpServerSecrets,
} from "@/features/ai/services/mcp-server-secrets";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown";
import { CheckIcon, ChevronDownIcon, DownloadIcon, SearchIcon } from "@/ui/icons";
import {
  marketplaceMcpServers,
  MCP_CATEGORIES,
  type MarketplaceMcpServer,
} from "@/features/ai/components/mcp/mcp-marketplace-data";
import AppDialog from "@/ui/dialog";
import { cn } from "@/utils/cn";
import { McpServerIcon } from "./mcp-server-icon";

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
  const [selectedServer, setSelectedServer] = useState<MarketplaceMcpServer | null>(null);

  const activeCategoryInfo = useMemo(
    () => MCP_CATEGORIES.find((c) => c.name === category),
    [category],
  );

  const getCategoryCount = (catName: string) => {
    return marketplaceMcpServers.filter((s) => s.category === catName).length;
  };

  const filtered = marketplaceMcpServers.filter((s) => {
    const text = (s.name + " " + s.description + " " + s.category).toLowerCase();
    const matchSearch = text.includes(search.toLowerCase());
    const matchCat = category === "All" || category === "Enabled" || s.category === category;

    if (category === "Enabled") {
      const isInstalled = servers.some((installed) => installed.name === s.settings.name);
      return matchSearch && isInstalled;
    }

    return matchSearch && matchCat;
  });

  const isInstalled = (server: MarketplaceMcpServer) =>
    servers.some((installed) => installed.name === server.settings.name);

  const handleInstall = (
    marketServer: MarketplaceMcpServer,
    envOverrides?: { name: string; value: string }[],
    argsOverrides?: string[],
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();

    const existingIndex = servers.findIndex((s) => s.name === marketServer.settings.name);

    if (existingIndex !== -1) {
      // Update existing
      const nextServers = [...servers];
      nextServers[existingIndex] = {
        ...nextServers[existingIndex],
        args: argsOverrides || marketServer.settings.args,
      };
      saveServers(nextServers);
      void storeMcpServerSecrets(nextServers[existingIndex].id, {
        env: envOverrides || marketServer.settings.env,
        headers: marketServer.settings.headers,
      });
      showToast({ message: `${marketServer.name} configuration saved`, type: "success" });
    } else {
      // Install new
      const newId = crypto.randomUUID();
      saveServers([
        ...servers,
        {
          id: newId,
          name: marketServer.settings.name,
          transport: marketServer.settings.transport,
          command: marketServer.settings.command,
          args: argsOverrides || marketServer.settings.args,
          url: marketServer.settings.url,
          enabled: true,
        },
      ]);
      void storeMcpServerSecrets(newId, {
        env: envOverrides || marketServer.settings.env,
        headers: marketServer.settings.headers,
      });
      showToast({ message: `${marketServer.name} connected successfully`, type: "success" });
    }
  };

  const handleUninstall = (marketServer: MarketplaceMcpServer) => {
    const serverId = servers.find((s) => s.name === marketServer.settings.name)?.id;
    if (serverId) void removeMcpServerSecrets(serverId);
    saveServers(servers.filter((s) => s.name !== marketServer.settings.name));
    showToast({ message: `${marketServer.name} disconnected`, type: "info" });
  };

  return (
    <div className="flex flex-col gap-px rounded-lg bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between shrink-0 px-4 py-3 border-b border-border bg-surface">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-md py-1.5 px-2 hover:bg-accent text-foreground font-semibold ui-text-chrome transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus" />
            }
          >
            <span className="ui-text-base">
              MCP servers
              {category === "Enabled" ? " · Enabled" : ""}
              {activeCategoryInfo
                ? ` · ${activeCategoryInfo.number} ${activeCategoryInfo.name}`
                : category !== "All" && category !== "Enabled"
                  ? ` · ${category}`
                  : ""}
            </span>
            <ChevronDownIcon className="text-muted-foreground" size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent viewport="default" size="panel" align="start">
            <DropdownMenuItem
              onClick={() => setCategory("All")}
              className={cn(
                "flex items-center justify-between py-1.5 px-2.5 rounded-md cursor-pointer",
                category === "All" && "bg-accent font-medium",
              )}
            >
              <span className="flex-1 ui-text-sm">All MCP servers</span>
              <div className="flex items-center gap-1.5">
                <span className="text-subtle-foreground font-mono ui-text-caption tabular-nums">
                  {marketplaceMcpServers.length}
                </span>
                {category === "All" && <CheckIcon size={12} className="text-primary" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCategory("Enabled")}
              className={cn(
                "flex items-center justify-between py-1.5 px-2.5 rounded-md cursor-pointer",
                category === "Enabled" && "bg-accent font-medium",
              )}
            >
              <span className="flex-1 ui-text-sm">Enabled / Connected</span>
              <div className="flex items-center gap-1.5">
                <span className="text-subtle-foreground font-mono ui-text-caption tabular-nums">
                  {servers.length}
                </span>
                {category === "Enabled" && <CheckIcon size={12} className="text-primary" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40 text-subtle-foreground ui-text-caption font-semibold tracking-wide">
              <div className="flex items-center gap-3">
                <span className="w-5 font-mono">#</span>
                <span>Category & what it covers</span>
              </div>
              <span className="tabular-nums">Servers</span>
            </div>
            <DropdownMenuGroup>
              {MCP_CATEGORIES.map((cat) => {
                const isSelected = category === cat.name;
                const count = getCategoryCount(cat.name);
                return (
                  <DropdownMenuItem
                    key={cat.number}
                    onClick={() => setCategory(cat.name)}
                    className={cn(
                      "flex items-start gap-3 py-2 px-2.5 rounded-md cursor-pointer transition-colors",
                      isSelected && "bg-accent text-accent-foreground font-medium",
                    )}
                  >
                    <span className="font-mono ui-text-caption font-semibold text-muted-foreground w-5 shrink-0 pt-0.5">
                      {cat.number}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground ui-text-sm leading-tight truncate">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-subtle-foreground font-mono ui-text-caption tabular-nums">
                            {count}
                          </span>
                          {isSelected && <CheckIcon size={12} className="text-primary" />}
                        </div>
                      </div>
                      <span className="ui-text-caption text-muted-foreground truncate leading-normal">
                        {cat.covers}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 w-full max-w-md ml-auto">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or install NPM package via bunx..."
            aria-label="Search MCP servers"
            leftIcon={SearchIcon}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim() && filtered.length === 0) {
                const pkg = search.trim();
                saveServers([
                  ...servers,
                  {
                    id: crypto.randomUUID(),
                    name: pkg.split("/").pop() || pkg,
                    transport: "stdio",
                    command: "bunx",
                    args: [pkg],
                    url: "",
                    enabled: true,
                  },
                ]);
                setSearch("");
                showToast({ message: `Installed ${pkg} via bunx`, type: "success" });
              }
            }}
          />
          {search.trim() && filtered.length === 0 && (
            <Button
              variant="accent"
              onClick={() => {
                const pkg = search.trim();
                saveServers([
                  ...servers,
                  {
                    id: crypto.randomUUID(),
                    name: pkg.split("/").pop() || pkg,
                    transport: "stdio",
                    command: "bunx",
                    args: [pkg],
                    url: "",
                    enabled: true,
                  },
                ]);
                setSearch("");
                showToast({ message: `Installed ${pkg} via bunx`, type: "success" });
              }}
            >
              Install
            </Button>
          )}
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
                    <span className="font-medium ui-text-chrome text-foreground">
                      {server.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {enabled ? (
                      <Badge tone="success">Installed</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        iconOnly
                        onClick={(e) => handleInstall(server, undefined, undefined, e)}
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
          onInstall={(envValues, args) => handleInstall(selectedServer, envValues, args)}
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
  server: MarketplaceMcpServer;
  isInstalled: boolean;
  onClose: () => void;
  onInstall: (envValues: { name: string; value: string }[], args: string[]) => void;
  onUninstall: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"about" | "configure">("about");
  const [envValues, setEnvValues] = useState(() => server.settings.env.map((e) => ({ ...e })));
  const [argsString, setArgsString] = useState(() => server.settings.args.join(" "));

  return (
    <AppDialog title={server.name} size="settings" contentLayout="flush" onClose={onClose}>
      <div className="flex flex-col h-137.5">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-4">
            <McpServerIcon serverId={server.id} name={server.name} size={48} />
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold ui-text-chrome">{server.name}</h2>
                {isInstalled && (
                  <Badge tone="success">
                    <CheckIcon />
                    Installed
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
                {server.description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 mt-1">
            {!isInstalled && (
              <Button
                variant="accent"
                onClick={() => onInstall(envValues, argsString.split(" ").filter(Boolean))}
              >
                Install
              </Button>
            )}
            {isInstalled && (
              <Button variant="outline" onClick={onUninstall}>
                Uninstall
              </Button>
            )}
          </div>
        </div>

        {/* Layout */}
        <div className="flex flex-1 min-h-0 bg-background">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-surface/30 p-4 flex flex-col gap-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab("about")}
              className={cn(
                "px-3 py-2 text-left rounded-md text-sm font-medium transition-colors outline-none",
                activeTab === "about"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              About
            </button>
            <div
              className="relative group"
              title={
                !isInstalled
                  ? "Install the server first to see the configuration options."
                  : undefined
              }
            >
              <button
                disabled={!isInstalled}
                onClick={() => isInstalled && setActiveTab("configure")}
                className={cn(
                  "w-full px-3 py-2 text-left rounded-md text-sm font-medium transition-colors outline-none",
                  !isInstalled && "opacity-50 cursor-not-allowed",
                  activeTab === "configure"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                Configure
              </button>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {activeTab === "about" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold ui-text-chrome">About {server.name}</h3>
                  <Badge>{server.category}</Badge>
                </div>
                <p className="text-foreground leading-relaxed text-sm">{server.description}</p>
                {server.gotcha && (
                  <div className="p-3.5 border border-border bg-accent/30 rounded-lg flex flex-col gap-1">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Best Practice & Notes
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed">{server.gotcha}</p>
                  </div>
                )}
                {server.link && (
                  <div>
                    <a
                      href={server.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground underline flex items-center gap-1 font-medium transition-colors"
                    >
                      Official Documentation & Repository &rarr;
                    </a>
                  </div>
                )}
                <div className="mt-2 p-4 border border-border rounded-lg bg-surface/50 flex flex-col gap-2">
                  <h4 className="font-semibold ui-text-chrome text-sm">Connection</h4>
                  <p className="text-sm text-muted-foreground">
                    {server.settings.transport === "http" || server.settings.transport === "sse"
                      ? "Remote endpoint connection:"
                      : "Command-line execution launcher:"}
                  </p>
                  <code className="block mt-1 p-3 rounded-md bg-background border border-border text-xs text-muted-foreground font-mono select-all">
                    {server.settings.transport === "http" || server.settings.transport === "sse"
                      ? server.settings.url
                      : `${server.settings.command || "bunx"} ${server.settings.args.join(" ")}`}
                  </code>
                </div>
              </div>
            )}

            {activeTab === "configure" && isInstalled && (
              <div className="flex flex-col gap-6 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-medium ui-text-chrome">Execution arguments</h3>
                    <p className="text-sm text-muted-foreground">
                      Replace any placeholder paths, dummy URLs, or dummy values below with your
                      real setup.
                    </p>
                  </div>
                  <Input value={argsString} onChange={(e) => setArgsString(e.target.value)} />
                </div>

                {envValues.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-medium ui-text-chrome">Environment Variables</h3>
                      <p className="text-sm text-muted-foreground">
                        Provide the required API keys or secrets to authenticate this server.
                      </p>
                    </div>
                    {envValues.map((env, i) => (
                      <div key={env.name} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">{env.name}</label>
                        <Input
                          type="password"
                          value={env.value}
                          onChange={(e) => {
                            const next = [...envValues];
                            next[i].value = e.target.value;
                            setEnvValues(next);
                          }}
                          placeholder={`Enter ${env.name}...`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-border mt-2">
                  <Button
                    variant="accent"
                    onClick={() => onInstall(envValues, argsString.split(" ").filter(Boolean))}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}

const MCP_BANNER_IMAGE = "/mcp-image.jpg";

export function McpServerSettings() {
  const servers = useSettingsStore((state) => state.settings.mcpServers);
  const updateSetting = useSettingsStore((state) => state.actions.updateSetting);

  const saveServers = (next: McpServerSetting[]) => updateSetting("mcpServers", next);

  return (
    <div className="flex flex-col">
      <div className="relative mb-6 h-40 w-full overflow-hidden rounded-xl border border-overlay-border bg-surface shadow-sm">
        {MCP_BANNER_IMAGE ? (
          <img
            src={MCP_BANNER_IMAGE}
            alt="MCP Servers Banner"
            className="block h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-surface via-accent/30 to-surface" />
        )}
        <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px]" />
      </div>
      <McpMarketplaceList servers={servers} saveServers={saveServers} />
    </div>
  );
}
