"use client";
import { ArrowRight, Plus, Sparkle, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const CustomTabEmpty = () => {
    const router = useRouter()
    return (
        <div
            onClick={() => {
                router.push('/theme?tab=new-theme')
            }}
            className='w-[305px] rounded-[10px] border border-[#383838] cursor-pointer bg-[#1d1d1d]'>
            <div className='relative h-[250px] flex justify-center items-center '>
                <div className='w-[36px] h-[36px] relative z-[4] rounded-full bg-[#ffffff] flex items-center justify-center'
                ><div className='w-[26px] h-[26px] rounded-full bg-[#000000] flex items-center justify-center'>

                        <Plus className='w-4 h-4 text-[#ffffff]' />
                    </div>
                </div>
            </div>
            <div className='px-5 py-4 bg-[#1d1d1d] flex items-center gap-4 border-t border-[#383838] rounded-b-[10px]'>
                <div className='bg-[#ffffff] w-[45px] h-[45px] rounded-[10px] p-2 flex items-center justify-center'>

                    <Sparkles className='w-6 h-6 text-[#000000]' />
                </div>
                <div>
                    <h4 className='text-[#ffffff] text-sm font-semibold '>Build Theme</h4>
                    <p className='flex text-[#888888] text-sm  font-medium items-center gap-2'>From colors <ArrowRight className='w-3 h-3' /> fonts </p>
                </div>

            </div>
        </div>
    )
}

export default CustomTabEmpty