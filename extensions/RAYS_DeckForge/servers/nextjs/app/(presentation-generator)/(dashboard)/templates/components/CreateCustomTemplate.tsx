import { Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation';
import React from 'react'

const CreateCustomTemplate = () => {
    const router = useRouter();
    return (
        <div
            onClick={() => {
                router.push('/custom-template')
            }}
            className='w-full rounded-[22px] border border-[#383838] cursor-pointer font-mono bg-[#1d1d1d]'>
            <div className='relative h-[215px] flex justify-center items-center '>
                <div className='w-[36px] h-[36px] relative z-[4]  rounded-full bg-[#383838] flex items-center justify-center'
                ><div className='w-[26px] h-[26px] rounded-full bg-[#1d1d1d] flex items-center justify-center'>

                        <Plus className='w-4 h-4 text-[#888888]' />
                    </div>
                </div>
            </div>
            <div className='px-5 py-4 bg-transparent flex items-center gap-4 overflow-hidden border-t  border-[#383838]'>
                <div className='bg-[#383838] w-[45px] h-[45px] rounded-lg p-2 flex items-center justify-center'>

                    <Sparkles className='w-6 h-6 text-[#ffffff]' />
                </div>
                <div>
                    <h4 className='text-[#ffffff] text-sm font-semibold '>Build Template</h4>
                    <p className='flex text-[#888888] text-sm  font-medium items-center gap-2'>Build Your Own Template</p>
                </div>

            </div>
        </div>
    )
}

export default CreateCustomTemplate
