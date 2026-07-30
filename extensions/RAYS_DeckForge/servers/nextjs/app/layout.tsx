import type { Metadata } from "next";
import localFont from "next/font/local";
import { Syne, Unbounded, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

const inter = localFont({
  src: [
    {
      path: "./fonts/Inter.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-inter",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
});

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-unbounded",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RAYS DeckForge — AI Presentation Engine",
  description:
    "Local-first AI presentation generation engine. Part of the RAYS ecosystem. Supports Ollama, OpenAI, Gemini, Anthropic, and custom models. Export to PPTX and PDF.",
  keywords: [
    "RAYS DeckForge",
    "AI presentation generator",
    "local AI",
    "Ollama presentations",
    "PPTX generator",
    "self-hosted AI",
    "presentation engine",
    "RAYS ecosystem",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${syne.variable} ${unbounded.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
