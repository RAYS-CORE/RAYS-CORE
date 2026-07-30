import { ChevronRight } from 'lucide-react'
import React from 'react'

const ModeSelectStep = ({ selectedMode, setStep, setSelectedMode }: { selectedMode: string, setStep: (step: number) => void, setSelectedMode: (mode: string) => void }) => {
    return (
        <div className='max-w-[650px]' style={{ fontFamily: "'Space Mono', monospace" }}>
            <div className='mb-[70px]'>

                <h2 className='mb-4 text-[26px] font-normal' style={{ color: '#ffffff' }}>Choose how you want to generate presentations</h2>
                <p className='text-xl font-normal' style={{ color: '#888888' }}>Pick a generation mode first. You'll connect your model providers in the next step.</p>
            </div>
            <div className='space-y-5'>
                <div onClick={() => {
                    setSelectedMode("deckforge")

                }} className={`rounded-[10px] p-4 flex items-center justify-between gap-6 cursor-pointer`}
                    style={{
                        border: selectedMode === "deckforge" ? '1px solid #ffffff' : '1px solid #383838',
                        background: selectedMode === "deckforge" ? '#1d1d1d' : 'transparent',
                    }}
                >
                    <div className='flex items-center gap-5'>
                        <div className='rounded-[10px] w-[64px] h-[64px] flex-shrink-0 flex items-center justify-center' style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
                            <img src='/logo-with-bg.png' alt='deckforge' className='w-[36px] h-[36px] object-contain' />
                        </div>
                        <div>
                            <div className='flex items-center gap-2.5 flex-wrap'>
                                <h3 className='text-[16px] font-medium' style={{ color: '#ffffff' }}>Template Presentation Mode</h3>
                                <span className='px-2 py-0.5 rounded-[10px] text-[9px] whitespace-nowrap' style={{ background: '#1d1d1d', border: '1px solid #383838', color: '#888888' }}>PPTX Export</span>
                            </div>
                            <p className='text-[13px] font-normal mt-1' style={{ color: '#888888' }}>Best for structured decks, editing, and PPTX export. Requires text and image providers.</p>
                        </div>
                    </div>
                    <ChevronRight className='w-5 h-5 flex-shrink-0' style={{ color: '#888888' }} />
                </div>
                <div
                    className='rounded-[10px] p-4 flex items-center justify-between gap-6 cursor-not-allowed'
                    style={{ border: '1px solid #383838' }}
                >
                    <div className='flex items-center gap-5'>
                        <div className='rounded-[10px] w-[64px] h-[64px] flex-shrink-0 flex items-center justify-center' style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
                            <img src='/image_mode.png' alt='deckforge' className='w-full h-full object-contain' />
                        </div>
                        <div>
                            <div className='flex items-center gap-2.5 flex-wrap'>
                                <h3 className='text-[16px] font-medium' style={{ color: '#ffffff' }}>Image Slides Mode</h3>
                                <span className='px-2 py-0.5 rounded-[10px] text-[9px] whitespace-nowrap' style={{ background: '#1d1d1d', border: '1px solid #383838', color: '#888888' }}>No PPTX Export</span>
                                <span className='px-2 py-0.5 rounded-[10px] text-[9px] whitespace-nowrap' style={{ background: '#1d1d1d', border: '1px solid #383838', color: '#888888' }}>Coming soon</span>
                            </div>
                            <p className='text-[13px] font-normal mt-1' style={{ color: '#888888' }}>Best for visual slide generation from image models. No PPTX export.</p>
                        </div>
                    </div>
                    <ChevronRight className='w-5 h-5 flex-shrink-0' style={{ color: '#888888' }} />
                </div>
            </div>
            <div className='fixed bottom-16 mr-8 max-w-[1440px] right-16 flex justify-end items-center gap-2.5 '>

                <button
                    onClick={() => {
                        setStep(2);
                    }}
                    className='rounded-[10px] px-5 py-2.5 text-xs font-semibold'
                    style={{ background: '#ffffff', color: '#000000', border: 'none' }}
                >
                    Continue to providers
                </button>
            </div>
        </div>
    )
}

export default ModeSelectStep
