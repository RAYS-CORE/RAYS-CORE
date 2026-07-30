import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

const loading = () => {
    return (
        <div>
            <Skeleton className='h-24 w-full' />
            <div className="flex flex-col max-w-7xl mx-auto gap-6 my-10 justify-center items-center ">
                {
                    Array.from({ length: 10 }).map((_, index) => (
                        <Skeleton key={index} className="animate-pulse aspect-video w-full" />
                    ))
                }
            </div>
        </div>
    )
}

export default loading
