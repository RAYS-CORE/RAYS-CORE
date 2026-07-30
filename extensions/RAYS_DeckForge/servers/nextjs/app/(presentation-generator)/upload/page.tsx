import React from "react";

import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "RAYS DeckForge | AI Presentation Engine",
  description:
    "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
  alternates: {
    canonical: "https://rays.deckforge.local/create",
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
    "business presentations",
  ],
  openGraph: {
    title: "Create Data Presentation | RAYS DeckForge",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
    type: "website",
    url: "https://rays.deckforge.local/create",
    siteName: "RAYS DeckForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Data Presentation | RAYS DeckForge",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
    site: "@rays_deckforge",
    creator: "@rays_deckforge",
  },
};

const page = () => {
  return (
    <div className="relative min-h-screen">
      <Header />
      <div className="flex flex-col items-center justify-center  mb-8 " style={{ fontFamily: "'Space Mono', monospace" }}>
        <h1 className="text-[64px] relative leading-[112%] font-semibold" style={{ color: '#ffffff' }}>
          Generate

          <svg className="absolute top-[-4rem] left-[-5rem]" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9.73497 5.85272C8.05237 5.69492 6.72098 4.39958 6.55904 2.76316L6.28582 0L6.0126 2.76316C5.85066 4.39985 4.51927 5.6952 2.83667 5.85272L0 6.11849L2.83667 6.38426C4.51927 6.54206 5.85066 7.8374 6.0126 9.47382L6.28582 12.237L6.55904 9.47382C6.72098 7.83713 8.05237 6.54178 9.73497 6.38426L12.5716 6.11849L9.73497 5.85272Z" fill="#ffffff" />
          </svg>
          <svg className="absolute top-[-2rem] left-[-1rem]" xmlns="http://www.w3.org/2000/svg" width="26" height="25" viewBox="0 0 26 25" fill="none">
            <path d="M19.4699 11.7054C16.1047 11.3898 13.442 8.79915 13.1181 5.52632L12.5716 0L12.0252 5.52632C11.7013 8.79971 9.03854 11.3904 5.67335 11.7054L0 12.237L5.67335 12.7685C9.03854 13.0841 11.7013 15.6748 12.0252 18.9476L12.5716 24.474L13.1181 18.9476C13.442 15.6743 16.1047 13.0836 19.4699 12.7685L25.1433 12.237L19.4699 11.7054Z" fill="#ffffff" />
          </svg>
          <svg className="absolute bottom-0 -right-10" xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41" fill="none">
            <path d="M31.6166 19.8734C26.275 19.3587 22.0484 15.134 21.5343 9.797L20.6669 0.785156L19.7995 9.797C19.2854 15.1349 15.0588 19.3596 9.71723 19.8734L0.711914 20.7401L9.71723 21.6069C15.0588 22.1216 19.2854 26.3462 19.7995 31.6833L20.6669 40.6951L21.5343 31.6833C22.0484 26.3453 26.275 22.1207 31.6166 21.6069L40.6219 20.7401L31.6166 19.8734Z" fill="#888888" />
          </svg>

        </h1>
        <p className="text-xl" style={{ color: '#888888' }}>Turn prompts or documents into presentations with AI</p>
      </div>


      <UploadPage />
    </div>
  );
};

export default page;
