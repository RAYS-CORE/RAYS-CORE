"use client";
import React from 'react'
import { Check } from 'lucide-react'

interface FontCardProps {
  font: any
  isSelected: boolean
  onSelect: (fontName: string) => void
}

export const FontCard: React.FC<FontCardProps> = ({ font, isSelected, onSelect }) => (
  <div
    className={`relative p-3 rounded-[10px] cursor-pointer transition-all duration-200 group
      ${isSelected
        ? 'bg-[#1d1d1d] border border-[#ffffff] shadow-sm'
        : 'bg-[#1d1d1d] border border-[#383838] hover:border-[#888888]'
      }`}
    onClick={() => onSelect(font.name)}
  >

    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isSelected ? 'text-[#ffffff]' : 'text-[#ffffff]'}`}
          style={{ fontFamily: `"${font.name}"` }}
        >
          {font.displayName}
        </p>
        <p
          className="text-[11px] text-[#888888] mt-0.5"
          style={{ fontFamily: `"${font.name}"` }}
        >
          ABC abc 123
        </p>
      </div>
      <div
        className={`text-xl font-semibold ${isSelected ? 'text-[#ffffff]' : 'text-[#888888] group-hover:text-[#ffffff]'} transition-colors`}
        style={{ fontFamily: `"${font.name}"` }}
      >
        Aa
      </div>
    </div>
  </div>
)
