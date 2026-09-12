import { useState } from "react";
import {
  Terminal,
  HelpCircle,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronsUpDown,
  FileCode,
  FileText,
  Palette,
  Settings,
  File,
  Search,
  CheckSquare2,
  Square,
  CircleDot,
  Compass,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem, DiffLine, TodoItem, ExploredDetail } from "@/services/agentActivity";
import { formatDuration, splitFilePath } from "@/services/agentActivity";

function FileTypeIcon({ fileName, size = 14 }: { fileName: string; size?: number }) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["tsx", "jsx", "ts", "js", "mjs", "cjs"].includes(ext)) {
    return <FileCode size={size} className="text-sky-400 shrink-0" />;
  }
  if (["css", "scss", "sass", "less", "html", "svg"].includes(ext)) {
    return <Palette size={size} className="text-purple-400 shrink-0" />;
  }
  if (["py", "pyw", "ipynb"].includes(ext)) {
    return <Terminal size={size} className="text-amber-400 shrink-0" />;
  }
  if (["json", "yaml", "yml", "toml", "ini", "config"].includes(ext)) {
    return <Settings size={size} className="text-orange-400 shrink-0" />;
  }
  if (["md", "txt", "log", "rst"].includes(ext)) {
    return <FileText size={size} className="text-emerald-400 shrink-0" />;
  }
  return <File size={size} className="text-muted-foreground/70 shrink-0" />;
}

