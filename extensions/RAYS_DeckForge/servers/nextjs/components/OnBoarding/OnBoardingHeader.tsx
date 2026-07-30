import React from 'react'

const OnBoardingHeader = ({ currentStep, setStep }: { currentStep: number, setStep: (step: number) => void }) => {
    return (
        <div className='sticky top-8 z-20 flex items-center justify-end gap-1 mt-7 mb-[52px]' style={{ fontFamily: "'Space Mono', monospace" }}>

            <div className='flex items-center gap-1'>
                <div className='flex items-center gap-1 cursor-pointer'
                    onClick={() => {
                        if (currentStep > 1) {
                            setStep(1);
                        }
                    }}
                >
                    <div className={`px-2.5 h-7 w-7 text-xs font-medium rounded-full flex items-center justify-center`}
                        style={{
                            background: currentStep === 1 ? '#ffffff' : 'transparent',
                            color: currentStep === 1 ? '#000000' : '#888888',
                            border: currentStep === 1 ? 'none' : '1px solid #383838',
                        }}
                    >
                        1
                    </div>
                    <p className='text-xs' style={{ color: currentStep === 1 ? '#ffffff' : '#888888' }}>Select Mode</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                    <path d="M0 0.5H21.5" stroke="#383838" />
                </svg>
                <div className='flex items-center gap-1 cursor-pointer'
                    onClick={() => {
                        if (currentStep > 2) {
                            setStep(2);
                        }
                    }}
                >
                    <div className={`px-2.5 h-7 w-7 text-xs font-medium rounded-full flex items-center justify-center`}
                        style={{
                            background: currentStep === 2 ? '#ffffff' : 'transparent',
                            color: currentStep === 2 ? '#000000' : '#888888',
                            border: currentStep === 2 ? 'none' : '1px solid #383838',
                        }}
                    >
                        2
                    </div>
                    <p className='text-xs' style={{ color: currentStep === 2 ? '#ffffff' : '#888888' }}>Choose Providers</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                    <path d="M0 0.5H21.5" stroke="#383838" />
                </svg>
                <div className='flex items-center gap-1'>
                    <div className={`px-2.5 h-7 w-7 text-xs font-medium rounded-full flex items-center justify-center`}
                        style={{
                            background: currentStep === 3 ? '#ffffff' : 'transparent',
                            color: currentStep === 3 ? '#000000' : '#888888',
                            border: currentStep === 3 ? 'none' : '1px solid #383838',
                        }}
                    >
                        3
                    </div>
                    <p className='text-xs' style={{ color: currentStep === 3 ? '#ffffff' : '#888888' }}>Finish Setup</p>
                </div>
            </div>
        </div>
    )
}

export default OnBoardingHeader
