import { useState } from "react";
import WindowMenuBar from "@/features/window/components/window-menu-bar";

/**
 * The leading end of the title bar, next to the window controls.
 * Shows the application menu.
 */
export function TitleLeading() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div
      data-slot="title-leading"
      className="absolute inset-y-0 left-0 z-10 flex min-w-0 items-center gap-0.5 pl-title-bar-leading"
    >
      <div className="flex h-full items-center justify-center pl-2 pr-3">
        <img src="/logo.png" className="size-4 object-contain select-none pointer-events-none" alt="Blimy" />
      </div>
      <WindowMenuBar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
    </div>
  );
}