export function EditActivityRow({ item }: { item: Extract<ActivityItem, { kind: "edit" }> }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const { dir, file } = splitFilePath(item.filePath);
  const dirDisplay = dir ? `/${dir}/` : "";
  const lines: DiffLine[] = item.diffLines || [];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = lines.map((l) => l.content).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full my-1" data-slot="edit-activity">
      {/* Single line interactive row */}
      <div
        onClick={() => setOpen(!open)}
        className="group flex items-center justify-between cursor-pointer py-0.5 px-1 rounded hover:bg-white/[0.04] transition-all select-none"
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px] overflow-hidden truncate">
          <span className="font-semibold text-foreground tracking-tight">Edit</span>
          <span className="text-foreground/95 font-medium">{file}</span>
          {dirDisplay && <span className="text-muted-foreground/60 text-[10px] truncate">{dirDisplay}</span>}
          <div className="flex items-center gap-1 text-[10px] font-semibold ml-1">
            {item.added > 0 && <span className="text-emerald-400">+{item.added}</span>}
            {item.removed > 0 && <span className="text-rose-400">-{item.removed}</span>}
          </div>
        </div>
        <ChevronDown
          size={13}
          className={cn(
            "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Expanded Diff Viewer Frame */}
      {open && (
        <div className="mt-1.5 mb-2 rounded-lg border border-white/10 bg-[#131316] overflow-hidden shadow-2xl transition-all duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-[10.5px] font-mono truncate mr-2">
              <FileTypeIcon fileName={file} size={13} />
              <span className="text-muted-foreground/60">{dir ? `/${dir}/` : ""}</span>
              <span className="text-foreground font-semibold">{file}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[10px] shrink-0">
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {item.added > 0 && <span className="text-emerald-400 font-semibold">+{item.added}</span>}
                {item.removed > 0 && <span className="text-rose-400 font-semibold">-{item.removed}</span>}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy diff"
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Collapse"
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                <ChevronsUpDown size={12} />
              </button>
            </div>
          </div>

          {/* Diff Content */}
          <div className="max-h-[340px] overflow-y-auto font-mono text-[10.5px] leading-relaxed py-1 custom-scrollbar">
            {lines.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/50 italic">No diff lines to display</div>
            ) : (
              lines.map((line, idx) => {
                const isAdd = line.type === "add";
                const isRemove = line.type === "remove";
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-stretch px-2.5 py-[1px] transition-colors",
                      isRemove && "bg-rose-500/10 text-rose-200 border-l-2 border-rose-500/70",
                      isAdd && "bg-emerald-500/10 text-emerald-200 border-l-2 border-emerald-500/70",
                      !isAdd && !isRemove && "text-muted-foreground/80 hover:bg-white/[0.02]"
                    )}
                  >
                    <span className="w-8 text-right pr-2 select-none text-muted-foreground/30 text-[10px] shrink-0 font-mono">
                      {line.lineNo !== undefined ? line.lineNo : idx + 1}
                    </span>
                    <span className="whitespace-pre overflow-x-auto">{line.content}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function WriteActivityRow({ item }: { item: Extract<ActivityItem, { kind: "write" }> }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const { dir, file } = splitFilePath(item.filePath);
  const dirDisplay = dir ? `/${dir}/` : "";
  const lines = item.content ? item.content.split("\n") : [];
  const lineCount = item.lineCount || lines.length;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full my-1" data-slot="write-activity">
      {/* Single line interactive row */}
      <div
        onClick={() => setOpen(!open)}
        className="group flex items-center justify-between cursor-pointer py-0.5 px-1 rounded hover:bg-white/[0.04] transition-all select-none"
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px] overflow-hidden truncate">
          <span className="font-semibold text-foreground tracking-tight">Write</span>
          <span className="text-foreground/95 font-medium">{file}</span>
          {dirDisplay && <span className="text-muted-foreground/60 text-[10px] truncate">{dirDisplay}</span>}
        </div>
        <ChevronDown
          size={13}
          className={cn(
            "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Expanded File Viewer Frame */}
      {open && (
        <div className="mt-1.5 mb-2 rounded-lg border border-white/10 bg-[#131316] overflow-hidden shadow-2xl transition-all duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-[10.5px] font-mono truncate mr-2">
              <FileTypeIcon fileName={file} size={13} />
              <span className="text-muted-foreground/60">{dir ? `/${dir}/` : ""}</span>
              <span className="text-foreground font-semibold">{file}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[10px] shrink-0">
              <span className="text-muted-foreground/50 text-[10px] font-mono">{lineCount} lines</span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy content"
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Collapse"
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                <ChevronsUpDown size={12} />
              </button>
            </div>
          </div>

          {/* File Content with Line Numbers */}
          <div className="max-h-[340px] overflow-y-auto font-mono text-[10.5px] leading-relaxed py-1 custom-scrollbar">
            {lines.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/50 italic">Empty file created</div>
            ) : (
              lines.map((line, idx) => (
                <div key={idx} className="flex items-stretch px-2.5 py-[1px] hover:bg-white/[0.02] transition-colors">
                  <span className="w-8 text-right pr-2 select-none text-muted-foreground/30 text-[10px] shrink-0 font-mono">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre overflow-x-auto text-foreground/90">{line}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CommandActivityRow({ item }: { item: Extract<ActivityItem, { kind: "command" }> }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = item.status === "running";
  const duration = item.durationMs ? formatDuration(item.durationMs) : undefined;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.output || item.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full my-1.5" data-slot="command-activity">
      {/* Single line interactive row */}
      <div
        onClick={() => setOpen(!open)}
        className="group flex items-center justify-between cursor-pointer py-1 px-1 rounded-md hover:bg-white/[0.04] transition-all select-none"
      >
        <div className="flex items-center gap-2 font-mono text-[13px] min-w-0 overflow-hidden">
          <span className="font-bold text-foreground tracking-tight shrink-0">Shell</span>
          <span className="text-muted-foreground/90 truncate text-xs font-mono">{item.command}</span>
          {pending && <Loader2 size={12} className="animate-spin text-amber-400 shrink-0 ml-1" />}
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0 ml-2",
            open && "rotate-180"
          )}
        />
      </div>

      {/* Expanded Terminal Output Frame */}
      {open && (
        <div className="mt-2 mb-3 rounded-lg border border-white/10 bg-[#0c0c0e] overflow-hidden shadow-2xl font-mono transition-all duration-200">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-white/[0.02] text-xs">
            <div className="flex items-center gap-2 text-foreground/90 truncate mr-2">
              <Terminal size={13} className="text-muted-foreground shrink-0" />
              <span className="truncate text-muted-foreground/80">$ {item.command}</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {duration && <span className="text-muted-foreground/50 text-[11px]">{duration}</span>}
              <button
                type="button"
                onClick={handleCopy}
                title="Copy output"
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          <pre className="p-3 text-[12px] leading-relaxed text-muted-foreground/90 max-h-64 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
            {item.output || (pending ? "Running command in shell…" : "(Command executed with no output)")}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ExploredActivityRow({ item }: { item: Extract<ActivityItem, { kind: "explored" }> }) {
  const [open, setOpen] = useState(false);
  const details = item.details || [];

  return (
    <div className="w-full my-1.5" data-slot="explored-activity">
      {/* Single line interactive row */}
      <div
        onClick={() => details.length > 0 && setOpen(!open)}
        className={cn(
          "group flex items-center justify-between py-1 px-1 rounded-md transition-all select-none",
          details.length > 0 ? "cursor-pointer hover:bg-white/[0.04]" : ""
        )}
      >
        <div className="flex items-center gap-2 font-mono text-[13px]">
          <span className="font-bold text-foreground tracking-tight">{item.verb || "Explored"}</span>
          <span className="text-muted-foreground/70 text-xs">{item.summary}</span>
        </div>
        {details.length > 0 && (
          <ChevronDown
            size={14}
            className={cn(
              "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )}
          />
        )}
      </div>

      {/* Expanded Exploration Detail Frame */}
      {open && details.length > 0 && (
        <div className="mt-2 mb-3 rounded-lg border border-white/10 bg-[#131316] p-3 shadow-xl space-y-1.5 font-mono text-xs">
          {details.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2 text-muted-foreground/80 truncate">
              {d.type === "search" ? (
                <Search size={12} className="text-sky-400 shrink-0" />
              ) : (
                <Compass size={12} className="text-purple-400 shrink-0" />
              )}
              <span className="text-foreground/90 font-medium truncate">{d.target}</span>
              {d.snippet && <span className="text-muted-foreground/50 text-[11px] truncate">({d.snippet})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanActivityRow({ item }: { item: Extract<ActivityItem, { kind: "plan" }> }) {
  const [open, setOpen] = useState(true);
  const todos = item.todos || [];
  const completedCount = todos.filter((t) => t.status === "completed").length;
  const totalCount = todos.length;

  return (
    <div className="w-full my-2.5" data-slot="plan-activity">
      <div className="rounded-lg border border-white/10 bg-[#141417]/80 overflow-hidden shadow-lg">
        {/* Header */}
        <div
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
        >
          <span className="text-xs font-medium text-muted-foreground/80">
            {completedCount} of {totalCount} todos completed
          </span>
          <ChevronDown
            size={14}
            className={cn("text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")}
          />
        </div>

        {/* Todos List */}
        {open && (
          <div className="px-3.5 pb-3 pt-1 space-y-2">
            {todos.map((todo) => {
              const isCompleted = todo.status === "completed";
              const isInProgress = todo.status === "in_progress";
              return (
                <div key={todo.id} className="flex items-start gap-2.5 text-xs leading-relaxed">
                  {isCompleted ? (
                    <CheckSquare2 size={14} className="text-muted-foreground/50 shrink-0 mt-0.5" />
                  ) : isInProgress ? (
                    <CircleDot size={14} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  ) : (
                    <Square size={14} className="text-muted-foreground/30 shrink-0 mt-0.5" />
                  )}
                  <span
                    className={cn(
                      isCompleted && "text-muted-foreground/50 line-through",
                      isInProgress && "text-foreground font-medium",
                      !isCompleted && !isInProgress && "text-muted-foreground/70"
                    )}
                  >
                    {todo.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ToolActivityRow({ item }: { item: Extract<ActivityItem, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const pending = item.status === "running";
  const duration = item.durationMs ? formatDuration(item.durationMs) : undefined;

  return (
    <div className="w-full my-1.5 text-[13px]" data-slot="tool-activity">
      <div
        onClick={() => item.detail && setOpen(!open)}
        className={cn(
          "group flex items-center justify-between py-1 px-1 rounded-md transition-all select-none",
          item.detail ? "cursor-pointer hover:bg-white/[0.04]" : ""
        )}
      >
        <div className="flex items-center gap-2 font-mono text-xs overflow-hidden truncate">
          <Wrench size={13} className="text-muted-foreground/70 shrink-0" />
          <span className="font-bold text-foreground">{item.tool || item.title}</span>
          {item.summary && <span className="text-muted-foreground/60 truncate">{item.summary}</span>}
          {pending && <Loader2 size={12} className="animate-spin text-muted-foreground/70 shrink-0 ml-1" />}
        </div>
        {item.detail && (
          <ChevronDown
            size={14}
            className={cn(
              "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )}
          />
        )}
      </div>

      {open && item.detail && (
        <pre className="mt-2 mb-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#131316] p-3 font-mono text-xs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap custom-scrollbar shadow-lg">
          {item.detail}
        </pre>
      )}
    </div>
  );
}

export function ActionActivityRow({ item }: { item: Extract<ActivityItem, { kind: "action" }> }) {
  const [open, setOpen] = useState(false);
  const duration = item.durationMs ? formatDuration(item.durationMs) : undefined;
  const expandable = item.detail.trim().length > 0;

  return (
    <div className="w-full my-1 text-xs" data-slot="action-activity">
      <div
        onClick={() => expandable && setOpen(!open)}
        className={cn(
          "group flex items-center justify-between py-1 px-1 rounded-md transition-all select-none",
          expandable ? "cursor-pointer hover:bg-white/[0.04]" : ""
        )}
      >
        <div className="flex items-center gap-2 font-mono truncate">
          <span className="font-bold text-foreground">{item.verb}</span>
          {item.detail && <span className="text-muted-foreground/70 truncate">{item.detail}</span>}
        </div>
        {expandable && (
          <ChevronDown
            size={14}
            className={cn(
              "text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )}
          />
        )}
      </div>
      {open && item.detail && (
        <pre className="mt-1 mb-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#131316] p-2.5 font-mono text-xs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap custom-scrollbar">
          {item.detail}
        </pre>
      )}
    </div>
  );
}

export function QuestionActivityRow({ item }: { item: Extract<ActivityItem, { kind: "question" }> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground my-1.5">
      <HelpCircle size={14} className="text-muted-foreground/70 shrink-0" />
      <span className="font-medium">{item.question || "Asked a question"}</span>
    </div>
  );
}

export function NoteActivityRow({ item }: { item: Extract<ActivityItem, { kind: "note" }> }) {
  return (
    <div
      className={cn(
        "text-xs rounded-md px-2.5 py-1.5 my-1.5",
        item.level === "warn" && "bg-amber-500/10 text-amber-200/80 border border-amber-500/20",
        item.level === "error" && "bg-destructive/10 text-destructive/90 border border-destructive/20",
        item.level === "info" && "text-muted-foreground/70 bg-white/[0.02]"
      )}
    >
      <span>{item.message}</span>
    </div>
  );
}

export function ActivityItemView({ item }: { item: ActivityItem }) {
  switch (item.kind) {
    case "edit":
      return <EditActivityRow item={item} />;
    case "write":
      return <WriteActivityRow item={item} />;
    case "command":
      return <CommandActivityRow item={item} />;
    case "explored":
      return <ExploredActivityRow item={item} />;
    case "plan":
      return <PlanActivityRow item={item} />;
    case "tool":
      return <ToolActivityRow item={item} />;
    case "action":
      return <ActionActivityRow item={item} />;
    case "question":
      return <QuestionActivityRow item={item} />;
    case "note":
      return <NoteActivityRow item={item} />;
    default:
      return null;
  }
}
