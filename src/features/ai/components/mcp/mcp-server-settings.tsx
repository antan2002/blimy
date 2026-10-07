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
      <Section title="Marketplace">
        {marketplaceMcpServers.map((marketServer) => {
          const isInstalled = servers.some(
            (s) =>
              s.command === marketServer.settings.command &&
              s.args.join(" ") === marketServer.settings.args.join(" ")
          );

          return (
            <SettingRow
              key={marketServer.id}
              label={marketServer.name}
              description={marketServer.description}
            >
              {isInstalled ? (
                <Button type="button" variant="ghost" disabled>
                  <CheckIcon />
                  <span>Installed</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="accent"
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
                  <DownloadIcon optical="md" />
                  <span>Connect</span>
                </Button>
              )}
            </SettingRow>
          );
        })}
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
