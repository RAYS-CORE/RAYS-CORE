"""Terminal session detection and process introspection across tmux, kitty, iTerm2, and Terminal."""
import json
import logging
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class TerminalSession:
    """Represents a discovered interactive terminal session or pane."""
    session_id: str                   # e.g., "tmux:main:0.1" or "kitty:win_2"
    backend: str                      # "tmux" | "kitty" | "iterm" | "terminal" | "pty"
    target_handle: str                # tmux pane id (e.g., "%3"), kitty id ("2"), etc.
    session_name: str                 # human friendly session name
    window_name: str                  # window/tab title
    pane_id: str                      # pane/window identifier
    cwd: str                          # current working directory
    pid: int                          # foreground or pane PID
    foreground_cmd: str               # e.g., "claude", "python3", "node", "zsh"
    agent_name: str                   # e.g., "Claude Code", "Gemini CLI", "Aider", "Shell"
    is_agent_running: bool            # True if an active agent/REPL process is running
    status: str = "idle"              # "idle" | "running" | "prompt_ready" | "shell"
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def display_label(self) -> str:
        short_cwd = self.cwd
        home = str(Path.home())
        if short_cwd.startswith(home):
            short_cwd = "~" + short_cwd[len(home):]
        if len(short_cwd) > 28:
            short_cwd = "…" + short_cwd[-27:]
        status_tag = "ready" if self.is_agent_running else "shell"
        return f"{self.session_id} · {self.agent_name} · {short_cwd} · ({status_tag})"


