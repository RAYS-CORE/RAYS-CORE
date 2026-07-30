import React from 'react'

interface StepIndicatorProps {
  currentStep: number
}

const steps = [
  { step: 1, label: 'Brand' },
  { step: 2, label: 'Palette' },
  { step: 3, label: 'Fonts' },
  { step: 4, label: 'Logo' },
]

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => (
  <div className="flex flex-col items-center gap-7 px-4 min-w-[104px] pt-8 border-r border-[#383838]">
    {steps.map(({ step, label }) => {
      const isActive = currentStep === step
      return (
        <div key={step} className="flex flex-col items-center gap-1.5 px-3  ">
          <span
            className={`px-2 py-0.5 rounded-[10px] text-[9px] font-medium ${isActive
              ? 'bg-[#ffffff] text-[#000000]'
              : 'bg-[#1d1d1d] text-[#888888] border border-[#383838]'
              }`}
          >
            Step-{step}
          </span>
          <span className="text-[11px] font-normal text-[#ffffff]">{label}</span>
        </div>
      )
    })}
  </div>
)
