"use client";

import React from "react";
import Link from "next/link";
import { Layout, Plus } from "lucide-react";

const Header: React.FC = () => {
  return (
    <header className="w-full border-b bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-white.png" alt="RAYS DeckForge" className="h-6 w-auto" />
          </Link>

          <nav className="flex items-center gap-4">
            <Link href="/custom-layout" className="inline-flex items-center gap-2 text-foreground hover:text-foreground">
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium font-inter">Create Template</span>
            </Link>
            <Link href="/template-preview" className="inline-flex items-center gap-2 text-foreground hover:text-foreground">
              <Layout className="w-5 h-5" />
              <span className="text-sm font-medium font-inter">Templates</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
