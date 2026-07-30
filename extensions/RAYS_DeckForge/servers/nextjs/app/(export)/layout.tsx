import React from "react";

/**
 * Do not wrap with ConfigurationInitializer: it always mounts with isLoading=true
 * and only clears after useEffect, so headless PDF/PPTX export captures the
 * "Initializing Application" screen. Export only needs the slide renderer; no LLM check.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
