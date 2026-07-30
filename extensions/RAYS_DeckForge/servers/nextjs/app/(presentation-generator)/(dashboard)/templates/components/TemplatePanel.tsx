"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { templates } from "@/app/presentation-templates";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import {
    useCustomTemplateSummaries,
    useCustomTemplatePreview,
    CustomTemplates,
} from "@/app/hooks/useCustomTemplates";
import CreateCustomTemplate from "./CreateCustomTemplate";
import Link from "next/link";
import {
    TemplatePreviewStage,
    LayoutsBadge,
    InbuiltTemplatePreview,
    CustomTemplatePreview,
} from "../../../components/TemplatePreviewComponents";

export const CustomTemplateCard = React.memo(function CustomTemplateCard({ template }: { template: CustomTemplates }) {
    const router = useRouter();
    const { previewLayouts, loading } = useCustomTemplatePreview(`${template.id}`);
    const handleOpen = useCallback(() => {
        if (template.id.startsWith('custom-')) {
            router.push(`/template-preview?slug=${template.id}`)
        } else {
            router.push(`/template-preview?slug=custom-${template.id}`)
        }
    }, [router, template.id, template.name]);

    return (
        <Card
            className="cursor-pointer flex flex-col shadow-none sm:shadow-none relative hover:shadow-sm transition-all duration-200 group overflow-hidden rounded-[22px] border border-[#383838] bg-[#1d1d1d]"
            onClick={handleOpen}
        >
            <TemplatePreviewStage>
                <LayoutsBadge count={template.layoutCount} />
                <CustomTemplatePreview
                    previewLayouts={previewLayouts}
                    loading={loading}
                    templateId={template.id}
                />
            </TemplatePreviewStage>
            <div className="relative z-40 flex items-center justify-between border-t border-[#383838] bg-transparent px-6 py-5">
                <h3 className="max-w-[min(191px,65%)] text-base font-bold text-[#ffffff]">{template.name}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#888888] transition-colors group-hover:text-[#ffffff]" />
            </div>
        </Card>
    );
}, (prev, next) => {
    return (
        prev.template.id === next.template.id &&
        prev.template.name === next.template.name &&
        prev.template.layoutCount === next.template.layoutCount
    );
});

const InbuiltTemplateCard = React.memo(function InbuiltTemplateCard({
    template,
    onOpen,
}: {
    template: TemplateLayoutsWithSettings;
    onOpen: (id: string) => void;
}) {
    const handleOpen = useCallback(() => onOpen(template.id), [onOpen, template.id]);

    return (
        <Card
            key={template.id}
            className="group relative cursor-pointer overflow-hidden rounded-[22px] border border-[#383838] bg-[#1d1d1d] shadow-none sm:shadow-none transition-all duration-200 hover:shadow-sm"
            onClick={handleOpen}
        >
            <TemplatePreviewStage>
                <LayoutsBadge count={template.layouts.length} />
                <InbuiltTemplatePreview layouts={template.layouts} templateId={template.id} />
            </TemplatePreviewStage>
            <div className="relative z-40 flex items-center justify-between gap-4 border-t border-[#383838] bg-transparent px-6 py-5">
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold capitalize text-[#ffffff]">{template.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[#888888]">{template.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#888888] transition-colors group-hover:text-[#ffffff]" />
            </div>
        </Card>
    );
});

const LayoutPreview = () => {
    const [tab, setTab] = useState<'custom' | 'default'>('default');
    const router = useRouter();
    const { templates: customTemplates, loading: customLoading } = useCustomTemplateSummaries();

    useEffect(() => {
        const existingScript = document.querySelector('script[src*="tailwindcss.com"]');
        if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://cdn.tailwindcss.com";
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handleOpenPreview = useCallback((id: string) => {
        router.push(`/template-preview?slug=${id}`);
    }, [router]);

    const { nonNeoInbuilt, neoInbuilt } = useMemo(() => {
        const nonNeo: TemplateLayoutsWithSettings[] = [];
        const neo: TemplateLayoutsWithSettings[] = [];
        for (const t of templates) {
            if (t.id.startsWith("neo")) neo.push(t);
            else nonNeo.push(t);
        }
        return { nonNeoInbuilt: nonNeo, neoInbuilt: neo };
    }, []);

    const customTemplateCards = useMemo(
        () => customTemplates.map((template: CustomTemplates) => <CustomTemplateCard key={template.id} template={template} />),
        [customTemplates],
    );

    return (
        <div className="min-h-screen relative font-mono" style={{ background: '#000000', fontFamily: "'Space Mono', monospace", color: '#ffffff' }}>
            <div className="sticky top-0 right-0 z-50 py-[28px] px-6 backdrop-blur">
                <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
                    <h3 className="text-[28px] tracking-[-0.84px] font-normal text-[#ffffff] flex items-center gap-2">
                        Templates
                    </h3>
                    <div className="flex gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
                        <Link
                            href="/custom-template"
                            className="inline-flex items-center font-semibold gap-2 px-4 py-2.5 text-sm shadow-sm hover:shadow-md"
                            aria-label="Create new template"
                            style={{
                                borderRadius: "10px",
                                background: "#ffffff",
                                color: "#000000",
                            }}
                        >
                            <span className="hidden md:inline">New Template</span>
                            <span className="md:hidden">New</span>
                            <ChevronRight className="w-4 h-4" />
                        </Link>

                    </div>
                </div>
            </div>

            <div className="mx-auto px-6 py-8">
                <div className='p-1 rounded-[10px] bg-[#1d1d1d] w-fit border border-[#383838] flex items-center justify-center'>
                    <button onClick={() => setTab('custom')} className='px-5 py-2 text-xs font-medium rounded-[8px]'
                        style={{
                            background: tab === 'custom' ? '#ffffff' : 'transparent',
                            color: tab === 'custom' ? '#000000' : '#888888'
                        }}
                    >Custom</button>
                    <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#383838" strokeWidth="2" />
                    </svg>
                    <button onClick={() => setTab('default')} className='px-5 py-2 text-xs font-medium rounded-[8px]'
                        style={{
                            background: tab === 'default' ? '#ffffff' : 'transparent',
                            color: tab === 'default' ? '#000000' : '#888888'
                        }}
                    >Built-in</button>
                </div>

                {/* Inbuilt Templates Section: non-neo first, then Report (neo) */}
                {tab === 'default' && (
                    <section className="my-12 space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {nonNeoInbuilt.map((template) => (
                                <InbuiltTemplateCard
                                    key={template.id}
                                    template={template}
                                    onOpen={handleOpenPreview}
                                />
                            ))}
                        </div>
                        {neoInbuilt.length > 0 && (
                            <div>
                                <h4 className="text-base font-semibold text-[#ffffff] mb-6 tracking-tight">
                                    Report
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {neoInbuilt.map((template) => (
                                        <InbuiltTemplateCard
                                            key={template.id}
                                            template={template}
                                            onOpen={handleOpenPreview}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}


                {tab === 'custom' && <section className="my-12">
                    {customLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-[#888888]">Loading custom templates...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 items-center lg:grid-cols-4 gap-6">
                            <CreateCustomTemplate />
                            {customTemplateCards}
                        </div>
                    )}
                </section>}
            </div>
        </div>
    );
};

export default LayoutPreview;