class SessionDetector:
    """Discovers and inspects active terminal sessions across multiplexers."""

    KNOWN_AGENT_SIGNATURES = [
        (re.compile(r"claude", re.I), "Claude Code"),
        (re.compile(r"gemini", re.I), "Gemini CLI"),
        (re.compile(r"aider", re.I), "Aider"),
        (re.compile(r"hermes", re.I), "Hermes Agent"),
        (re.compile(r"opencode", re.I), "OpenCode"),
        (re.compile(r"cursor", re.I), "Cursor Agent"),
        (re.compile(r"rays", re.I), "RAYS Agent"),
        (re.compile(r"codex", re.I), "Codex CLI"),
        (re.compile(r"ipython|python.*-m", re.I), "Python REPL"),
        (re.compile(r"node.*agent|bun.*agent", re.I), "Node Agent"),
    ]

    PROMPT_REGEXES = [
        re.compile(r"[❯>▶]\s*$"),
        re.compile(r"(\?|>>>|\.\.\.)\s*$"),
        re.compile(r"\[.*@.*\][#$]\s*$"),
        re.compile(r"\(agent\)\s*>\s*$"),
        re.compile(r"msg=interrupt", re.I),
        re.compile(r"ctrl\+c to cancel", re.I),
    ]

    def __init__(self):
        self.tmux_bin = shutil.which("tmux")
        self.kitty_bin = shutil.which("kitty")
        self.osascript_bin = shutil.which("osascript")

    def detect_all_sessions(self) -> List[TerminalSession]:
        """Detect all available interactive terminal sessions."""
        sessions: List[TerminalSession] = []

        # 1. Check tmux
        if self.tmux_bin:
            try:
                tmux_sessions = self._detect_tmux_sessions()
                sessions.extend(tmux_sessions)
            except Exception as e:
                logger.debug(f"tmux detection failed: {e}")

        # 2. Check Kitty
        if self.kitty_bin and os.environ.get("KITTY_PID"):
            try:
                kitty_sessions = self._detect_kitty_sessions()
                sessions.extend(kitty_sessions)
            except Exception as e:
                logger.debug(f"Kitty detection failed: {e}")

        # 3. Check macOS iTerm2 / Terminal (if on Darwin and not already found via tmux)
        if os.name != "nt" and self.osascript_bin and not sessions:
            try:
                mac_sessions = self._detect_macos_terminal_sessions()
                sessions.extend(mac_sessions)
            except Exception as e:
                logger.debug(f"macOS terminal detection failed: {e}")

        return sessions

    def _detect_tmux_sessions(self) -> List[TerminalSession]:
        """Query tmux server for all sessions, windows, and panes."""
        cmd = [
            self.tmux_bin, "list-panes", "-a", "-F",
            "#{session_name}|#{window_index}|#{pane_index}|#{pane_id}|#{pane_pid}|#{pane_current_path}|#{pane_current_command}|#{pane_title}"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.5)
        if res.returncode != 0:
            return []

        results: List[TerminalSession] = []
        for line in res.stdout.strip().splitlines():
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) < 8:
                continue
            sess_name, win_idx, pane_idx, pane_id, pane_pid_str, cwd, curr_cmd, title = parts[:8]
            try:
                pid = int(pane_pid_str)
            except ValueError:
                pid = 0

            # Inspect child process of pane PID
            fg_cmd, agent_name, is_agent = self._inspect_process_tree(pid, curr_cmd, title)

            session_id = f"tmux:{sess_name}:{win_idx}.{pane_idx}"
            results.append(
                TerminalSession(
                    session_id=session_id,
                    backend="tmux",
                    target_handle=pane_id,
                    session_name=sess_name,
                    window_name=f"Window {win_idx} ({title or curr_cmd})",
                    pane_id=pane_id,
                    cwd=cwd or os.getcwd(),
                    pid=pid,
                    foreground_cmd=fg_cmd or curr_cmd,
                    agent_name=agent_name,
                    is_agent_running=is_agent,
                    extra={"window_index": win_idx, "pane_index": pane_idx}
                )
            )
        return results

    def _get_process_table(self) -> Dict[int, Dict[str, Any]]:
        """Fast single-pass system process snapshot in memory."""
        table: Dict[int, Dict[str, Any]] = {}
        try:
            ps = subprocess.run(["ps", "-A", "-o", "pid,ppid,tty,comm,args"], capture_output=True, text=True, timeout=0.8)
            if res_lines := ps.stdout.splitlines()[1:]:
                for line in res_lines:
                    parts = line.strip().split(maxsplit=4)
                    if len(parts) >= 4:
                        pid = int(parts[0]) if parts[0].isdigit() else 0
                        ppid = int(parts[1]) if parts[1].isdigit() else 0
                        tty = parts[2].replace("/dev/", "")
                        comm = parts[3]
                        args = parts[4] if len(parts) > 4 else comm
                        table[pid] = {"pid": pid, "ppid": ppid, "tty": tty, "comm": comm, "args": args}
        except Exception:
            pass
        return table

    def _detect_kitty_sessions(self) -> List[TerminalSession]:
        """Discover Kitty terminal instances via fast process table snapshot."""
        results: List[TerminalSession] = []
        table = self._get_process_table()

        for pid, info in table.items():
            args = info["args"]
            if "kitten run-shell" in args or ("kitty" in args.lower() and "login" in args):
                tty_name = info["tty"]
                if tty_name in ("?", "not a tty", ""):
                    continue

                # Find child shell PID (e.g. zsh / gemini / python)
                child_pid = pid
                children = [p for p, c in table.items() if c["ppid"] == pid]
                if children:
                    child_pid = children[0]

                # Determine real-time active CWD of child process
                cwd = os.getcwd()
                try:
                    res_cwd = subprocess.run(["lsof", "-p", str(child_pid), "-a", "-d", "cwd", "-Fn"], capture_output=True, text=True, timeout=0.5)
                    for r in res_cwd.stdout.splitlines():
                        if r.startswith("n") and os.path.isdir(r[1:]):
                            cwd = r[1:]
                            break
                except Exception:
                    pass

                # Derive clean project name from CWD
                proj_name = os.path.basename(cwd.rstrip("/")) if cwd and cwd != os.path.expanduser("~") else "Home"
                child_info = table.get(child_pid, info)
                fg_cmd, agent_name, is_agent = self._inspect_process_tree(child_pid, child_info.get("comm", "zsh"), f"Kitty {tty_name}", proc_table=table)

                # Check for active agent conversation ID in child processes
                conv_id = None
                for c_pid, c_info in table.items():
                    if c_info["ppid"] == child_pid or c_pid == child_pid or c_info["tty"] == tty_name:
                        m_c = re.search(r"--conversation=([a-f0-9\-]+)", c_info["args"])
                        if m_c:
                            conv_id = m_c.group(1)
                            break

                # If no explicit --conversation in process args, resolve via brain directory for the workspace
                if not conv_id and cwd and cwd != os.path.expanduser("~"):
                    brain_dir = os.path.expanduser("~/.gemini/antigravity-cli/brain")
                    if os.path.isdir(brain_dir):
                        best_cid = None
                        best_mtime = 0
                        for cid in os.listdir(brain_dir):
                            cpath = os.path.join(brain_dir, cid)
                            log_f = os.path.join(cpath, ".system_generated", "logs", "transcript.jsonl")
                            if os.path.exists(log_f):
                                try:
                                    with open(log_f, "r", encoding="utf-8", errors="ignore") as f:
                                        first_lines = "".join([f.readline() for _ in range(25)])
                                        if os.path.basename(cwd) in first_lines:
                                            mtime = os.path.getmtime(log_f)
                                            if mtime > best_mtime:
                                                best_mtime = mtime
                                                best_cid = cid
                                except Exception:
                                    pass
                        if best_cid:
                            conv_id = best_cid

                gui_pid = info.get("ppid", pid)
                session_id = f"kitty:{tty_name}"
                results.append(
                    TerminalSession(
                        session_id=session_id,
                        backend="kitty",
                        target_handle=str(child_pid),
                        session_name=f"{proj_name}",
                        window_name=f"{proj_name} ({tty_name})",
                        pane_id=tty_name,
                        cwd=cwd,
                        pid=child_pid,
                        foreground_cmd=fg_cmd,
                        agent_name=agent_name,
                        is_agent_running=True,
                        status="ready",
                        extra={"tty": tty_name, "login_pid": pid, "gui_pid": gui_pid, "conv_id": conv_id}
                    )
                )

        return results

    def _detect_macos_terminal_sessions(self) -> List[TerminalSession]:
        """Inspect running Terminal / iTerm2 sessions on macOS."""
        if not self.osascript_bin:
            return []
        try:
            has_term = subprocess.run(["pgrep", "-x", "Terminal"], capture_output=True, timeout=0.4).returncode == 0
            if not has_term:
                return []

            script = '''
            tell application "Terminal"
                set res to ""
                repeat with w in windows
                    repeat with t in tabs of w
                        set res to res & (tty of t) & "|" & (custom title of t) & "\n"
                    end repeat
                end repeat
                return res
            end tell
            '''
            res = subprocess.run([self.osascript_bin, "-e", script], capture_output=True, text=True, timeout=0.8)
            if res.returncode != 0:
                return []
            results = []
            for idx, line in enumerate(res.stdout.strip().splitlines()):
                if not line.strip():
                    continue
                parts = line.split("|")
                tty = parts[0].strip()
                title = parts[1].strip() if len(parts) > 1 else "Terminal Tab"
                results.append(
                    TerminalSession(
                        session_id=f"terminal:tab_{idx+1}",
                        backend="terminal",
                        target_handle=tty or str(idx + 1),
                        session_name="Terminal",
                        window_name=title or f"Tab {idx+1}",
                        pane_id=tty or str(idx + 1),
                        cwd=os.getcwd(),
                        pid=0,
                        foreground_cmd="terminal",
                        agent_name="Terminal Session",
                        is_agent_running=True,
                        status="ready",
                    )
                )
            return results
        except Exception:
            return []

    def _inspect_process_tree(self, parent_pid: int, curr_cmd: str, title: str, proc_table: Optional[Dict[int, Dict[str, Any]]] = None) -> Tuple[str, str, bool]:
        """Identify what agent is running under a given shell / pane PID or its TTY."""
        combined_text = f"{curr_cmd} {title}".lower()

        # Check known signatures directly
        for regex, agent_label in self.KNOWN_AGENT_SIGNATURES:
            if regex.search(combined_text):
                return curr_cmd, agent_label, True

        table = proc_table if proc_table is not None else self._get_process_table()

        if parent_pid in table:
            parent_info = table[parent_pid]
            tty_name = parent_info.get("tty", "")

            # 1. Check all processes on this TTY
            if tty_name and "?" not in tty_name:
                for p_id, p_info in table.items():
                    if p_info.get("tty") == tty_name:
                        full_line = f"{p_info.get('comm', '')} {p_info.get('args', '')}"
                        for regex, agent_label in self.KNOWN_AGENT_SIGNATURES:
                            if regex.search(full_line):
                                return p_info.get("comm", "agent"), agent_label, True

            # 2. Check descendant processes
            def _find_children(pid: int) -> List[int]:
                return [p for p, c in table.items() if c.get("ppid") == pid]

            descendants = _find_children(parent_pid)
            for d in descendants:
                descendants.extend(_find_children(d))

            for dpid in descendants:
                if dpid in table:
                    d_info = table[dpid]
                    full_line = f"{d_info.get('comm', '')} {d_info.get('args', '')}"
                    for regex, agent_label in self.KNOWN_AGENT_SIGNATURES:
                        if regex.search(full_line):
                            return d_info.get("comm", "agent"), agent_label, True

        # Fallback classification
        clean_name = curr_cmd.lstrip("-").lower()
        if clean_name in ("zsh", "bash", "sh", "fish", "csh", "tcsh"):
            return curr_cmd, "Gemini / Terminal Agent", True

        return curr_cmd or "process", f"Agent ({curr_cmd or 'active'})", True

    def verify_agent_ready(self, session: TerminalSession, buffer_tail: str = "") -> Tuple[bool, str]:
        """Verify that the target session is actively waiting for input and not a dead shell."""
        # If we have a buffer sample, check prompt indicators
        if buffer_tail:
            lines = [l.strip() for l in buffer_tail.splitlines() if l.strip()]
            last_lines = " ".join(lines[-3:]) if lines else ""
            
            # Check if agent was interrupted or returned to bare shell
            if last_lines.endswith(("$", "#", "%")) and not any(p.search(last_lines) for p in self.PROMPT_REGEXES):
                if not session.is_agent_running:
                    return False, f"Target session `{session.session_id}` appears to be a bare shell prompt ({last_lines}). Please launch your agent first."

        return True, "Ready"

    def connect_session_by_identifier(self, identifier: str) -> Tuple[Optional[TerminalSession], str]:
        """
        Explicitly connect to a session by PID, tmux pane/session name, TTY name, or Kitty window ID.
        """
        raw_id = identifier.strip()
        if not raw_id:
            return None, "Empty session identifier."

        # 1. Check if matches an already auto-discovered session
        all_sessions = self.detect_all_sessions()
        for s in all_sessions:
            if s.session_id.lower() == raw_id.lower() or s.target_handle.lower() == raw_id.lower():
                return s, f"Found existing session `{s.session_id}`"
            if s.session_id.lower().endswith(raw_id.lower()) or raw_id.lower() in s.session_id.lower():
                return s, f"Matched session `{s.session_id}`"

        # 2. Check if identifier is a numeric PID (e.g. 58210)
        if raw_id.isdigit():
            target_pid = int(raw_id)
            # Check if this PID is inside a tmux pane
            if self.tmux_bin:
                try:
                    cmd = [
                        self.tmux_bin, "list-panes", "-a", "-F",
                        "#{pane_pid}|#{pane_id}|#{session_name}|#{window_index}|#{pane_index}|#{pane_current_path}|#{pane_current_command}|#{pane_title}"
                    ]
                    res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.5)
                    if res.returncode == 0:
                        for line in res.stdout.strip().splitlines():
                            parts = line.split("|")
                            if len(parts) >= 8:
                                pane_pid = int(parts[0]) if parts[0].isdigit() else 0
                                pane_id, sess_name, win_idx, pane_idx, cwd, curr_cmd, title = parts[1:8]
                                is_match = (target_pid == pane_pid)
                                if not is_match and pane_pid > 0:
                                    pg = subprocess.run(["pgrep", "-P", str(pane_pid)], capture_output=True, text=True)
                                    if str(target_pid) in pg.stdout.split():
                                        is_match = True
                                if is_match:
                                    fg_cmd, agent_label, is_agent = self._inspect_process_tree(target_pid, curr_cmd, title)
                                    sess = TerminalSession(
                                        session_id=f"tmux:{sess_name}:{win_idx}.{pane_idx}",
                                        backend="tmux",
                                        target_handle=pane_id,
                                        session_name=sess_name,
                                        window_name=f"Window {win_idx} ({title or curr_cmd})",
                                        pane_id=pane_id,
                                        cwd=cwd or os.getcwd(),
                                        pid=target_pid,
                                        foreground_cmd=fg_cmd or curr_cmd,
                                        agent_name=agent_label,
                                        is_agent_running=is_agent,
                                        status="ready" if is_agent else "shell",
                                    )
                                    return sess, f"Resolved PID {target_pid} to tmux pane `{pane_id}` in session `{sess_name}`"
                except Exception as e:
                    logger.debug(f"PID tmux lookup failed: {e}")

            # Inspect standalone process via ps
            try:
                ps_res = subprocess.run(["ps", "-p", str(target_pid), "-o", "pid=,tty=,comm=,args="], capture_output=True, text=True)
                if ps_res.returncode == 0 and ps_res.stdout.strip():
                    parts = ps_res.stdout.strip().split(maxsplit=3)
                    tty = parts[1] if len(parts) > 1 else "?"
                    comm = parts[2] if len(parts) > 2 else "process"
                    args = parts[3] if len(parts) > 3 else comm
                    fg_cmd, agent_label, is_agent = self._inspect_process_tree(target_pid, comm, args)
                    sess = TerminalSession(
                        session_id=f"pid:{target_pid}",
                        backend="pty",
                        target_handle=f"/dev/{tty}" if not tty.startswith("/") else tty,
                        session_name=f"Process {target_pid}",
                        window_name=f"{comm} (TTY {tty})",
                        pane_id=str(target_pid),
                        cwd=os.getcwd(),
                        pid=target_pid,
                        foreground_cmd=comm,
                        agent_name=agent_label,
                        is_agent_running=is_agent,
                        status="ready",
                    )
                    return sess, f"Connected to PID {target_pid} ({agent_label} on {tty})"
                else:
                    return None, f"PID `{target_pid}` is not currently running."
            except Exception as e:
                return None, f"Failed to inspect PID `{target_pid}`: {e}"

        # 3. Check if identifier is a tmux pane handle (e.g. %3 or %0)
        if raw_id.startswith("%") and self.tmux_bin:
            try:
                cmd = [
                    self.tmux_bin, "display-message", "-p", "-t", raw_id,
                    "#{session_name}|#{window_index}|#{pane_index}|#{pane_id}|#{pane_pid}|#{pane_current_path}|#{pane_current_command}|#{pane_title}"
                ]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.5)
                if res.returncode == 0 and res.stdout.strip():
                    parts = res.stdout.strip().split("|")
                    if len(parts) >= 8:
                        sess_name, win_idx, pane_idx, pane_id, pane_pid_str, cwd, curr_cmd, title = parts[:8]
                        pid = int(pane_pid_str) if pane_pid_str.isdigit() else 0
                        fg_cmd, agent_label, is_agent = self._inspect_process_tree(pid, curr_cmd, title)
                        sess = TerminalSession(
                            session_id=f"tmux:{sess_name}:{win_idx}.{pane_idx}",
                            backend="tmux",
                            target_handle=pane_id,
                            session_name=sess_name,
                            window_name=f"Window {win_idx} ({title or curr_cmd})",
                            pane_id=pane_id,
                            cwd=cwd or os.getcwd(),
                            pid=pid,
                            foreground_cmd=fg_cmd or curr_cmd,
                            agent_name=agent_label,
                            is_agent_running=is_agent,
                            status="ready" if is_agent else "shell",
                        )
                        return sess, f"Connected to tmux pane `{pane_id}`"
            except Exception as e:
                return None, f"tmux pane `{raw_id}` not found ({e})."

        # 4. Check if identifier is a TTY device (/dev/ttys002 or ttys002)
        clean_tty = raw_id.replace("/dev/", "")
        if clean_tty.startswith("tty"):
            try:
                ps_res = subprocess.run(["ps", "-t", clean_tty, "-o", "pid=,comm=,args="], capture_output=True, text=True)
                if ps_res.returncode == 0 and ps_res.stdout.strip():
                    lines = [l.strip() for l in ps_res.stdout.strip().splitlines() if l.strip()]
                    last_line = lines[-1]
                    parts = last_line.split(maxsplit=2)
                    t_pid = int(parts[0]) if parts[0].isdigit() else 0
                    t_comm = parts[1] if len(parts) > 1 else "terminal"
                    t_args = parts[2] if len(parts) > 2 else t_comm
                    fg_cmd, agent_label, is_agent = self._inspect_process_tree(t_pid, t_comm, t_args)
                    sess = TerminalSession(
                        session_id=f"tty:{clean_tty}",
                        backend="pty",
                        target_handle=f"/dev/{clean_tty}",
                        session_name=f"TTY {clean_tty}",
                        window_name=f"{agent_label} on {clean_tty}",
                        pane_id=clean_tty,
                        cwd=os.getcwd(),
                        pid=t_pid,
                        foreground_cmd=t_comm,
                        agent_name=agent_label,
                        is_agent_running=is_agent,
                        status="ready",
                    )
                    return sess, f"Connected to TTY `{clean_tty}` ({agent_label})"
            except Exception as e:
                return None, f"TTY lookup failed: {e}"

        return None, f"Could not find or connect to session `{raw_id}`."
