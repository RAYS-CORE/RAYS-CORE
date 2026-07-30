"use client";
import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

import { useDispatch } from 'react-redux';
import { updateTheme } from '@/store/slices/presentationGeneration';
import { usePathname, useRouter } from 'next/navigation';
import {
    applyPresentationThemeToElement,
    clearPresentationThemeFromElement,
} from "../utils/applyPresentationThemeDom";

const ThemeSelector = ({ current_theme, themes: allThemes }: { current_theme: any, themes: any[] }) => {
    const [currentTheme, setCurrentTheme] = useState<any>(current_theme)
    const dispatch = useDispatch()
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const applyTheme = async (theme: any) => {
        const element = document.getElementById("presentation-slides-wrapper");
        if (!element) return;
        if (allThemes.length === 0) return;
        setCurrentTheme(theme);
        clearPresentationThemeFromElement(element);
        if (!theme.data?.colors?.["graph_0"]) return;
        applyPresentationThemeToElement(element, theme);
        dispatch(updateTheme(theme));

    };
    const resetTheme = async () => {
        dispatch(updateTheme(null));
        clearPresentationThemeFromElement(
            document.getElementById("presentation-slides-wrapper")
        );
    };


    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                <button className="text-sm px-[18px] py-2.5 gap-1.5 flex items-center duration-300 rounded-[10px] font-medium" style={{ background: '#000000', border: '1px solid #383838', color: '#ffffff' }}>
                    <Palette className="h-4 w-4" style={{ color: '#ffffff' }} /> Theme
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-fit rounded-[18px] max-h-80 overflow-y-auto hide-scrollbar">
                <div className='pb-2 flex  gap-2 justify-end'>
                    <button className='text-xs text-muted-foreground pb-2 text-right underline' onClick={() => {
                        router.push(`/theme?tab=new-theme`)
                    }}>+Customize Theme</button>
                    <button className='text-xs text-muted-foreground pb-2 text-right underline' onClick={resetTheme}>Reset Theme</button>
                </div>
                <div className="grid grid-cols-3 gap-4">

                    {allThemes && allThemes.length > 0 && allThemes.map((t) => (
                        <div
                            key={t.id}
                            onClick={() => applyTheme(t)}
                            className={`text-left group relative`}
                        >

                            <div className={`rounded-[10px] cursor-pointer p-1 transition-all group-hover:shadow-md ${currentTheme.id === t.id ? 'border-2' : ''}`} style={{ background: '#000000', border: currentTheme.id === t.id ? '2px solid #ffffff' : '1px solid #383838' }}>
                                <div className="rounded-lg p-2" style={{ backgroundColor: t.data.colors['background'] }}>
                                    <div className="rounded-md shadow-sm p-3" style={{ backgroundColor: t.data.colors['card'] }}>
                                        <div className="w-16 h-2 rounded-full mb-2" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-12 h-2 rounded-full mb-1" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-8 h-2 rounded-full mb-3" style={{ backgroundColor: t.data.colors['background_text'] }} />
                                        <div className="w-8 h-3 rounded-full" style={{ backgroundColor: t.data.colors['primary'] }} />
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-center font-medium text-foreground truncate w-full">
                                {t.name}
                            </p>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default ThemeSelector
