"use client";

import React, { useState, useEffect } from "react";

import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

const DashboardPage: React.FC = () => {
  const pathname = usePathname();
  const [presentations, setPresentations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      await fetchPresentations();
    };
    loadData();
  }, []);

  const fetchPresentations = async () => {
    let fetchedCount = 0;
    let hasError = false;
    try {
      setIsLoading(true);
      setError(null);
      const data = await DashboardApi.getPresentations();
      fetchedCount = data.length;
      data.sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setPresentations(data);
    } catch (err) {
      hasError = true;
      setError(null);
      setPresentations([]);
    } finally {

      setIsLoading(false);
    }
  };

  const removePresentation = (presentationId: string) => {
    setPresentations((prev: any) =>
      prev ? prev.filter((p: any) => p.id !== presentationId) : [],
    );
  };

  return (
    <div className="min-h-screen w-full px-6 pb-10 relative" style={{ background: '#000000', fontFamily: "'Space Mono', monospace" }}>
      <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur mb-4 ">
        <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
          <h3 className="text-[28px] tracking-[-0.84px] font-normal flex items-center gap-2" style={{ color: '#ffffff' }}>
            Slide Presentation
          </h3>
          <div className="flex  gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
            <Link
              href="/upload"
              onClick={() => {}}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md"
              aria-label="Create new presentation"
              style={{
                background: "#ffffff",
                color: "#000000"
              }}
            >
              <span className="hidden md:inline">New presentation</span>
              <span className="md:hidden">New</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
      <PresentationGrid
        presentations={presentations}
        type="slide"
        isLoading={isLoading}
        error={error}
        onPresentationDeleted={removePresentation}
      />

    </div>
  );
};

export default DashboardPage;
