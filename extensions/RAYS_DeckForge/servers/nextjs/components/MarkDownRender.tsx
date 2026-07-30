"use client";

import React, { useState, useEffect } from "react";

import { marked } from "marked";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    const [markdownContent, setMarkdownContent] = useState<string>("");

    useEffect(() => {
        const parseMarkdown = async () => {
            try {
                const parsed = await marked.parse(content);
                setMarkdownContent(parsed);
            } catch (error) {
                console.error("Error parsing markdown:", error);
                setMarkdownContent("");
            }
        };

        parseMarkdown();
    }, [content]);

    return (
        <div
            className={cn("prose prose-slate max-w-none mb-10", className)}
            dangerouslySetInnerHTML={{ __html: markdownContent }}
        />
    );
};

export default MarkdownRenderer;