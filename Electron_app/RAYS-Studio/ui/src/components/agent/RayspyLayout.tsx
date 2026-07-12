import { useState } from "react";
import { AppHeader } from "@/components/ide/AppHeader";
import { SettingsModal } from "@/components/ide/SettingsModal";

export default function RayspyLayout() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <AppHeader onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {/* The actual iframe is rendered globally by AppShell and positioned below the header */}
      <div className="flex-1" />
    </div>
  );
}
