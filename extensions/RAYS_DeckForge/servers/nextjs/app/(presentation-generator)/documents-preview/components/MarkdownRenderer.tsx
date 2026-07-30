"use client";

import React, { useState, useEffect } from "react";

import { marked } from "marked";

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
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
      className="prose prose-slate max-w-none mb-10"
      dangerouslySetInnerHTML={{ __html: markdownContent }}
    />
  );
};

export default MarkdownRenderer;
