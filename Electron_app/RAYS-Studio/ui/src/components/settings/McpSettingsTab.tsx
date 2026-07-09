import { useEffect, useState } from "react";
import { Trash, RefreshCw, Plus, Check } from "lucide-react";
import { hostReadMcpConfig, hostWriteMcpConfig, hostRemoveMcpServer } from "@/services/platformHost";
import { raysSessionStore } from "@/services/raysSession";

export function McpSettingsTab({ workspaceRoot }: { workspaceRoot?: string | null }) {
  const [scope, setScope] = useState<"global" | "project">("global");
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null);
  const [serverJson, setServerJson] = useState("");
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; tools?: any[] } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (scope === "project" && !workspaceRoot) {
      setScope("global");
    }
  }, [workspaceRoot, scope]);

  const loadServers = async () => {
    try {
      const config = await hostReadMcpConfig(scope, workspaceRoot || undefined);
      const srvs = config.mcp_servers || [];
      setServers(srvs);
      if (srvs.length > 0 && !selectedServerName && !isEditingNew) {
        setSelectedServerName(srvs[0].name);
      }
    } catch (e) {
      console.error("Failed to load MCP config", e);
    }
  };

  useEffect(() => {
    loadServers();
  }, [scope, workspaceRoot]);

  useEffect(() => {
    if (selectedServerName && !isEditingNew) {
      const srv = servers.find(s => s.name === selectedServerName);
      if (srv) {
        setServerJson(JSON.stringify(srv, null, 2));
        setTestResult(null);
      }
    }
  }, [selectedServerName, servers, isEditingNew]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const parsed = JSON.parse(serverJson);
      if (!parsed.name) {
        alert("Server configuration must include a 'name' field.");
        setIsSaving(false);
        return;
      }
      await hostWriteMcpConfig(scope, workspaceRoot || undefined, parsed);
      setIsEditingNew(false);
      setSelectedServerName(parsed.name);
      await loadServers();
      raysSessionStore.reloadMcp();
    } catch (e) {
      alert("Invalid JSON or save failed: " + e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await hostRemoveMcpServer(scope, workspaceRoot || undefined, name);
      if (selectedServerName === name) {
        setSelectedServerName(null);
      }
      await loadServers();
      raysSessionStore.reloadMcp();
    } catch (e) {
      alert("Failed to remove server");
    }
  };

  const handleReload = () => {
    raysSessionStore.reloadMcp();
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      const parsed = JSON.parse(serverJson);
      if (!parsed.name) {
        setTestResult({ ok: false, error: "Server must have a name to test." });
        return;
      }
      const res = await raysSessionStore.testMcpServer(parsed);
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, error: String(e) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleNew = () => {
    setIsEditingNew(true);
    setSelectedServerName(null);
    setServerJson('{\n  "name": "my-server",\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-everything"]\n}');
    setTestResult(null);
  };

  return (
    <div className="flex flex-col h-full space-y-3 pb-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-foreground mb-1 text-xs">Model Context Protocol</h3>
          <p className="text-[11px] text-muted-foreground">Manage external tools and contexts through MCP servers.</p>
        </div>
        {workspaceRoot && (
          <div className="flex bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setScope("global")}
              className={`px-3 py-1 rounded-md text-[11px] transition-all ${scope === "global" ? "bg-rays-violet text-accent-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
            >
              Global
            </button>
            <button
              onClick={() => setScope("project")}
              className={`px-3 py-1 rounded-md text-[11px] transition-all ${scope === "project" ? "bg-rays-violet text-accent-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
            >
              Project
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 border border-secondary rounded-lg overflow-hidden min-h-[300px]">
        <div className="w-1/3 bg-secondary/30 border-r border-secondary flex flex-col">
          <div className="p-2 border-b border-secondary flex justify-between items-center bg-secondary/50">
            <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">Servers</span>
            <div className="flex gap-1">
              <button onClick={handleReload} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors" title="Reload MCP">
                <RefreshCw size={13} />
              </button>
              <button onClick={handleNew} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors" title="New Server">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {servers.map((srv: any) => (
              <div
                key={srv.name}
                onClick={() => { setIsEditingNew(false); setSelectedServerName(srv.name); }}
                className={`p-2 rounded-md cursor-pointer text-xs flex justify-between items-center group transition-all ${selectedServerName === srv.name && !isEditingNew ? "bg-rays-pink/10 border border-rays-pink/30 text-rays-pink" : "border border-transparent hover:bg-secondary hover:border-secondary-foreground/10"}`}
              >
                <div className="truncate flex-1 font-medium">{srv.name}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(srv.name); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Remove Server"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
            {servers.length === 0 && !isEditingNew && (
              <div className="text-[11px] text-muted-foreground p-4 text-center border border-dashed border-secondary m-2 rounded-lg">
                No {scope} servers configured.
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-card relative">
          {(selectedServerName || isEditingNew) ? (
            <div className="flex flex-col h-full">
              <div className="p-2 border-b border-secondary bg-secondary/20 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider ml-1">
                  {isEditingNew ? "New Server Configuration" : "Server Configuration"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleTest}
                    disabled={isTesting}
                    className="px-3 py-1 bg-secondary rounded-md text-[11px] font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isTesting ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 bg-rays-pink text-white rounded-md text-[11px] font-medium hover:bg-rays-pink/90 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Save Server
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3 flex flex-col relative">
                <textarea
                  value={serverJson}
                  onChange={e => setServerJson(e.target.value)}
                  className="flex-1 w-full h-full bg-[#111111] rounded-md p-3 text-[12px] font-mono-code leading-relaxed text-blue-300 focus:outline-none focus:ring-1 focus:ring-rays-pink shadow-inner border border-secondary"
                  spellCheck={false}
                />
              </div>
              {testResult && (
                <div className={`mx-3 mb-3 p-2.5 rounded-md text-[11px] border shadow-sm ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {testResult.ok ? (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold flex items-center gap-1.5"><Check size={12} /> Connection Successful</span>
                      <span className="opacity-90">Verified connection and discovered {testResult.tools?.length || 0} tools.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">Connection Failed</span>
                      <span className="opacity-90">{testResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center space-y-3">
              <div className="p-4 bg-secondary/50 rounded-full">
                <Plus size={24} className="opacity-50" />
              </div>
              <p className="text-xs max-w-[200px]">Select a server from the list or click the + icon to configure a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
