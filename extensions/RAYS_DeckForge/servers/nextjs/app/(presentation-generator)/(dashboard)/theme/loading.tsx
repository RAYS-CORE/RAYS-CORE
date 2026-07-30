import { Skeleton } from '@/components/ui/skeleton'

const ThemeCardSkeleton = () => (
    <div className="rounded-[10px] px-6 border border-[#383838] w-[305px] bg-[#1d1d1d] overflow-hidden">
        {/* Preview area */}
        <div className="relative h-[250px] p-6">
            {/* Top badges */}
            <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                <Skeleton className="h-6 w-16 rounded-full bg-[#383838]" />
                <Skeleton className="h-6 w-20 rounded-full bg-[#383838]" />
            </div>
            {/* Card preview */}
            <div className="h-full flex items-center justify-center">
                <div className="w-full h-[135px] rounded-[10px] overflow-hidden">
                    <Skeleton className="w-full h-full bg-[#383838]" />
                </div>
            </div>
        </div>
        {/* Bottom info */}
        <div className="px-5 border-t border-[#383838] py-2.5 h-[80px] flex items-center justify-between">
            <div>
                <Skeleton className="h-4 w-24 mb-2 bg-[#383838]" />
                <div className="flex items-center gap-1">
                    <Skeleton className="w-4 h-4 rounded-full bg-[#383838]" />
                    <Skeleton className="w-4 h-4 rounded-full bg-[#383838]" />
                </div>
            </div>
            <Skeleton className="h-5 w-5 bg-[#383838]" />
        </div>
    </div>
)

const Loading = () => {
    return (
        <div className="space-y-6 px-6">
            {/* Tabs skeleton */}
            <div className="p-1 rounded-[10px] bg-[#1d1d1d] w-fit border border-[#383838] flex items-center justify-center">
                <Skeleton className="h-8 w-20 rounded-[8px] bg-[#383838]" />
                <div className="mx-1 w-[2px] h-[17px] bg-[#383838]" />
                <Skeleton className="h-8 w-20 rounded-[8px] bg-[#383838]" />
            </div>

            {/* Theme cards grid */}
            <div className="flex flex-wrap gap-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <ThemeCardSkeleton key={idx} />
                ))}
            </div>
        </div>
    )
}

export default Loading
