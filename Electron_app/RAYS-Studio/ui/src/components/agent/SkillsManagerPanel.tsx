import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, FolderOpen, Plus, RefreshCw, X, ChevronDown, ChevronRight, Zap } from "lucide-react";
import {
  hostInstallSkill,
  hostListSkills,
  hostOpenSkillsDirectory,
  hostSelectSkillFolder,
  isElectronHost,
  type SkillEntry,
} from "@/services/platformHost";

type SkillsManagerPanelProps = {
  open: boolean;
  onClose: () => void;
  workspaceRoot: string | null;
};

function getCategory(skillName: string): string {
  const parts = skillName.split("/");
  return parts.length > 1 ? parts[0] : "general";
}

function getShortName(skillName: string): string {
  const parts = skillName.split("/");
  return parts[parts.length - 1];
}

function categoryLabel(cat: string): string {
  return cat
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const CATEGORY_COLORS: Record<string, string> = {
  creative: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  github: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "software-development": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  productivity: "text-green-400 bg-green-500/10 border-green-500/20",
  research: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  media: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  mlops: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "data-science": "text-teal-400 bg-teal-500/10 border-teal-500/20",
  "autonomous-ai-agents": "text-rays-lilac bg-rays-lilac/10 border-rays-lilac/20",
  "computer-use": "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  email: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  "smart-home": "text-lime-400 bg-lime-500/10 border-lime-500/20",
  "social-media": "text-rose-400 bg-rose-500/10 border-rose-500/20",
  "note-taking": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  general: "text-rays-lilac bg-rays-lilac/10 border-rays-lilac/20",
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || "text-muted-foreground bg-secondary/30 border-white/10";
}

function installTargetLabel(scope: "global" | "project", workspaceRoot: string | null): string {
  if (scope === "global") return "~/.rays/skills/";
  if (!workspaceRoot) return "./skills/ (open a workspace first)";
  return `${workspaceRoot}/skills/`;
}

export function SkillsManagerPanel({ open, onClose, workspaceRoot }: SkillsManagerPanelProps) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<"global" | "project">("project");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<"all" | "project" | "global">("all");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const desktop = isElectronHost();

  const reload = useCallback(async () => {
    if (!open) return;
    setError(null);
    setLoading(true);
    try {
      const items = await hostListSkills(workspaceRoot || undefined);
      setSkills(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list skills");
    } finally {
      setLoading(false);
    }
  }, [open, workspaceRoot]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!open) {
      setSelectedFolder("");
      setError(null);
      setSearch("");
      setShowAddPanel(false);
    }
  }, [open]);

  const filteredSkills = useMemo(() => {
    let list = skills;
    if (activeFilter !== "all") list = list.filter((s) => s.scope === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [skills, activeFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, SkillEntry[]>();
    for (const skill of filteredSkills) {
      const cat = getCategory(skill.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(skill);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSkills]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleBrowse = async () => {
    if (!desktop) { setError("Adding skills requires the RAYS Studio desktop app"); return; }
    setError(null);
    try {
      const folder = await hostSelectSkillFolder();
      if (folder) setSelectedFolder(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to choose folder");
    }
  };

  const handleAdd = async () => {
    if (!desktop) { setError("Adding skills requires the RAYS Studio desktop app"); return; }
    if (scope === "project" && !workspaceRoot) { setError("Open a workspace to install project skills"); return; }
    if (!selectedFolder) { setError("Choose a skill folder first"); return; }
    setBusy(true);
    setError(null);
    try {
      await hostInstallSkill(scope, workspaceRoot || undefined, selectedFolder);
      setSelectedFolder("");
      setShowAddPanel(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install skill");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTargetFolder = async () => {
    if (!desktop) { setError("Opening skill folders requires the RAYS Studio desktop app"); return; }
    if (scope === "project" && !workspaceRoot) { setError("Open a workspace to view project skills folder"); return; }
    setError(null);
    try {
      await hostOpenSkillsDirectory(scope, workspaceRoot || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open folder");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border bg-card shadow-2xl overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>

        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rays-violet/20 flex items-center justify-center">
              <Zap size={16} className="text-rays-lilac" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Skills Library</h2>
              <p className="text-[11px] text-muted-foreground">
                {skills.length} skill{skills.length !== 1 ? "s" : ""} installed
                {workspaceRoot ? ` · ${workspaceRoot.split(/[\\/]/).pop()}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddPanel((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rays-violet/20 hover:bg-rays-violet/30 text-rays-lilac text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              Add Skill
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Add skill panel (collapsible) */}
        {showAddPanel && (
          <div className="p-4 border-b bg-secondary/20 shrink-0 space-y-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Skill from Folder</div>
            {!desktop && (
              <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/40 rounded p-2">
                Skill install requires the packaged desktop app.
              </div>
            )}
            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded p-2">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${scope === "project" ? "bg-rays-violet text-white" : "bg-secondary hover:bg-secondary/80"}`}
                onClick={() => setScope("project")}
                disabled={!workspaceRoot}
                title={!workspaceRoot ? "Open a workspace first" : undefined}
              >Project</button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${scope === "global" ? "bg-rays-violet text-white" : "bg-secondary hover:bg-secondary/80"}`}
                onClick={() => setScope("global")}
              >Global</button>
              <span className="text-[11px] text-muted-foreground self-center ml-1">
                → {installTargetLabel(scope, workspaceRoot)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleBrowse()}
                disabled={busy || !desktop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium disabled:opacity-50 hover:bg-secondary/80 transition-colors"
              >
                <FolderOpen size={13} />
                Browse folder…
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={busy || !desktop || !selectedFolder}
                className="px-3 py-1.5 rounded-lg bg-rays-violet text-xs font-medium disabled:opacity-50 hover:bg-rays-violet/80 transition-colors"
              >
                {busy ? "Installing…" : "Install Skill"}
              </button>
              <button
                type="button"
                onClick={() => void handleOpenTargetFolder()}
                disabled={busy || !desktop || (scope === "project" && !workspaceRoot)}
                className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 hover:bg-secondary/40 transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                Open skills folder
              </button>
            </div>
            {selectedFolder && (
              <div className="text-xs rounded border bg-secondary/20 p-2 font-mono" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="text-muted-foreground">Selected: </span>
                <span className="text-foreground/90 truncate">{selectedFolder}</span>
              </div>
            )}
          </div>
        )}

        {/* Search + filter bar */}
        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex-1 flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {(["all", "project", "global"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[11px] px-2 py-1 rounded-md transition-colors capitalize ${activeFilter === f ? "bg-rays-violet/30 text-rays-lilac" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" />
              Loading skills…
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {search ? `No skills match "${search}"` : "No skills installed yet."}
              </p>
              {!search && (
                <p className="text-xs mt-2 opacity-60">
                  Click <strong>Add Skill</strong> to install from a folder containing SKILL.md.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([cat, catSkills]) => {
                const isCollapsed = collapsedCategories.has(cat);
                const colorClass = getCategoryColor(cat);
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center gap-2 mb-2 group"
                    >
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClass}`}>
                        {categoryLabel(cat)}
                        <span className="opacity-70">{catSkills.length}</span>
                      </span>
                      <span className="flex-1 h-px bg-white/5" />
                      {isCollapsed ? (
                        <ChevronRight size={12} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={12} className="text-muted-foreground" />
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                        {catSkills.map((skill) => {
                          const shortName = getShortName(skill.name);
                          return (
                            <div
                              key={`${skill.scope}-${skill.name}`}
                              className="p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 transition-colors group/skill"
                              style={{ borderColor: "rgba(255,255,255,0.07)" }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate text-foreground/90 group-hover/skill:text-foreground">
                                    {shortName}
                                  </div>
                                  {skill.description && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                      {skill.description}
                                    </div>
                                  )}
                                </div>
                                <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${
                                  skill.scope === "project"
                                    ? "text-rays-pink border-rays-pink/30 bg-rays-pink/10"
                                    : "text-muted-foreground border-white/10 bg-white/5"
                                }`}>
                                  {skill.scope}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer status */}
        <div className="px-4 py-2 border-t text-[11px] text-muted-foreground flex items-center gap-3 shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span>{filteredSkills.length} of {skills.length} skills shown</span>
          {!desktop && <span className="text-amber-400">⚠ Desktop app required to install</span>}
        </div>
      </div>
    </div>
  );
}
