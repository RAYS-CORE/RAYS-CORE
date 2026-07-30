import React from 'react'
import Header from '@/app/(presentation-generator)/(dashboard)/dashboard/components/Header'
import { Metadata } from 'next'
import OutlinePage from './components/OutlinePage'
export const metadata: Metadata = {
  title: "Outline Presentation",
  description: "Customize and organize your presentation outline. Drag and drop slides, add charts, and generate your presentation with ease.",
  alternates: {
    canonical: "https://rays.deckforge.local/create"
  },
  keywords: [
    "presentation generator",
    "AI presentations",
    "data visualization",
    "automatic presentation maker",
    "professional slides",
    "data-driven presentations",
    "document to presentation",
    "presentation automation",
    "smart presentation tool",
    "business presentations"
  ]
}
const page = () => {
  return (
    <div className='relative min-h-screen'>
      <Header />
      <div
        className='fixed z-[-10] bottom-5 left-1/2 -translate-x-1/2 w-full h-full'
        style={{
          height: "341px",
          width: "86%",
          borderRadius: '1440px',
          background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
        }}
      />
      <OutlinePage />
    </div>
  )
}

export default page
