import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "node:os";
import { spawn, ChildProcessWithoutNullStreams, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

type BackendSession = {
  id: string;
  process: ChildProcessWithoutNullStreams;
  wsPort: number;
  workspacePath: string;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    allowedHosts: ["user-ms-7e06.tail3d648e.ts.net", ".ts.net"],
    hmr: {
      overlay: true,
    },
  },
  plugins: [
    react(),
    {
      name: "rays-session-manager",
      configureServer(server) {
        const sessions = new Map<string, BackendSession>();
        const cliRoot = path.resolve(__dirname, "../../../");
        const studioRoot = path.resolve(__dirname, "..");
        const pythonPath = [
          path.join(cliRoot, "src"),
          path.join(studioRoot, "bridge/src"),
          process.env.PYTHONPATH || "",
        ]
          .filter(Boolean)
          .join(path.delimiter);

        let proxyProcess: ChildProcessWithoutNullStreams | null = null;
        const startRayspyProxy = async () => {
          try {
            const rayspyDir = path.join(cliRoot, "src/rays_core/skills/rayspy");
            const proxyScript = path.join(rayspyDir, "proxy-server.mjs");
            const distIndex = path.join(rayspyDir, "dist/index.html");
            const nodeBinary = process.platform === "win32" ? "node.exe" : "node";

            try {
              await fs.access(distIndex);
            } catch {
              console.warn(
                "\n\x1b[33m[rays-session-manager] WARNING: rayspy UI dist folder not found.\x1b[0m\n" +
                "\x1b[33mPlease run 'npm run build' inside 'src/rays_core/skills/rayspy' to compile it.\x1b[0m\n"
              );
            }

            proxyProcess = spawn(nodeBinary, [proxyScript], {
              cwd: rayspyDir,
              env: process.env,
              stdio: "inherit",
            });
            console.log("[rays-session-manager] Auto-started rayspy proxy server from:", proxyScript);
          } catch (err: any) {
            console.error("[rays-session-manager] Failed to auto-start rayspy proxy server:", err);
          }
        };

        void startRayspyProxy();

        const stopSession = (sessionId: string) => {
          const session = sessions.get(sessionId);
          if (!session) return false;
          session.process.kill("SIGTERM");
          sessions.delete(sessionId);
          return true;
        };

        server.httpServer?.on("close", () => {
          for (const sessionId of sessions.keys()) {
            stopSession(sessionId);
          }
          if (proxyProcess) {
            proxyProcess.kill("SIGTERM");
            console.log("[rays-session-manager] Stopped rayspy proxy server.");
          }
        });

        server.middlewares.use("/api/session/start", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString("utf8");
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const workspacePath = String(parsed.workspacePath || "").trim();
              const runtimeOverrides = parsed.runtimeOverrides || {};
              const conversationId = parsed.conversationId
                ? String(parsed.conversationId)
                : undefined;
              if (!workspacePath) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "workspacePath is required" }));
                return;
              }

              const sessionId = randomUUID();
              const command = process.platform === "win32" ? "python" : "python3";
              const bridgeArgs = [
                "-m",
                "rays_bridge.ws_bridge",
                "--workspace",
                workspacePath,
                "--port",
                "0",
                "--runtime_overrides",
                JSON.stringify(runtimeOverrides),
              ];
              if (conversationId) {
                bridgeArgs.push("--conversation_id", conversationId);
              }
              const child = spawn(command, bridgeArgs, {
                cwd: cliRoot,
                env: { ...process.env, PYTHONPATH: pythonPath },
              });

              let settled = false;
              const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                child.kill("SIGTERM");
                res.statusCode = 504;
                res.end(JSON.stringify({ error: "Bridge startup timeout" }));
              }, 15000);

              const onFail = (errorMessage: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: errorMessage }));
              };

              child.stderr.on("data", (chunk) => {
                const text = chunk.toString("utf8").trim();
                if (!text) return;
                // Do not fail immediately on stderr output (warnings are common).
                // Startup failure is determined by timeout or early process exit.
                console.warn("[rays-session-manager][bridge stderr]", text);
              });

              child.stdout.on("data", (chunk) => {
                const lines = chunk.toString("utf8").split("\n");
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const parsedLine = JSON.parse(line);
                    if (parsedLine.event === "bridge_ready" && typeof parsedLine.port === "number") {
                      if (settled) return;
                      settled = true;
                      clearTimeout(timeout);
                      sessions.set(sessionId, {
                        id: sessionId,
                        process: child,
                        wsPort: parsedLine.port,
                        workspacePath,
                      });
                      res.setHeader("content-type", "application/json");
                      res.end(JSON.stringify({ sessionId, wsPort: parsedLine.port }));
                      return;
                    }
                  } catch {
                    // Ignore non-JSON lines.
                  }
                }
              });

              child.on("error", (err) => {
                onFail(err.message);
              });
              child.on("exit", (code) => {
                if (!settled) {
                  onFail(`Bridge exited before ready (code: ${code ?? "unknown"})`);
                }
              });
            } catch (error) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }
          });
        });

        server.middlewares.use("/api/session/stop", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString("utf8");
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const sessionId = String(parsed.sessionId || "");
              const stopped = stopSession(sessionId);
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ stopped }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }
          });
        });

        server.middlewares.use("/api/file/read", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString("utf8");
          });
          req.on("end", async () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const workspaceRoot = String(parsed.workspaceRoot || "");
              const relativePath = String(parsed.relativePath || "");
              if (!workspaceRoot || !relativePath) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "workspaceRoot and relativePath are required" }));
                return;
              }
              const normalizedRoot = path.resolve(workspaceRoot);
              const resolvedPath = path.resolve(normalizedRoot, relativePath);
              if (!resolvedPath.startsWith(normalizedRoot)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid file path" }));
                return;
              }
              const content = await fs.readFile(resolvedPath, "utf8");
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ content }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to read file" }));
            }
          });
        });

        server.middlewares.use("/api/system/list-skills", async (req, res) => {
          let body = "";
          req.on("data", (chunk) => { body += chunk.toString("utf8"); });
          req.on("end", async () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const workspaceRoot = parsed.workspaceRoot;
              const results: any[] = [];
              const scopes = [
                ["project", workspaceRoot ? path.join(workspaceRoot, "skills") : null],
                ["global", path.join((await import("node:os")).homedir(), ".rays", "skills")],
              ];
              for (const [scope, dir] of scopes) {
                if (!dir) continue;
                try {
                  const entries = await fs.readdir(dir as string, { withFileTypes: true });
                  for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const skillDir = path.join(dir as string, entry.name);
                    const mdPath = path.join(skillDir, "SKILL.md");
                    try {
                      await fs.access(mdPath);
                      const content = await fs.readFile(mdPath, "utf8");
                      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
                      let desc = "";
                      if (fmMatch) {
                        const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
                        if (descMatch) desc = descMatch[1].trim();
                      }
                      results.push({ name: entry.name, scope, path: skillDir, description: desc });
                    } catch {}
                  }
                } catch {}
              }
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(results));
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify([]));
            }
          });
        });

        server.middlewares.use("/api/system/read-mcp", async (req, res) => {
          let body = "";
          req.on("data", (chunk) => { body += chunk.toString("utf8"); });
          req.on("end", async () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const scope = parsed.scope;
              const workspaceRoot = parsed.workspaceRoot;
              const os = await import("node:os");
              const configPath = scope === "project" 
                ? path.join(workspaceRoot, ".rays", "mcp.json")
                : path.join(os.homedir(), ".rays", "mcp.json");
              try {
                const content = await fs.readFile(configPath, "utf8");
                res.setHeader("content-type", "application/json");
                res.end(content);
              } catch {
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ mcp_servers: [] }));
              }
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ mcp_servers: [] }));
            }
          });
        });

        server.middlewares.use("/api/system/select-folder", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          try {
            let folderPath = "";
            if (process.platform === "darwin") {
              const { stdout } = await execFileAsync("osascript", [
                "-e",
                'POSIX path of (choose folder with prompt "Select workspace folder for RAYS")',
              ]);
              folderPath = stdout.trim();
            } else if (process.platform === "win32") {
              const script = [
                "Add-Type -AssemblyName System.Windows.Forms",
                "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
                '$dialog.Description = "Select workspace folder for RAYS"',
                "$dialog.ShowNewFolderButton = $false",
                "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
                "  Write-Output $dialog.SelectedPath",
                "}",
              ].join(";");
              const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
              folderPath = stdout.trim();
            } else {
              try {
                const { stdout } = await execFileAsync("zenity", [
                  "--file-selection",
                  "--directory",
                  "--title=Select workspace folder for RAYS",
                ]);
                folderPath = stdout.trim();
              } catch {
                const { stdout } = await execFileAsync("kdialog", [
                  "--getexistingdirectory",
                  ".",
                  "Select workspace folder for RAYS",
                ]);
                folderPath = stdout.trim();
              }
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ folderPath }));
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Folder selection failed or was cancelled." }));
          }
        });

        server.middlewares.use("/api/voice/transcribe", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });

          req.on("end", async () => {
            try {
              const { audioBase64, mimeType, provider } = JSON.parse(body || "{}");
              const isWin = process.platform === "win32";

              // Cross-platform Python resolver — venv first (has rays_core, edge-tts, faster-whisper)
              const repoVenvPy = path.join(cliRoot, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
              const pythonCandidates: string[] = [
                repoVenvPy,
                process.env.PYTHON || "",
                process.env.PYTHON3 || "",
                ...(isWin ? [
                  "python.exe",
                  path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "python.exe"),
                  path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
                  path.join(os.homedir(), "AppData", "Local", "Programs", "Python", "Python312", "python.exe"),
                  "python",
                ] : []),
                ...(!isWin && process.platform === "darwin" ? [
                  "/opt/homebrew/bin/python3",
                  "/opt/anaconda3/bin/python3",
                  "/usr/local/bin/python3",
                  "python3",
                ] : []),
                ...(!isWin && process.platform === "linux" ? [
                  "/usr/bin/python3",
                  "/usr/local/bin/python3",
                  "/usr/bin/python",
                  "python3",
                ] : []),
                "python",
              ].filter(Boolean);

              let selectedPython = isWin ? "python" : "python3";
              for (const c of pythonCandidates) {
                if (!c) continue;
                if (c.includes("/") || c.includes("\\") || c.includes(".exe")) {
                  if (await fs.stat(c).then(() => true).catch(() => false)) {
                    selectedPython = c;
                    break;
                  }
                } else {
                  selectedPython = c;
                  break;
                }
              }

              const srcPath = path.join(cliRoot, "src");

              // Cross-platform PATH: add OS-specific dirs without overriding existing PATH
              const extraPaths = isWin
                ? []
                : process.platform === "darwin"
                  ? ["/opt/homebrew/bin", "/opt/anaconda3/bin", "/usr/local/bin", "/usr/bin"]
                  : ["/usr/bin", "/usr/local/bin"];

              const envPath = [
                ...extraPaths,
                process.env.PATH || "",
              ].filter(Boolean).join(isWin ? ";" : ":");

              const pyPathSep = isWin ? ";" : ":";

              const pythonScript = `
import sys, json, os

sys.path.insert(0, ${JSON.stringify(srcPath)})

try:
    raw = sys.stdin.buffer.read()
    data = raw.decode("utf-8", errors="ignore").strip()
    m_type = sys.argv[1] if len(sys.argv) > 1 else "audio/webm"
    p_provider = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "" else None
    from rays_core.voice_transcriber import transcribe_audio_base64
    res = transcribe_audio_base64(data, m_type, provider=p_provider)
except Exception as e:
    import traceback
    res = {"success": False, "transcript": "", "error": str(e), "traceback": traceback.format_exc()}

print("JSON_START" + json.dumps(res) + "JSON_END")
`;

              const proc = spawn(selectedPython, ["-c", pythonScript, mimeType || "audio/webm", provider || ""], {
                env: {
                  ...process.env,
                  PATH: envPath,
                  PYTHONPATH: `${srcPath}${pyPathSep}${process.env.PYTHONPATH || ""}`,
                  PYTHONUTF8: "1",
                },
                cwd: os.homedir(),
              });

              let output = "";
              proc.stdout.on("data", (d) => {
                output += d.toString("utf8");
              });
              proc.stderr.on("data", (d) => {
                console.warn("[Vite STT]", d.toString("utf8").trim());
              });

              let closed = false;
              // 20s timeout — allows slower machines and local faster-whisper time to complete
              const timer = setTimeout(() => {
                if (!closed) {
                  closed = true;
                  try { proc.kill(); } catch {} // cross-platform kill (no SIGKILL)
                  if (!res.writableEnded) {
                    res.setHeader("content-type", "application/json");
                    res.end(JSON.stringify({ success: false, transcript: "", error: "Transcription timeout (20s). Ensure ffmpeg is installed and in PATH." }));
                  }
                }
              }, 20000);

              proc.stdin.on("error", () => {});
              proc.on("error", (err) => {
                if (closed) return;
                closed = true;
                clearTimeout(timer);
                if (!res.writableEnded) {
                  res.setHeader("content-type", "application/json");
                  res.end(JSON.stringify({ success: false, transcript: "", error: `Failed to start Python: ${String(err)}` }));
                }
              });

              proc.on("close", () => {
                if (closed) return;
                closed = true;
                clearTimeout(timer);
                const match = output.match(/JSON_START([\s\S]*?)JSON_END/);
                res.setHeader("content-type", "application/json");
                if (match) {
                  try {
                    res.end(match[1]);
                    return;
                  } catch {
                    // fall through
                  }
                }
                res.end(JSON.stringify({ success: false, transcript: "", error: output || "Transcription failed" }));
              });

              try {
                proc.stdin.write(audioBase64 || "");
                proc.stdin.end();
              } catch {
                // ignore EPIPE
              }
            } catch (err: any) {
              if (!res.writableEnded) {
                res.statusCode = 500;
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ success: false, transcript: "", error: err.message }));
              }
            }
          });
        });

        // ── TTS endpoint: POST /api/voice/tts ────────────────────────────────
        // Body: { text, provider?, voice?, speed? }
        // Returns: { success, audioBase64, mimeType, provider, error }
        server.middlewares.use("/api/voice/tts", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { text, provider, voice, speed } = JSON.parse(body || "{}");
              if (!text || !text.trim()) {
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ success: false, audioBase64: "", error: "No text provided" }));
                return;
              }

              const isWin = process.platform === "win32";
              const srcPath = path.join(cliRoot, "src");
              const pyPathSep = isWin ? ";" : ":";
              const extraPaths = isWin
                ? []
                : process.platform === "darwin"
                  ? ["/opt/homebrew/bin", "/opt/anaconda3/bin", "/usr/local/bin", "/usr/bin"]
                  : ["/usr/bin", "/usr/local/bin"];
              const envPath = [...extraPaths, process.env.PATH || ""].filter(Boolean).join(isWin ? ";" : ":");

              // Python resolver — venv first (has edge-tts, rays_core, etc.)
              const repoVenvPyTts = path.join(cliRoot, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
              let selectedPython = isWin ? "python" : "python3";
              for (const c of [repoVenvPyTts, process.env.PYTHON || "", process.env.PYTHON3 || "", ...(isWin ? ["python"] : ["python3", "python"])].filter(Boolean)) {
                if (c.includes("/") || c.includes("\\") || c.includes(".exe")) {
                  if (await fs.stat(c).then(() => true).catch(() => false)) { selectedPython = c; break; }
                } else { selectedPython = c; break; }
              }

              const ttsScript = `
import sys, json
sys.path.insert(0, ${JSON.stringify(srcPath)})
try:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="ignore").strip()
    params = json.loads(raw) if raw else {}
    from rays_core.voice_tts import synthesize_speech
    res = synthesize_speech(
        params.get("text", ""),
        provider=params.get("provider"),
        voice=params.get("voice"),
        speed=float(params.get("speed", 1.0)),
    )
except Exception as e:
    import traceback
    res = {"success": False, "audioBase64": "", "mimeType": "audio/mpeg", "provider": "", "error": str(e), "traceback": traceback.format_exc()}
print("JSON_START" + json.dumps(res) + "JSON_END")
`;

              const proc = spawn(selectedPython, ["-c", ttsScript], {
                env: { ...process.env, PATH: envPath, PYTHONPATH: `${srcPath}${pyPathSep}${process.env.PYTHONPATH || ""}`, PYTHONUTF8: "1" },
                cwd: os.homedir(),
              });

              let output = "";
              proc.stdout.on("data", (d) => { output += d.toString("utf8"); });
              proc.stderr.on("data", (d) => { console.warn("[Vite TTS]", d.toString("utf8").trim()); });

              let closed = false;
              const timer = setTimeout(() => {
                if (!closed) {
                  closed = true;
                  try { proc.kill(); } catch {}
                  if (!res.writableEnded) {
                    res.setHeader("content-type", "application/json");
                    res.end(JSON.stringify({ success: false, audioBase64: "", error: "TTS timeout (30s)" }));
                  }
                }
              }, 30000);

              proc.stdin.on("error", () => {});
              proc.on("error", (err) => {
                if (closed) return; closed = true; clearTimeout(timer);
                if (!res.writableEnded) {
                  res.setHeader("content-type", "application/json");
                  res.end(JSON.stringify({ success: false, audioBase64: "", error: `Python error: ${String(err)}` }));
                }
              });
              proc.on("close", () => {
                if (closed) return; closed = true; clearTimeout(timer);
                const match = output.match(/JSON_START([\s\S]*?)JSON_END/);
                res.setHeader("content-type", "application/json");
                if (match) { try { res.end(match[1]); return; } catch {} }
                res.end(JSON.stringify({ success: false, audioBase64: "", error: output || "TTS failed" }));
              });

              try {
                proc.stdin.write(JSON.stringify({ text, provider, voice, speed }));
                proc.stdin.end();
              } catch { /* ignore EPIPE */ }
            } catch (err: any) {
              if (!res.writableEnded) {
                res.statusCode = 500;
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ success: false, audioBase64: "", error: err.message }));
              }
            }
          });
        });

        // ── Voice list endpoint: GET /api/voice/voices ───────────────────────
        // Returns list of available Edge TTS voices
        server.middlewares.use("/api/voice/voices", (req, res) => {
          if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
          const isWin = process.platform === "win32";
          const srcPath = path.join(cliRoot, "src");
          const pyPathSep = isWin ? ";" : ":";
          const extraPaths = isWin ? [] : process.platform === "darwin"
            ? ["/opt/homebrew/bin", "/usr/local/bin"] : ["/usr/bin", "/usr/local/bin"];
          const envPath = [...extraPaths, process.env.PATH || ""].filter(Boolean).join(isWin ? ";" : ":");
          // Use repo .venv python first — has edge-tts installed
          const repoVenvPyVoices = path.join(cliRoot, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
          const { existsSync: _existsSync } = require("node:fs");
          const selectedPython = _existsSync(repoVenvPyVoices) ? repoVenvPyVoices : (isWin ? "python" : "python3");

          const voiceScript = `
import sys, json
sys.path.insert(0, ${JSON.stringify(srcPath)})
try:
    from rays_core.voice_tts import list_edge_voices
    res = list_edge_voices()
except Exception as e:
    res = {"success": False, "voices": [], "error": str(e)}
print("JSON_START" + json.dumps(res) + "JSON_END")
`;
          let output = "";
          const proc = spawn(selectedPython, ["-c", voiceScript], {
            env: { ...process.env, PATH: envPath, PYTHONPATH: `${srcPath}${pyPathSep}${process.env.PYTHONPATH || ""}`, PYTHONUTF8: "1" },
          });
          proc.stdout.on("data", (d) => { output += d.toString("utf8"); });
          proc.stderr.on("data", (d) => { console.warn("[Vite Voices]", d.toString("utf8").trim()); });
          proc.on("close", () => {
            const match = output.match(/JSON_START([\s\S]*?)JSON_END/);
            res.setHeader("content-type", "application/json");
            res.end(match ? match[1] : JSON.stringify({ success: false, voices: [], error: "Failed" }));
          });
          proc.on("error", () => {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ success: false, voices: [], error: "Python not found" }));
          });
        });
      },

    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
