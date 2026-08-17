import os
import json
import yaml
import subprocess
import time
import threading
import select
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .ai_client import AIClient
from .subagent_engine import SubagentEngine
from .execution_context import (
    format_prior_executions,
    format_session_actions,
    has_tool_actions,
)
from . import rays_ui
from . import web_tools
from .workspace_paths import resolve_workspace_path

# Global process tracking for background services & commands
_GLOBAL_PROCESSES: Dict[str, Dict[str, Any]] = {}
_GLOBAL_PROC_LOCK = threading.Lock()

class SkillsOrchestrator:
    def __init__(self, ai_client: AIClient, config: Dict[str, Any], codebase_root: Path):
        self.ai_client = ai_client
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.local_skills_dir = self.codebase_root / "skills"
        self.global_skills_dir = Path.home() / ".rays" / "skills"
        self.prompts = config.get('skills_orchestrator_prompts', {})
        self.subagent_engine = SubagentEngine(self.ai_client, self.config, self.codebase_root, self)

    def discover_skills(self) -> List[Dict[str, str]]:
        """Scan both local and global skills directories."""
        # ── Copy bundled skills to global ~/.rays/skills on startup ──
        try:
            import shutil
            import rays_core
            bundled_skills = Path(rays_core.__file__).parent / "skills"

            if bundled_skills.exists() and bundled_skills.resolve() != self.global_skills_dir.resolve():
                self.global_skills_dir.mkdir(parents=True, exist_ok=True)
                for item in bundled_skills.iterdir():
                    if item.is_dir() and item.name != "__pycache__":
                        dest_dir = self.global_skills_dir / item.name
                        if not dest_dir.exists():
                            shutil.copytree(item, dest_dir)
        except Exception as e:
            rays_ui.print_warning(f"Failed to auto-copy local skills to global directory: {e}")

        skills = []
        seen_names = set()

        for skills_dir in [self.local_skills_dir, self.global_skills_dir]:
            if not skills_dir.exists():
                continue

            for skill_path in skills_dir.iterdir():
                if skill_path.is_dir():
                    skill_name = skill_path.name
                    if skill_name in seen_names:
                        continue
                        
                    skill_md = skill_path / "SKILL.md"
                    if skill_md.exists():
                        try:
                            content = skill_md.read_text()
                            # Simple frontmatter extraction
                            if content.startswith('---'):
                                parts = content.split('---', 2)
                                if len(parts) >= 3:
                                    frontmatter = yaml.safe_load(parts[1])
                                    skills.append({
                                        "name": frontmatter.get("name", skill_name),
                                        "description": frontmatter.get("description", ""),
                                        "path": skill_md.as_posix(),
                                        "root": skill_path.as_posix(),
                                    })
                            else:
                                skills.append({
                                    "name": skill_name,
                                    "description": content.split('\n')[0].strip('# '),
                                    "path": skill_md.as_posix(),
                                    "root": skill_path.as_posix(),
                                })
                            seen_names.add(skill_name)
                        except Exception as e:
                            rays_ui.print_warning(f"Failed to read skill at {skill_path}: {e}")
                            
            # Auto-register bundled MCP servers
            for skill_path in skills_dir.iterdir():
                if not skill_path.is_dir():
                    continue
                mcp_dir = skill_path / "mcp"
                mcp_index = mcp_dir / "src" / "index.mjs"
                if mcp_index.exists():
                    try:
                        # Ensure npm install is run
                        node_modules = mcp_dir / "node_modules"
                        if not node_modules.exists():
                            rays_ui.print_info(f"Installing dependencies for MCP server in {skill_path.name}...")
                            subprocess.run(["npm", "install"], cwd=str(mcp_dir), check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        
                        # Register in mcp.json
                        mcp_json_path = Path.home() / ".rays" / "mcp.json"
                        mcp_data = {"mcp_servers": []}
                        if mcp_json_path.exists():
                            try:
                                mcp_data = json.loads(mcp_json_path.read_text(encoding="utf-8"))
                            except:
                                pass
                        
                        if not isinstance(mcp_data, dict):
                            mcp_data = {"mcp_servers": []}
                        if "mcp_servers" not in mcp_data or not isinstance(mcp_data["mcp_servers"], list):
                            mcp_data["mcp_servers"] = []
                            
                        server_name = f"{skill_path.name}_mcp"
                        exists = any(s.get("name") == server_name for s in mcp_data["mcp_servers"])
                        if not exists:
                            mcp_data["mcp_servers"].append({
                                "name": server_name,
                                "command": "node",
                                "args": [str(mcp_index)]
                            })
                            mcp_json_path.write_text(json.dumps(mcp_data, indent=2))
                            rays_ui.print_info(f"Auto-registered MCP server for {skill_path.name}")
                    except Exception as e:
                        rays_ui.print_warning(f"Failed to auto-register MCP server for {skill_path.name}: {e}")

        return skills

    def run(self, user_prompt: str) -> Dict[str, Any]:
        """Main orchestration loop with re-planning support."""
        rays_ui.print_phase("Skills Orchestration")
        
        cumulative_history = []
        max_loops = 3
        
        for loop_idx in range(max_loops):
            if loop_idx > 0:
                rays_ui.print_sub_phase(f"Re-planning Loop {loop_idx + 1}")

            skills_list = self.discover_skills()
            
            # 1. Identify required skills
            required_skills_data = self._identify_required_skills(user_prompt, skills_list, cumulative_history)
            required_skills = required_skills_data.get('required_skills', [])
            reasoning = required_skills_data.get('reasoning', 'No reasoning provided.')
            
            if reasoning:
                rays_ui.print_info(f"AI Reasoning: {reasoning}")
            
            if required_skills:
                rays_ui.print_info(f"Required Skills: {', '.join(required_skills)}")
            elif loop_idx == 0:
                rays_ui.print_info("No skills identified for this task.")

            # 2. Generate execution plan
            plan_data = self._generate_plan(user_prompt, required_skills, cumulative_history)
            summary = plan_data.get('summary', 'No summary provided.')
            
            if loop_idx == 0:
                rays_ui.print_box("Orchestrator Summary", summary, rays_ui.C_LAVENDER)

            # Filter plan to only include existing skills
            discovered_map = {s['name']: s for s in skills_list}
            raw_plan = plan_data.get('plan', [])
            plan = [step for step in raw_plan if step.get('skill') in discovered_map]

            if not plan:
                if raw_plan:
                    rays_ui.print_warning("The orchestrator proposed skills that are not available.")
                if loop_idx == 0:
                    rays_ui.print_info("No valid skill execution steps found. Done.")
                    return {"status": "completed", "summary": summary, "history": cumulative_history}
                else:
                    break

            # 3. Execute skills sequentially
            for i, step in enumerate(plan):
                skill_name = step.get('skill')
                reason = step.get('reason')
                skill_info = discovered_map.get(skill_name)
                
                rays_ui.print_sub_phase(f"Step {i+1}/{len(plan)}: {skill_name}")
                rays_ui.print_info(f"Reason: {reason}")
                
                spawn_reason = step.get("spawn_reason") or reason or "Run skill"
                record = self._execute_skill(
                    skill_info, spawn_reason, user_prompt, plan, cumulative_history
                )
                cumulative_history.append(record)

            # 4. Final completion check
            completion_data = self._evaluate_completion(user_prompt, cumulative_history)
            if completion_data.get('is_complete', False):
                rays_ui.print_info("Task verified as complete.")
                break
            else:
                rays_ui.print_box("Validation Feedback", completion_data.get('reasoning', 'Task not fully completed.'), rays_ui.C_RED)
                rays_ui.print_info("Continuing to next orchestration loop...")

        return {
            "status": "completed",
            "history": cumulative_history,
            "summary": "Final orchestration cycle finished."
        }

    def get_active_processes_context(self) -> str:
        """Format all active background processes and their latest log output/errors for prompt context."""
        with _GLOBAL_PROC_LOCK:
            if not _GLOBAL_PROCESSES:
                return "(No background processes currently tracked.)"
            
            blocks = []
            for tid, entry in _GLOBAL_PROCESSES.items():
                p = entry["process"]
                cmd = entry["command"]
                log_file = entry["log_file"]
                elapsed = int(time.time() - entry["start_time"])
                elapsed_str = f"{elapsed}s" if elapsed < 60 else f"{elapsed//60}m {elapsed%60}s"
                poll = p.poll()
                status_str = f"RUNNING (active for {elapsed_str})" if poll is None else f"EXITED with code {poll}"
                
                tail_lines = []
                try:
                    if Path(log_file).exists():
                        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                            all_l = f.readlines()
                            tail_lines = all_l[-100:] if len(all_l) > 100 else all_l
                except Exception as e:
                    tail_lines = [f"Could not read log file: {e}\n"]
                    
                log_preview = "".join(tail_lines).strip()
                blocks.append(
                    f"- Task ID: `{tid}` (PID: {entry['pid']})\n"
                    f"  Command: `{cmd}`\n"
                    f"  Status: {status_str}\n"
                    f"  Log File: `{log_file}`\n"
                    f"  Latest Terminal Output & Errors (last {len(tail_lines)} lines):\n"
                    f"  ```\n{log_preview}\n  ```"
                )
            return "\n\n".join(blocks)

    def _identify_required_skills(self, user_prompt: str, skills_list: List[Dict[str, str]], history: List[Dict[str, Any]]) -> Dict[str, Any]:
        prompt = self.prompts["select_required_skills"].format(
            user_prompt=user_prompt,
            skills_list=json.dumps(skills_list, indent=2),
            execution_history=format_prior_executions(history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)

    def _generate_plan(self, user_prompt: str, required_skills: List[str], history: List[Dict[str, Any]]) -> Dict[str, Any]:
        prompt = self.prompts["generate_execution_plan"].format(
            user_prompt=user_prompt,
            required_skills=json.dumps(required_skills),
            execution_history=format_prior_executions(history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)

    def _execute_skill(
        self,
        skill_info: Dict[str, Any],
        reason: str,
        user_prompt: str,
        plan: List[Dict[str, Any]],
        previous_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        skill_name = skill_info["name"]
        skill_root = skill_info["root"]
        skill_md_path = Path(skill_info["path"])

        if not skill_md_path.exists():
            return {
                "type": "skill",
                "skill": skill_name,
                "spawn_reason": reason,
                "status": "error",
                "exit_message": f"Skill definition for '{skill_name}' not found.",
                "actions": [],
            }

        skill_md_content = skill_md_path.read_text()
        prior_transcript = format_prior_executions(previous_results, user_prompt)
        session_actions: List[Dict[str, Any]] = []
        max_steps = int(self.config.get("skill_subagent_max_turns", 30))

        for turn in range(1, max_steps + 1):
            rays_ui.hud_set_status("Thinking", f"skill/{skill_name} · turn {turn}")

            active_proc_ctx = self.get_active_processes_context()
            prompt = self.prompts["execute_skill_step"].format(
                user_prompt=user_prompt,
                overall_plan=json.dumps(plan, indent=2),
                skill_name=skill_name,
                skill_root=skill_root,
                workspace_root=self.codebase_root.as_posix(),
                spawn_reason=reason,
                skill_md=skill_md_content,
                prior_executions=prior_transcript,
                active_processes=active_proc_ctx,
                session_actions=format_session_actions(session_actions),
                turn_number=turn,
            )

            try:
                response = self.ai_client.generate_json(prompt)
            except ValueError as e:
                rays_ui.print_error(f"JSON parsing error: {e}")
                session_actions.append({
                    "turn": turn,
                    "thought": f"Error: Failed to parse JSON response. The model may have reached its output length limit or produced invalid output.",
                    "status": "error",
                    "exit_message": str(e)
                })
                break
                
            thought = response.get("thought", "")
            status = (response.get("status") or "running").lower()
            tool_call = response.get("tool_call")

            if thought:
                rays_ui.print_mcp_thought(thought)

            if tool_call:
                result = self._dispatch_tool(tool_call)
                session_actions.append(
                    {
                        "turn": turn,
                        "thought": thought,
                        "tool": tool_call.get("name"),
                        "arguments": tool_call.get("arguments"),
                        "result": result,
                    }
                )
                if rays_ui.orchestration_hud_active():
                    rays_ui.orch_emit_tool_result(
                        tool_call.get("name", "?"),
                        tool_call.get("arguments"),
                        result,
                    )

            if status == "completed":
                if not has_tool_actions(session_actions):
                    session_actions.append(
                        {
                            "turn": turn,
                            "thought": thought,
                            "tool": None,
                            "arguments": None,
                            "result": (
                                "REJECTED completion: you must call at least one tool "
                                "(run_shell_command, write_file, etc.) before status "
                                "completed. Prior MCP runs cannot do docx/pptx — use "
                                "this skill's tools per SKILL.md. 'bash tool' means "
                                "run_shell_command."
                            ),
                        }
                    )
                    continue
                return {
                    "type": "skill",
                    "skill": skill_name,
                    "spawn_reason": reason,
                    "status": "completed",
                    "exit_message": response.get("exit_message", ""),
                    "actions": session_actions,
                }

            if not tool_call:
                session_actions.append(
                    {
                        "turn": turn,
                        "thought": thought,
                        "tool": None,
                        "arguments": None,
                        "result": "No tool_call provided; call a tool or set status completed.",
                    }
                )

        return {
            "type": "skill",
            "skill": skill_name,
            "spawn_reason": reason,
            "status": "max_turns",
            "exit_message": f"Stopped after {max_steps} turns without completion.",
            "actions": session_actions,
        }

    def _dispatch_tool(self, tool_call: Dict[str, Any]) -> str:
        name = tool_call.get('name')
        args = tool_call.get('arguments', {})
        
        if not name:
            return "Error: Tool call missing 'name'."
            
        if name == 'run_shell_command':
            is_bg = bool(args.get('is_background', args.get('background', False)))
            timeout = int(args.get('timeout', 30))
            return self._run_shell_command(args.get('command'), is_background=is_bg, timeout=timeout)
        elif name == 'check_process':
            return self._check_process(
                task_id=args.get('task_id'),
                pid=args.get('pid'),
                lines=int(args.get('lines', 50))
            )
        elif name == 'wait_process':
            return self._wait_process(
                task_id=args.get('task_id'),
                pid=args.get('pid'),
                timeout=int(args.get('timeout', 60))
            )
        elif name in ('sleep', 'wait'):
            return self._sleep(seconds=int(args.get('seconds', 5)))
        elif name == 'kill_process':
            return self._kill_process(task_id=args.get('task_id'), pid=args.get('pid'))
        elif name == 'list_processes':
            return self._list_processes()
        elif name == 'report_progress':
            return self._report_progress(args.get('message', ''))
        elif name in ('delegate_subagent', 'delegate_task', 'invoke_subagent'):
            goal = args.get('goal') or args.get('prompt')
            role = args.get('role')
            context = args.get('context')
            tasks = args.get('tasks')
            chain = args.get('chain')
            parallel = bool(args.get('parallel', True))
            res = self.subagent_engine.execute_delegation(
                goal=goal, role=role, context=context, tasks=tasks, chain=chain, parallel=parallel
            )
            return res.get('consolidated_summary') or json.dumps(res, indent=2)
        elif name in ('web_search', 'search_web'):
            query = args.get('query') or args.get('search_query') or args.get('q') or ''
            limit = int(args.get('limit', 5))
            return web_tools.web_search(query=query, limit=limit)
        elif name in ('web_fetch', 'fetch_url', 'web_extract'):
            url = args.get('url') or args.get('link') or args.get('href') or ''
            max_chars = int(args.get('max_chars', args.get('limit', 12000)))
            return web_tools.web_fetch(url=url, max_chars=max_chars)
        elif name == 'write_file':
            return self._write_file(args.get('path'), args.get('content'))
        elif name == 'patch_file':
            return self._patch_file(args.get('path'), args.get('search'), args.get('replace'))
        elif name == 'read_file':
            return self._read_file(
                path=args.get('path'),
                start_line=args.get('start_line'),
                end_line=args.get('end_line')
            )
        elif name == 'list_directory':
            return self._list_directory(args.get('path', '.'))
        else:
            return (
                f"Error: Tool '{name}' is not recognized. "
                "Available tools: web_search, web_fetch, delegate_subagent, run_shell_command, check_process, wait_process, sleep, "
                "kill_process, list_processes, report_progress, write_file, patch_file, read_file, list_directory."
            )

    def _is_daemon_command(self, cmd_str: str) -> bool:
        """Check if command is a long-running server / watcher daemon."""
        cmd_lower = cmd_str.lower().strip()
        daemon_patterns = [
            'npm run dev', 'npm start', 'yarn dev', 'yarn start', 'pnpm dev', 'pnpm start',
            'bun dev', 'bun run dev', 'vite', 'next dev', 'next start',
            'python -m http.server', 'python3 -m http.server', 'http-server', 'live-server',
            'flask run', 'uvicorn', 'gunicorn', 'fastapi dev',
            'cargo watch', 'nodemon', 'webpack serve', 'ng serve', 'watch '
        ]
        return any(pattern in cmd_lower for pattern in daemon_patterns)

    def _run_shell_command(self, command: str, is_background: bool = False, timeout: int = 30) -> str:
        if not command:
            return "Error: 'command' argument is required for run_shell_command"
        
        # Auto-detect daemon / dev-server commands
        if is_background or self._is_daemon_command(command):
            return self._start_background_process(command)

        rays_ui.print_step(f"Executing: {command}")
        try:
            log_dir = Path(os.path.expanduser(self.config.get("rays_dir", "~/.rays"))) / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / f"cmd_{int(time.time())}.log"

            with open(log_file, "w") as outfile:
                process = subprocess.Popen(
                    command,
                    shell=True,
                    cwd=self.codebase_root,
                    stdin=subprocess.DEVNULL,
                    stdout=outfile,
                    stderr=subprocess.STDOUT,
                    text=True
                )

                start_time = time.time()
                while process.poll() is None:
                    if time.time() - start_time > timeout:
                        # Exceeded timeout: Auto-detach to background!
                        rays_ui.print_warning(f"Command exceeded {timeout}s — detaching to background")
                        tid = f"bg_{int(time.time() * 1000) % 100000}"
                        rays_ui.bg_task_start(tid, f"{command[:30]}...")

                        with _GLOBAL_PROC_LOCK:
                            _GLOBAL_PROCESSES[tid] = {
                                "process": process,
                                "pid": process.pid,
                                "command": command,
                                "log_file": log_file,
                                "start_time": start_time,
                                "outfile": outfile,
                            }

                        def _monitor(p, task_id, fname):
                            p.wait()
                            rays_ui.bg_task_done(task_id)

                        threading.Thread(target=_monitor, args=(process, tid, log_file), daemon=True).start()
                        with open(log_file, "r") as rf:
                            early_output = rf.read()[-2000:]
                        return (
                            f"Command is running in background (task_id: '{tid}', PID: {process.pid}, timeout of {timeout}s reached).\n"
                            f"Logs streaming to: {log_file}\n"
                            f"Initial output:\n{early_output}\n\n"
                            f"Tip: Use check_process(task_id='{tid}') or wait_process(task_id='{tid}') to inspect output."
                        )
                    time.sleep(0.1)

            with open(log_file, "r") as rf:
                output = rf.read()
            return output if output else "Command executed successfully with no output."

        except Exception as e:
            return f"Error executing command: {e}"

    def _start_background_process(self, command: str) -> str:
        """Start a persistent background daemon process that stays alive."""
        rays_ui.print_step(f"Starting background service: {command}")
        try:
            log_dir = Path(os.path.expanduser(self.config.get("rays_dir", "~/.rays"))) / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / f"bg_{int(time.time())}.log"

            outfile = open(log_file, "w")
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=self.codebase_root,
                stdin=subprocess.DEVNULL,
                stdout=outfile,
                stderr=subprocess.STDOUT,
                start_new_session=True
            )

            # Let it spin up and capture startup logs
            time.sleep(2.0)

            if process.poll() is not None:
                outfile.close()
                with open(log_file, "r") as rf:
                    early_output = rf.read()
                return f"Background process exited immediately with code {process.returncode}:\n{early_output}"

            tid = f"bg_{int(time.time() * 1000) % 100000}"
            rays_ui.bg_task_start(tid, f"{command[:30]}...")

            with _GLOBAL_PROC_LOCK:
                _GLOBAL_PROCESSES[tid] = {
                    "process": process,
                    "pid": process.pid,
                    "command": command,
                    "log_file": log_file,
                    "start_time": time.time(),
                    "outfile": outfile,
                }

            def _monitor_bg(p, task_id, f):
                p.wait()
                try:
                    f.close()
                except Exception:
                    pass
                rays_ui.bg_task_done(task_id)

            threading.Thread(target=_monitor_bg, args=(process, tid, outfile), daemon=True).start()

            with open(log_file, "r") as rf:
                early_output = rf.read()

            msg = (
                f"Background service started successfully (task_id: '{tid}', PID: {process.pid}).\n"
                f"Command: {command}\n"
                f"Logs streaming to: {log_file}\n"
                f"Initial output:\n{early_output}\n\n"
                f"Note: This process is running in the background. "
                f"You can use check_process(task_id='{tid}') to view new output, "
                f"wait_process(task_id='{tid}') to wait for completion, "
                f"or continue with other tools."
            )
            return msg

        except Exception as e:
            return f"Error starting background service: {e}"

    def _find_process_entry(self, task_id: Optional[str] = None, pid: Optional[int] = None) -> Optional[Tuple[str, Dict[str, Any]]]:
        with _GLOBAL_PROC_LOCK:
            if task_id and task_id in _GLOBAL_PROCESSES:
                return task_id, _GLOBAL_PROCESSES[task_id]
            if pid:
                for tid, entry in _GLOBAL_PROCESSES.items():
                    if entry.get("pid") == int(pid):
                        return tid, entry
            # If only 1 process is tracked, default to it
            if len(_GLOBAL_PROCESSES) == 1:
                tid = next(iter(_GLOBAL_PROCESSES))
                return tid, _GLOBAL_PROCESSES[tid]
        return None

    def _check_process(self, task_id: Optional[str] = None, pid: Optional[int] = None, lines: int = 100) -> str:
        """Inspect the live stdout/stderr of a running or completed background process."""
        entry_tuple = self._find_process_entry(task_id, pid)
        if not entry_tuple:
            return self._list_processes()

        tid, entry = entry_tuple
        process = entry["process"]
        log_file = entry["log_file"]
        cmd = entry["command"]
        elapsed = int(time.time() - entry["start_time"])

        poll_status = process.poll()
        status_str = f"RUNNING (active for {elapsed}s)" if poll_status is None else f"EXITED with code {poll_status}"

        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                all_lines = f.readlines()
                tail_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
                output = "".join(tail_lines)
        except Exception as e:
            output = f"Could not read log file: {e}"

        return (
            f"Process '{tid}' (PID: {entry['pid']})\n"
            f"Command: {cmd}\n"
            f"Status: {status_str}\n"
            f"Output (last {len(tail_lines)} lines):\n"
            f"----------------------------------------\n"
            f"{output}\n"
            f"----------------------------------------"
        )

    def _wait_process(self, task_id: Optional[str] = None, pid: Optional[int] = None, timeout: int = 60) -> str:
        """Wait up to timeout seconds for a background process to finish."""
        entry_tuple = self._find_process_entry(task_id, pid)
        if not entry_tuple:
            return f"Error: No tracked process found for task_id={task_id} / pid={pid}."

        tid, entry = entry_tuple
        process = entry["process"]
        log_file = entry["log_file"]
        cmd = entry["command"]

        start = time.time()
        while process.poll() is None:
            if time.time() - start >= timeout:
                break
            time.sleep(0.5)

        poll_status = process.poll()
        elapsed = int(time.time() - start)

        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                output = f.read()[-10000:]
        except Exception:
            output = "(No output logged)"

        if poll_status is not None:
            return (
                f"Process '{tid}' (PID: {entry['pid']}) COMPLETED with exit code {poll_status} after {elapsed}s.\n"
                f"Command: {cmd}\n"
                f"Output:\n{output}"
            )
        else:
            return (
                f"Process '{tid}' (PID: {entry['pid']}) is STILL RUNNING after waiting {timeout}s.\n"
                f"Command: {cmd}\n"
                f"Recent output:\n{output}\n\n"
                f"You can wait further, check logs later, or proceed with other tasks."
            )

    def _sleep(self, seconds: int = 5) -> str:
        """Pause execution for N seconds to allow background jobs to progress."""
        sec = max(1, min(300, int(seconds)))
        rays_ui.print_step(f"Waiting for {sec}s...")
        time.sleep(sec)
        return f"Waited for {sec}s. Background jobs have progressed. You can check their outputs or continue."

    def _kill_process(self, task_id: Optional[str] = None, pid: Optional[int] = None) -> str:
        """Terminate a background task."""
        entry_tuple = self._find_process_entry(task_id, pid)
        if not entry_tuple:
            return f"Error: No active process found for task_id={task_id} / pid={pid}."

        tid, entry = entry_tuple
        process = entry["process"]
        try:
            process.terminate()
            time.sleep(0.5)
            if process.poll() is None:
                process.kill()
            rays_ui.bg_task_done(tid)
            with _GLOBAL_PROC_LOCK:
                _GLOBAL_PROCESSES.pop(tid, None)
            return f"Process '{tid}' (PID: {entry['pid']}) has been terminated."
        except Exception as e:
            return f"Error killing process: {e}"

    def _list_processes(self) -> str:
        """List all active background processes."""
        with _GLOBAL_PROC_LOCK:
            if not _GLOBAL_PROCESSES:
                return "No active background processes are currently running."
            lines = ["Tracked Background Processes:"]
            for tid, entry in _GLOBAL_PROCESSES.items():
                p = entry["process"]
                status = "RUNNING" if p.poll() is None else f"EXITED ({p.returncode})"
                elapsed = int(time.time() - entry["start_time"])
                lines.append(f"  • [{tid}] PID {entry['pid']} | {status} | {elapsed}s | {entry['command'][:50]}")
            return "\n".join(lines)

    def _report_progress(self, message: str) -> str:
        """Report an intermediate progress update/milestone to the user."""
        rays_ui.orch_emit_progress(message)
        return f"Progress update displayed to user: \"{message}\". You may now continue with your next actions."

    def _resolve_path(self, path: str) -> Path:
        return resolve_workspace_path(self.codebase_root, path)

    def _write_file(self, path: str, content: str) -> str:
        if not path:
            return "Error: 'path' argument is required for write_file"
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            old_content = full_path.read_text(encoding="utf-8", errors="replace") if full_path.exists() else None
            full_path.write_text(content or "", encoding="utf-8")
            if old_content is not None and old_content.strip() != (content or "").strip():
                rays_ui.print_diff(path, old_content, content or "")
            else:
                rays_ui.print_file_created(path, content or "")
            return f"File written successfully: {path}"
        except Exception as e:
            return f"Error writing file: {e}"

    def _patch_file(self, path: str, search: str, replace: str) -> str:
        if not path:
            return "Error: 'path' argument is required for patch_file"
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            if not full_path.exists():
                return f"Error: File does not exist: {path}"
            content = full_path.read_text(encoding="utf-8", errors="replace")
            if not search:
                return "Error: 'search' block is required for patch_file"
            if search not in content:
                return f"Error: Search block not found in {path}"
            
            new_content = content.replace(search, replace or "", 1)
            full_path.write_text(new_content, encoding="utf-8")
            rays_ui.print_diff(path, content, new_content)
            return f"File patched successfully: {path}"
        except Exception as e:
            return f"Error patching file: {e}"

    def _read_file(self, path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> str:
        if not path:
            return "Error: 'path' argument is required for read_file"
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            if not full_path.exists():
                return f"Error: File does not exist: {path}"
            content = full_path.read_text(encoding="utf-8", errors="replace")
            lines = content.splitlines()
            if start_line is not None or end_line is not None:
                s = max(1, int(start_line or 1))
                e = min(len(lines), int(end_line or len(lines)))
                selected_lines = lines[s - 1:e]
                numbered = [f"{s + i:>5} | {l}" for i, l in enumerate(selected_lines)]
                return "\n".join(numbered)
            return content
        except Exception as e:
            return f"Error reading file: {e}"

    def _list_directory(self, path: str) -> str:
        path = path or "."
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            if not full_path.exists():
                return f"Error: Directory does not exist: {path}"
            files = os.listdir(full_path)
            return "\n".join(files)
        except Exception as e:
            return f"Error listing directory: {e}"

    def _evaluate_completion(self, user_prompt: str, execution_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        from .execution_context import programmatic_completion_failures

        hard_failures = programmatic_completion_failures(user_prompt, execution_history)
        if hard_failures:
            return {
                "is_complete": False,
                "reasoning": "Programmatic validation failed:\n- "
                + "\n- ".join(hard_failures),
            }
        prompt = self.prompts["check_completion"].format(
            user_prompt=user_prompt,
            execution_history=format_prior_executions(execution_history, user_prompt),
        )
        return self.ai_client.generate_json(prompt)
