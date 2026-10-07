import { useAgentOptions } from "@/features/ai/hooks/use-agent-options";
import type { AgentOption } from "@/features/ai/lib/agent-options";
import Badge from "@/ui/badge";
import { Button } from "@/ui/button";
import { ArrowClockwiseIcon } from "@/ui/icons";
import { Spinner } from "@/ui/spinner";
import Section, { SettingRow, SettingStatus } from "../settings-section";

function AgentStatus({ agent }: { agent: AgentOption }) {
  if (agent.isInstalled) return <Badge tone="success">Installed</Badge>;
  return <Badge>Not installed</Badge>;
}

function getAgentIconUrl(agent: AgentOption) {
  const name = agent.name.toLowerCase();
  const id = agent.id.toLowerCase();

  let iconName = `${id}-color.jpg`;
  if (name.includes("codex") || name.includes("openai") || name.includes("gpt"))
    iconName = "openai-color.jpg";
  else if (name.includes("claude") || name.includes("anthropic")) iconName = "anthropic-color.jpg";
  else if (name.includes("gemini") || name.includes("google")) iconName = "google-color.jpg";
  else if (name.includes("meta") || name.includes("llama")) iconName = "meta-color.jpg";
  else if (name.includes("mistral")) iconName = "mistral-color.jpg";
  else if (name.includes("cohere")) iconName = "cohere-color.jpg";

  return `https://raw.githubusercontent.com/TypingMind/model-icons/main/icons/${iconName}`;
}

const AGENT_LOGOS = [
  "/agent-logos/claude-logo_svgstack_com_36971791191828-removebg-preview.png",
  "/agent-logos/codex-removebg-preview.png",
  "/agent-logos/copilot-app-logo_svgstack_com_36941791191936-removebg-preview.png",
  "/agent-logos/gemini-logo_svgstack_com_37141791191852-removebg-preview.png",
  "/agent-logos/google-antigravity-logo.webp",
  "/agent-logos/kimi-com-logo.png",
  "/agent-logos/opencode-ai-logo.png",
  "/agent-logos/qwenlm-app-logo_svgstack_com_37531791191981-removebg-preview.png",
];

// Generate a deterministic scattered layout
const SCATTERED_LOGOS = Array.from({ length: 24 }).map((_, i) => {
  const isTopRow = i % 2 === 0;
  const x = (i / 24) * 120 - 10; // spread across 120% of width to ensure edge coverage
  const y = isTopRow ? 10 + (i % 3) * 5 : 55 + (i % 3) * -5;
  const rotate = (i % 5) * 6 - 12; // -12deg to 12deg
  const scale = 0.85 + (i % 3) * 0.1;
  const logo = AGENT_LOGOS[i % AGENT_LOGOS.length];

  return { id: i, x, y, rotate, scale, logo };
});

/**
 * Coding agents made by other companies that blimy can run, such as Codex or Claude Code. They
 * sign in with their own accounts and pick their own models.
 */
export function AgentsSection() {
  const { options, isLoading, loadError, refresh, runAgentAction } = useAgentOptions("custom");
  const agents = options.filter((agent) => agent.id !== "custom");

  return (
    <Section title="Agents">
      <style>{`
        @keyframes float-agent {
          0%, 100% { transform: translateY(0px) rotate(var(--rot)) scale(var(--scale)); }
          50% { transform: translateY(-10px) rotate(calc(var(--rot) + 2deg)) scale(var(--scale)); }
        }
        .animate-float-agent {
          animation: float-agent 8s ease-in-out infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      <div className="relative mb-6 h-40 w-full overflow-hidden rounded-xl border border-overlay-border shadow-sm">
        <img
          src="/agent-banner.jpg"
          alt="Available AI Agents Banner"
          className="block h-full w-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px]" />

        {/* Scattered Logos */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {SCATTERED_LOGOS.map((item, i) => (
            <div
              key={item.id}
              className="absolute animate-float-agent"
              style={
                {
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  "--rot": `${item.rotate}deg`,
                  "--scale": item.scale,
                  "--delay": `${(i % 7) * -1.2}s`,
                  pointerEvents: "auto",
                } as React.CSSProperties
              }
            >
              <div className="flex size-9 items-center justify-center overflow-hidden rounded-[10px] border border-white/20 bg-white shadow-lg backdrop-blur-md transition-transform duration-500 hover:scale-125 hover:z-10 cursor-default">
                <img
                  src={item.logo}
                  alt="Agent Logo"
                  className="size-full object-contain p-[3px]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {agents.map((agent) => {
        const action = agent.action;
        const isCodex = agent.id === "codex";

        return (
          <SettingRow
            key={agent.id}
            label={agent.name}
            labelAccessory={<AgentStatus agent={agent} />}
            description={agent.description}
            activateOnClick={false}
          >
            {agent.isBusy ? (
              <Spinner compact label={action === "update" ? "Updating" : "Installing"} />
            ) : action ? (
              <Button onClick={() => void runAgentAction(agent.id, agent.name, action)}>
                {action === "update" ? "Update" : "Install"}
              </Button>
            ) : agent.needsSetup || isCodex ? (
              <Button
                onClick={() => {
                  document
                    .querySelector('[data-settings-section="Codex"]')
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {agent.isInstalled ? "Settings" : "Setup"}
              </Button>
            ) : null}
          </SettingRow>
        );
      })}
      {isLoading ? (
        <SettingRow label="Looking for agents" activateOnClick={false}>
          <Spinner compact label="Loading agents" />
        </SettingRow>
      ) : null}
      {loadError ? (
        <SettingRow
          label="Could not load agents"
          description={<SettingStatus tone="danger">{loadError}</SettingStatus>}
        >
          <Button onClick={() => void refresh()}>
            <ArrowClockwiseIcon />
            <span>Try again</span>
          </Button>
        </SettingRow>
      ) : null}
    </Section>
  );
}
