import React from 'react'
import { LogOut, Shield } from 'lucide-react'
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

type SettingsSection = 'text-provider' | 'image-provider' | 'privacy' | 'session'

const SettingSideBar = ({ mode, setMode, selectedProvider, setSelectedProvider }: { mode: 'nanobanana' | 'deckforge', setMode: (mode: 'nanobanana' | 'deckforge') => void, selectedProvider: SettingsSection, setSelectedProvider: (provider: SettingsSection) => void }) => {
    const { llm_config } = useSelector((state: RootState) => state.userConfig)
    const textProviderIcon = LLM_PROVIDERS[llm_config.LLM as keyof typeof LLM_PROVIDERS]?.icon
    const imageProviderIcon = IMAGE_PROVIDERS[llm_config.IMAGE_PROVIDER as keyof typeof IMAGE_PROVIDERS]?.icon || '/providers/pexel.png'
    return (
        <div className='w-full max-w-[230px] h-screen px-3 pt-[22px] flex flex-col' style={{ background: '#1d1d1d', borderRight: '1px solid #383838' }}>
            <p className='text-xs font-medium mt-[3.15rem] pb-3.5' style={{ color: '#ffffff', borderBottom: '1px solid #383838' }}>FILTER BY:</p>
            <div className='mt-6 flex-1'>
                <p className='text-xs font-medium pb-2.5' style={{ color: '#888888' }}>Select Mode</p>
                <div className='p-0.5 rounded-[10px] w-fit flex items-center justify-center mb-[34px]' style={{ background: '#000000', border: '1px solid #383838' }}>
                    <button className='px-3 h-[26px] text-[10px] font-medium rounded-[10px]'
                        onClick={() => setMode('deckforge')}
                        style={{
                            background: mode === 'deckforge' ? '#383838' : 'transparent',
                            color: mode === 'deckforge' ? '#ffffff' : '#888888'
                        }}
                    >Template Based
                    </button>
                    <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#383838" strokeWidth="2" />
                    </svg>
                    <div className='relative'>
                        <button className='px-3 h-[26px] text-[10px] font-medium rounded-[10px] cursor-not-allowed opacity-60'
                            disabled
                            style={{
                                background: 'transparent',
                                color: '#888888'
                            }}
                        >
                            Image Based
                        </button>
                        <span className='absolute -top-2 -right-5 text-[7px] uppercase tracking-wide rounded-[10px] px-1.5 py-0.5 whitespace-nowrap' style={{ background: '#1d1d1d', border: '1px solid #383838', color: '#888888' }}>
                            Coming soon
                        </span>
                    </div>


                </div>
                <p className='text-xs font-medium pb-2.5' style={{ color: '#888888' }}>Select Provider</p>
                {mode === 'deckforge' && <div className='space-y-2.5'>
                    <button className='w-full rounded-[10px] px-3 py-4 flex items-center gap-1.5'
                        onClick={() => setSelectedProvider('text-provider')}
                        style={{
                            background: selectedProvider === 'text-provider' ? '#383838' : '#000000',
                            border: selectedProvider === 'text-provider' ? '1px solid #888888' : '1px solid #383838'
                        }}
                    >
                        <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden' style={{ border: '1px solid #383838' }}>
                            <img src={textProviderIcon} className='object-cover w-full h-full overflow-hidden' alt='provider' />
                        </div>
                        <p className='text-xs font-medium' style={{ color: '#ffffff' }}>Text Provider</p>
                    </button>
                    <button className='w-full rounded-[10px] px-3 py-4 flex items-center gap-1.5'
                        onClick={() => setSelectedProvider('image-provider')}
                        style={{
                            background: selectedProvider === 'image-provider' ? '#383838' : '#000000',
                            border: selectedProvider === 'image-provider' ? '1px solid #888888' : '1px solid #383838'
                        }}
                    >
                        <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden' style={{ border: '1px solid #383838' }}>
                            <img src={imageProviderIcon} className='object-cover w-full h-full overflow-hidden' alt='provider' />
                        </div>
                        <p className='text-xs font-medium' style={{ color: '#ffffff' }}>Image Provider</p>
                    </button>
                </div>}
                {
                    mode === 'nanobanana' && <div>
                        <button className='w-full rounded-[10px] px-3 py-4 flex items-center gap-1.5' style={{ background: '#383838', border: '1px solid #888888' }}>
                            <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden' style={{ border: '1px solid #383838' }}>
                                <img src='/providers/openai.png' className='object-cover w-full h-full overflow-hidden' alt='provider' />
                            </div>
                            <p className='text-xs font-medium' style={{ color: '#ffffff' }}>Nanobanana</p>
                        </button>
                    </div>
                }
            </div>

            <div className='py-5 relative z-50' style={{ borderTop: '1px solid #383838' }}>
                <p className='text-xs font-medium pb-2.5' style={{ color: '#888888' }}>Other</p>
                <div className='space-y-2.5'>
                    <button
                        className='w-full rounded-[10px] p-3 py-4 flex items-center gap-1.5'
                        onClick={() => setSelectedProvider('privacy')}
                        style={{
                            background: selectedProvider === 'privacy' ? '#383838' : '#000000',
                            border: selectedProvider === 'privacy' ? '1px solid #888888' : '1px solid #383838'
                        }}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden flex items-center justify-center' style={{ background: '#000000', border: '1px solid #383838' }}>
                            <Shield className='w-3.5 h-3.5' style={{ color: '#ffffff' }} />
                        </div>
                        <p className='text-xs font-medium' style={{ color: '#ffffff' }}>Usage Analytics</p>
                    </button>
                    <button
                        className='w-full rounded-[10px] p-3 py-4 flex items-center gap-1.5'
                        onClick={() => setSelectedProvider('session')}
                        style={{
                            background: selectedProvider === 'session' ? '#383838' : '#000000',
                            border: selectedProvider === 'session' ? '1px solid #888888' : '1px solid #383838'
                        }}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden flex items-center justify-center' style={{ background: '#000000', border: '1px solid #383838' }}>
                            <LogOut className='w-3.5 h-3.5' style={{ color: '#ffffff' }} />
                        </div>
                        <p className='text-xs font-medium' style={{ color: '#ffffff' }}>Sign out</p>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingSideBar
