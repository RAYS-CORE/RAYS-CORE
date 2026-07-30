"use client";

import Wrapper from "@/components/Wrapper";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const PATHS_WITH_HEADER_BACK = [
  "/upload",
  "/outline",
  "/documents-preview",
  "/template-preview",
] as const;

function pathMatches(pathname: string | null, base: string) {
  return pathname === base || pathname?.startsWith(`${base}/`) === true;
}

const Header = () => {
  const pathname = usePathname();
  const showHeaderBack = PATHS_WITH_HEADER_BACK.some((p) => pathMatches(pathname, p));

  const backToUpload =
    pathMatches(pathname, "/outline") || pathMatches(pathname, "/documents-preview");
  const backToTemplates = pathMatches(pathname, "/template-preview");

  const backHref = backToUpload ? "/upload" : backToTemplates ? "/templates" : "/dashboard";
  const backLabel = backToUpload
    ? "BACK"
    : backToTemplates
      ? "BACK"
      : "BACK";

  return (
    <div className="w-full   sticky top-0 z-50 py-7 "
      style={{
        background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0) 110.67%)",

      }}
    >
      <Wrapper className="px-5 sm:px-10 lg:px-20">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <img
              src="/logo-with-bg.png"
              alt="Presentation logo"
              className="h-[40px] w-[40px]"
            />
          </Link>
          </div>
          <div className="flex items-center">
            {showHeaderBack ? (
              <Link
                href={backHref}
                prefetch={true}
                className="text-foreground text-xs font-syne font-semibold flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 shrink-0 text-foreground" aria-hidden />
                <span>{backLabel}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </Wrapper>
    </div>
  );
};

export default Header;
