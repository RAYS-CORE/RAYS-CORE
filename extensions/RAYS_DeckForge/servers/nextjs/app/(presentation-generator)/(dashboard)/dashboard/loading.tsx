import React from 'react'

const loading = () => {
  return (
    <div className="grid grid-cols-1 px-6 mt-10 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full">
      <div className="flex flex-col gap-4 min-h-[200px] cursor-pointer group ring-1 ring-inset ring-border bg-card/80 rounded-xl items-center justify-center animate-pulse">
        <div className="rounded-full bg-muted p-4">
          <div className="w-8 h-8" />
        </div>
        <div className="text-center space-y-2">
          <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
          <div className="h-3 bg-muted rounded w-48 mx-auto"></div>
        </div>
      </div>
      {[...Array(15)].map((_, i) => (
        <div key={i} className="flex flex-col gap-4 min-h-[200px] bg-card/70 rounded-lg p-4 animate-pulse">
          <div className="w-full h-24 bg-muted rounded-lg"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default loading
