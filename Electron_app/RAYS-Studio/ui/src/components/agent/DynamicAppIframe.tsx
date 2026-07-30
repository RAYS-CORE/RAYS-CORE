import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function DynamicAppIframe() {
  const location = useLocation();
  // Listen for generic __OPEN_APP global variable (e.g. { url: "http://localhost:3000", title: "DeckForge" })
  const appState = (window as any).__OPEN_APP || null;
  const isVisible = location.pathname === "/app-extension" || appState !== null;

  const [hasVisited, setHasVisited] = useState(false);

  useEffect(() => {
    if (isVisible) setHasVisited(true);
  }, [isVisible]);

  return (
    <div
      style={{
        display: isVisible ? "block" : "none",
        width: "100%",
        position: "absolute",
        top: 36, // Below the AppHeader
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        backgroundColor: "var(--background)",
      }}
    >
      {hasVisited && appState?.url && (
        <iframe
          src={appState.url}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          title={appState.title || "App Interface"}
        />
      )}
    </div>
  );
}
