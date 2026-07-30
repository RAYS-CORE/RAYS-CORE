import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

const TemplateCardSkeleton = () => (
    <Card className="overflow-hidden shadow-none sm:shadow-none relative bg-[#1d1d1d] border-[#383838]">
        <Skeleton className="absolute top-2 left-2 h-6 w-20 rounded-full z-40 bg-[#383838]" />
        <div className="p-5">
            <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video rounded bg-[#383838]" />
                ))}
            </div>
        </div>
        <div className="flex items-center justify-between p-5 bg-[#1d1d1d] border-t border-[#383838] relative z-40">
            <div className="w-[191px]">
                <Skeleton className="h-4 w-28 mb-2 bg-[#383838]" />
                <Skeleton className="h-3 w-full mb-1 bg-[#383838]" />
                <Skeleton className="h-3 w-3/4 bg-[#383838]" />
            </div>
            <Skeleton className="h-4 w-4 bg-[#383838]" />
        </div>
    </Card>
)

const Loading = () => {
    return (
        <div className="min-h-screen relative font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>
            <div className="sticky top-0 right-0 z-50 py-[28px] px-6 backdrop-blur">
                <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
                    <Skeleton className="h-[34px] w-[180px] rounded-[10px] bg-[#383838]" />
                    <div className="flex gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
                        <Skeleton className="h-[42px] w-[160px] rounded-[10px] bg-[#383838]" />
                    </div>
                </div>
            </div>

            <div className="mx-auto px-6 py-8">
                <div className="p-1 rounded-[10px] bg-[#1d1d1d] w-fit border border-[#383838] flex items-center justify-center">
                    <Skeleton className="h-8 w-20 rounded-[8px] bg-[#383838]" />
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-1" width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#383838" strokeWidth="2" />
                    </svg>
                    <Skeleton className="h-8 w-20 rounded-[8px] bg-[#383838]" />
                </div>

                <section className="my-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <TemplateCardSkeleton key={idx} />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}

export default Loading
