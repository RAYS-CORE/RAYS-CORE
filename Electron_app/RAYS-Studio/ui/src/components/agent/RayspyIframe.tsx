import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function RayspyIframe() {
  const location = useLocation();
  const isVisible = location.pathname === "/rayspy";

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
        top: 36, // Below the AppHeader (which is h-9 = 36px)
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        backgroundColor: "var(--background)",
      }}
    >
      {hasVisited && (
        <iframe
          src="http://localhost:5176"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
        title="Rayspy Interface"
        />
      )}
    </div>
  );
}
