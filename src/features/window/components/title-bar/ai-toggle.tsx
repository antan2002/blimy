import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { SparkleIcon } from "@/ui/icons";
import { cn } from "@/utils/cn";

/**
 * The master AI switch in the title bar. AI ships off, so no model is called until the
 * user turns it on here, or until they send a message or run an AI command, which counts
 * as calling it.
 */
export function AIToggle() {
  const aiEnabled = useSettingsStore((state) => state.settings.aiEnabled);

  return (
    <button
      type="button"
      aria-pressed={aiEnabled}
      aria-label={aiEnabled ? "Turn AI off" : "Turn AI on"}
      title={
        aiEnabled
          ? "AI is on — click to turn off"
          : "AI is off — Tab completion and background review are paused"
      }
      className={cn(
        "flex h-full items-center justify-center px-1.5 transition-colors hover:bg-accent hover:text-foreground",
        aiEnabled ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={() => {
        void useSettingsStore.getState().actions.updateSetting("aiEnabled", !aiEnabled);
      }}
    >
      <SparkleIcon className="size-4" filled={aiEnabled} />
    </button>
  );
}
