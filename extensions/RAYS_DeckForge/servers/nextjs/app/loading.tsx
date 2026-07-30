import { Card } from "@/components/ui/card";

const loading = () => {
    return (
        <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#000000' }}>
            <main className="flex-1 container mx-auto px-4 max-w-3xl overflow-hidden flex flex-col">
                {/* Branding Header Skeleton */}
                <div className="text-center mb-2 mt-4 flex-shrink-0">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="h-12 w-12 animate-pulse rounded-[10px]" style={{ background: '#1d1d1d' }} />
                    </div>
                    <div className="h-4 w-64 animate-pulse rounded-[10px] mx-auto" style={{ background: '#1d1d1d' }} />
                </div>

                {/* Main Configuration Content Skeleton */}
                <div className="flex-1 overflow-hidden">
                    <div className="space-y-6 p-6">
                        {/* Page Title */}
                        <div className="space-y-2">
                            <div className="h-8 w-48 animate-pulse rounded-[10px]" style={{ background: '#1d1d1d' }} />
                            <div className="h-5 w-72 animate-pulse rounded-[10px]" style={{ background: '#1d1d1d' }} />
                        </div>

                        {/* LLM Provider Cards */}
                        <div className="space-y-4">
                            {[...Array(3)].map((_, index) => (
                                <div key={index} className="p-6 rounded-[10px]" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                            <div className="space-y-1">
                                                <div className="h-5 w-32 animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                                <div className="h-4 w-48 animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                            </div>
                                        </div>
                                        <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: '#383838' }} />
                                    </div>

                                    {/* Configuration Fields */}
                                    <div className="space-y-4">
                                        {[...Array(2)].map((_, fieldIndex) => (
                                            <div key={fieldIndex} className="space-y-2">
                                                <div className="h-4 w-24 animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                                <div className="h-10 w-full animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Model Selection */}
                        <div className="p-6 rounded-[10px]" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
                            <div className="space-y-4">
                                <div className="h-5 w-32 animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                                <div className="h-10 w-full animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Fixed Bottom Button Skeleton */}
            <div className="flex-shrink-0 p-4" style={{ background: '#1d1d1d', borderTop: '1px solid #383838' }}>
                <div className="container mx-auto max-w-3xl">
                    <div className="h-12 w-full animate-pulse rounded-[10px]" style={{ background: '#383838' }} />
                </div>
            </div>
        </div>
    );
};

export default loading;
