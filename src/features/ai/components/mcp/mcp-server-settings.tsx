import { useState } from "react";
import { McpServerDialog } from "@/features/ai/components/mcp/mcp-server-dialog";
import {
  createMcpServerDraft,
  describeMcpServer,
  MCP_TRANSPORT_LABELS,
  splitMcpServerDraft,
} from "@/features/ai/lib/mcp-servers";
import {
  getMcpServerSecrets,
  removeMcpServerSecrets,
  storeMcpServerSecrets,
} from "@/features/ai/services/mcp-server-secrets";
import type { McpServerDraft, McpServerSetting } from "@/features/ai/types/mcp-server.types";
import { useToast } from "@/features/layout/contexts/toast-context";
import Section, { SettingRow } from "@/features/settings/components/settings-section";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty";
import { showConfirmDialog } from "@/ui/dialog";
import { PencilIcon, PlusIcon, TrashIcon, CheckIcon, DownloadIcon } from "@/ui/icons";
import Switch from "@/ui/switch";
import { marketplaceMcpServers } from "@/features/ai/components/mcp/mcp-marketplace-data";
import { SearchIcon, ChevronDownIcon, ChevronUpIcon } from "@/ui/icons";

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
  const [visibleCount, setVisibleCount] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = ["All", "Tools", "Data", "Search", "Code", "Other"];

  const getCategory = (s: (typeof marketplaceMcpServers)[0]) => {
    const text = (s.name + " " + s.description).toLowerCase();
    if (text.includes("search") || text.includes("web") || text.includes("fetch")) return "Search";
    if (text.includes("data") || text.includes("sql") || text.includes("postgres")) return "Data";
    if (text.includes("code") || text.includes("git") || text.includes("github")) return "Code";
    if (text.includes("tool") || text.includes("api")) return "Tools";
    return "Other";
  };

  const filtered = marketplaceMcpServers.filter((s) => {
    const text = (s.name + " " + s.description).toLowerCase();
    const matchSearch = text.includes(search.toLowerCase());
    const matchCat = category === "All" || getCategory(s) === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--design-ink-secondary)] w-4 h-4" />
          <input
            type="text"
            placeholder="Search marketplace..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(10);
            }}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--design-line)] bg-[var(--design-glass)] text-sm focus:outline-none focus:border-[var(--design-line-strong)]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setVisibleCount(10);
          }}
          className="h-9 px-3 rounded-md border border-[var(--design-line)] bg-[var(--design-glass)] text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col border border-[var(--design-line)] rounded-lg divide-y divide-[var(--design-line)]">
        {filtered.slice(0, visibleCount).map((marketServer) => {
          const isInstalled = servers.some(
            (s) =>
              s.command === marketServer.settings.command &&
              s.args.join(" ") === marketServer.settings.args.join(" "),
          );
          const isExpanded = expandedId === marketServer.id;

          return (
            <div key={marketServer.id} className="flex flex-col">
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium text-sm text-[var(--design-ink)] truncate">
                    {marketServer.name}
                  </span>
                  <span className="text-xs text-[var(--design-ink-secondary)] line-clamp-1">
                    {marketServer.description}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-4 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : marketServer.id)}
                  >
                    About
                  </Button>
                  {isInstalled ? (
                    <Button type="button" variant="ghost" size="sm" disabled>
                      <CheckIcon />
                      <span>Installed</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        void saveServers([
                          ...servers,
                          { ...marketServer.settings, enabled: true, id: crypto.randomUUID() },
                        ]);
                        showToast({
                          message: `${marketServer.name} connected successfully`,
                          type: "success",
                        });
                      }}
                    >
                      <DownloadIcon optical="sm" />
                      <span>Connect</span>
                    </Button>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 text-sm text-[var(--design-ink-secondary)] bg-[var(--design-surface-subtle)]">
                  <p className="mt-2">{marketServer.description}</p>
                  <p className="mt-2 font-mono text-xs opacity-70">
                    Command: {marketServer.settings.command} {marketServer.settings.args.join(" ")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-[var(--design-ink-secondary)] text-sm">
            No servers found.
          </div>
        )}
      </div>

      {visibleCount < filtered.length && (
        <div className="flex justify-center mt-2">
          <Button type="button" variant="outline" onClick={() => setVisibleCount((v) => v + 20)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

export function McpServerSettings() {
  const servers = useSettingsStore((state) => state.settings.mcpServers);
  const updateSetting = useSettingsStore((state) => state.actions.updateSetting);
  const { showToast } = useToast();
  const [draft, setDraft] = useState<McpServerDraft | null>(null);

  const saveServers = (next: McpServerSetting[]) => updateSetting("mcpServers", next);

  const openEditor = async (server?: McpServerSetting) => {
    if (!server) {
      setDraft(createMcpServerDraft());
      return;
    }
    try {
      setDraft(createMcpServerDraft(server, await getMcpServerSecrets(server.id)));
    } catch {
      showToast({ message: `Could not read the saved values for ${server.name}`, type: "error" });
    }
  };

  const handleSave = async (nextDraft: McpServerDraft) => {
    const id = nextDraft.id ?? crypto.randomUUID();
    const { server, secrets } = splitMcpServerDraft(nextDraft, id);
    try {
      await storeMcpServerSecrets(id, secrets);
    } catch {
      showToast({ message: `Could not save the values for ${server.name}`, type: "error" });
      return;
    }
    const current = useSettingsStore.getState().settings.mcpServers;
    await saveServers(
      nextDraft.id
        ? current.map((existing) => (existing.id === id ? server : existing))
        : [...current, server],
    );
    setDraft(null);
  };

  const handleRemove = async (server: McpServerSetting) => {
    const confirmed = await showConfirmDialog(
      `Remove ${server.name}? Agents started after this will no longer get it.`,
      { title: "Remove MCP server", confirmLabel: "Remove" },
    );
    if (!confirmed) return;

    await saveServers(
      useSettingsStore.getState().settings.mcpServers.filter((item) => item.id !== server.id),
    );
    try {
      await removeMcpServerSecrets(server.id);
    } catch {
      showToast({ message: `Could not remove the saved values for ${server.name}`, type: "error" });
    }
  };

  const handleToggle = (server: McpServerSetting, enabled: boolean) => {
    void saveServers(
      useSettingsStore
        .getState()
        .settings.mcpServers.map((item) => (item.id === server.id ? { ...item, enabled } : item)),
    );
  };

  return (
    <>
      <Section
        title="MCP Servers"
        actions={
          <Button type="button" variant="ghost" onClick={() => void openEditor()}>
            <PlusIcon />
            <span>Add Server</span>
          </Button>
        }
      >
        {servers.length === 0 ? <EmptyState variant="section" message="No servers" /> : null}
        {servers.map((server) => (
          <SettingRow
            key={server.id}
            label={server.name}
            description={`${MCP_TRANSPORT_LABELS[server.transport]} · ${describeMcpServer(server)}`}
          >
            <div className="flex items-center gap-1">
              <Switch
                checked={server.enabled}
                onChange={(enabled) => handleToggle(server, enabled)}
                aria-label={`Pass ${server.name} to agents`}
              />
              <Button
                type="button"
                variant="ghost"
                iconOnly
                tooltip="Edit"
                aria-label={`Edit ${server.name}`}
                onClick={() => void openEditor(server)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                tone="danger"
                iconOnly
                tooltip="Remove"
                aria-label={`Remove ${server.name}`}
                onClick={() => void handleRemove(server)}
              >
                <TrashIcon />
              </Button>
            </div>
          </SettingRow>
        ))}
      </Section>
      <div className="mt-8" />
      <Section title={`Marketplace (${marketplaceMcpServers.length} Servers)`}>
        <McpMarketplaceList servers={servers} saveServers={saveServers} />
      </Section>
      {draft ? (
        <McpServerDialog
          initialDraft={draft}
          servers={servers}
          onClose={() => setDraft(null)}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}
