import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function detectLanguage(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (["py", "pyi"].includes(extension)) return "python";
  if (["ts", "tsx"].includes(extension)) return "typescript";
  if (["js", "jsx", "mjs", "cjs"].includes(extension)) return "javascript";
  if (["json"].includes(extension)) return "json";
  if (["md", "markdown"].includes(extension)) return "markdown";
  if (["html", "htm"].includes(extension)) return "markup";
  if (["css", "scss"].includes(extension)) return "css";
  if (["yml", "yaml"].includes(extension)) return "yaml";
  if (["sh", "bash", "zsh"].includes(extension)) return "bash";
  return "text";
}

function parseMarkdownToReact(text: string) {
  const lines = text.split("\n");
  const nodes: any[] = [];
  let inList = false;
  let listItems: any[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${key}`} className="list-disc pl-6 my-3 space-y-1.5 text-sm text-foreground/80">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = (key: number) => {
    if (tableRows.length > 0 || tableHeaders.length > 0) {
      nodes.push(
        <div key={`table-wrapper-${key}`} className="my-5 overflow-x-auto border border-border/40 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/40">
                {tableHeaders.map((h, i) => (
                  <th key={i} className="p-3 font-bold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors">
                  {row.map((col, ci) => (
                    <td key={ci} className="p-3 text-foreground/80">{col}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Tables
    if (line.startsWith("|")) {
      flushList(i);
      inTable = true;
      const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.every(c => c.match(/^:?-+:?$/))) {
        continue;
      }
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(i);
      inTable = false;
    }

    // Headings
    if (line.startsWith("#")) {
      flushList(i);
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const content = match[2];
        let classes = "font-bold text-foreground mt-4 mb-2 ";
        if (level === 1) classes += "text-2xl border-b border-border/40 pb-2 mt-6 mb-4";
        else if (level === 2) classes += "text-xl mt-5 mb-3";
        else if (level === 3) classes += "text-lg";
        else classes += "text-sm text-foreground/90";
        
        const Tag = `h${level}` as any;
        nodes.push(
          <Tag key={i} className={classes}>{content}</Tag>
        );
        continue;
      }
    }

    // Lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      inList = true;
      listItems.push(<li key={`li-${i}`}>{line.slice(2)}</li>);
      continue;
    } else if (inList) {
      flushList(i);
      inList = false;
    }

    // Paragraphs / Empty Lines
    if (!line) {
      nodes.push(<div key={`empty-${i}`} className="h-3" />);
    } else {
      nodes.push(
        <p key={i} className="text-sm leading-relaxed text-foreground/85 my-2">
          {line}
        </p>
      );
    }
  }

  flushList(lines.length);
  flushTable(lines.length);
  return nodes;
}

export function CodeEditor({
  fileName,
  fileContent,
  onLoadFile,
  workspaceRoot,
}: {
  fileName: string;
  fileContent?: string;
  onLoadFile: (filePath: string) => Promise<void> | void;
  workspaceRoot?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const extension = useMemo(() => fileName.split(".").pop()?.toLowerCase() || "", [fileName]);

  useEffect(() => {
    if (["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(extension)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.resolve(onLoadFile(fileName))
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load file");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileName, onLoadFile, extension]);

  const lines = useMemo(() => {
    if (loading) {
      return [`# ${fileName}`, "", "# Loading file content..."];
    }
    if (loadError) {
      return [`# ${fileName}`, "", `# ${loadError}`];
    }
    if (fileContent !== undefined) {
      return fileContent.split("\n");
    }
    return [`# ${fileName}`, "", "# File content unavailable"];
  }, [fileName, fileContent, loading, loadError]);

  const language = useMemo(() => detectLanguage(fileName), [fileName]);
  const content = useMemo(() => lines.join("\n"), [lines]);

  const fileUrl = useMemo(() => {
    if (!workspaceRoot) return "";
    const fullPath = `${workspaceRoot}/${fileName}`.replace(/\\/g, "/");
    return `file://${fullPath}`;
  }, [workspaceRoot, fileName]);

  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(extension)) {
    return (
      <div className="w-full h-full bg-card/10 flex items-center justify-center p-8 overflow-auto">
        <div className="max-w-full max-h-full flex flex-col items-center justify-center gap-4 bg-background p-6 rounded-lg border border-border shadow-panel">
          <img src={fileUrl} className="max-w-full max-h-[70vh] object-contain rounded-md select-none pointer-events-none" alt={fileName} />
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{fileName}</div>
        </div>
      </div>
    );
  }

  if (extension === "pdf") {
    return (
      <div className="w-full h-full bg-[#1c1c21] flex items-center justify-center p-0">
        <iframe
          src={fileUrl}
          className="w-full h-full border-none"
          title={fileName}
        />
      </div>
    );
  }

  if (["md", "markdown"].includes(extension) && fileContent !== undefined && !loading && !loadError) {
    const mdNodes = parseMarkdownToReact(fileContent);
    return (
      <div className="w-full h-full bg-background overflow-y-auto p-8 select-text">
        <div className="max-w-3xl mx-auto prose dark:prose-invert">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-6 border-b border-border/40 pb-1.5 flex items-center justify-between">
            <span>Markdown Preview</span>
            <span className="normal-case font-normal text-muted-foreground/60">{fileName}</span>
          </div>
          {mdNodes}
        </div>
      </div>
    );
  }

  if (extension === "docx" && fileContent !== undefined && !loading && !loadError) {
    return (
      <div className="w-full h-full bg-background overflow-y-auto p-8 select-text">
        <div className="max-w-2xl mx-auto bg-card/60 p-8 rounded-lg shadow-panel border border-border/40 min-h-[90%] font-sans text-sm text-foreground/80 leading-relaxed">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest border-b border-border/30 pb-2 mb-6 flex items-center justify-between">
            <span>Word Document Preview</span>
            <span className="normal-case font-normal text-muted-foreground/60">{fileName}</span>
          </div>
          <div className="whitespace-pre-wrap">{fileContent || "Empty Document"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background font-mono-code text-code p-0 select-text">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "transparent",
          minHeight: "100%",
          padding: "8px 0",
          fontSize: "12px",
          lineHeight: "1.5",
        }}
        lineNumberStyle={{
          minWidth: "42px",
          paddingRight: "12px",
          color: "hsl(var(--muted-foreground) / 0.55)",
          userSelect: "none",
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}
