import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className='flex pr-4 min-h-screen' style={{ background: '#000000', fontFamily: "'Space Mono', monospace" }}>
            <DashboardSidebar />
            <div className='w-full'>

                {children}
            </div>
        </div>
    )
}

export default layout