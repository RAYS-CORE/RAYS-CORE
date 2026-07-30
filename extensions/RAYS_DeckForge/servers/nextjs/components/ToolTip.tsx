import { Tooltip } from '@radix-ui/react-tooltip'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import React from 'react'
import { TooltipContent, TooltipTrigger, } from './ui/tooltip'

const ToolTip = ({ children, content, className }: { children: React.ReactNode, content: string, className?: string }) => {
    return (
        <div className={className}>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {children}
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{content}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}

export default ToolTip
