import { AppHeader } from "@/components/ide/AppHeader";
import { useState, useEffect } from "react";

export default function SpyLayout() {
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    // Check if the Spy proxy-server is running
    fetch("http://localhost:5173/rayspy/")
      .then(res => {
        if (res.ok) {
          setServerStatus("online");
        } else {
          setServerStatus("offline");
        }
      })
      .catch(() => setServerStatus("offline"));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background font-sans">
      <AppHeader
        onOpenSettings={() => {}}
        onOpenSkills={() => {}}
        onOpenMcp={() => {}}
      />
      <div className="flex-1 overflow-hidden relative bg-black">
        {serverStatus === "online" ? (
          <iframe 
            src="http://localhost:5173/rayspy/" 
            className="w-full h-full border-none"
            title="RAYS Spy OSINT"
          />
        ) : serverStatus === "checking" ? (
          <div className="w-full h-full flex items-center justify-center text-rays-violet font-bold animate-pulse">
            Checking RAYS Spy Server...
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-black/90">
            <h2 className="text-rays-pink text-2xl font-bold mb-4">RAYS Spy Server is Offline</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              The OSINT dashboard could not be loaded because the local Spy server is not running on port 5174.
            </p>
            <div className="mt-6 text-xs text-muted-foreground bg-secondary/30 p-4 rounded text-left border border-border/20">
              <p className="mb-2 text-foreground font-mono">To start the RAYS Spy server, run:</p>
              <code className="bg-background px-2 py-1 rounded text-rays-violet">cd examples/skills/rayspy && npm run dev</code>
            </div>
            <button 
              onClick={() => setServerStatus("checking")}
              className="mt-6 bg-rays-violet hover:bg-rays-violet/80 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
