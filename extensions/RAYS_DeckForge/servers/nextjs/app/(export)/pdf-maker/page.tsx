'use client'
import React, { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import PdfMakerPage from "./PdfMakerPage";

const PdfMakerContent = () => {
    const router = useRouter();
    const params = useSearchParams();
    const queryId = params.get("id");
    const exportCookie = params.get("exportCookie") ?? undefined;
    if (!queryId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-2xl font-bold">No presentation id found</h1>
                <p className="text-muted-foreground pb-4">Please try again</p>
                <Button onClick={() => router.push("/dashboard")}>Go to home</Button>
            </div>
        );
    }
    return (
        <PdfMakerPage presentation_id={queryId} exportCookie={exportCookie} />
    );
};

const page = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PdfMakerContent />
        </Suspense>
    );
};
export default page;
