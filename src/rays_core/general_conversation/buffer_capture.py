import json
import logging
import os
import re
import shutil
import subprocess
from typing import Optional, List, Tuple
from .session_detector import TerminalSession

logger = logging.getLogger(__name__)

# Regular expression to strip ANSI escape codes
ANSI_ESCAPE_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences from terminal text."""
    if not text:
        return ""
    return ANSI_ESCAPE_RE.sub("", text)


class BufferCapture:
    """Extracts the recent 90-100 lines of scrollback and visible text per session."""

    def __init__(self):
        self.tmux_bin = shutil.which("tmux")
        self.kitty_bin = shutil.which("kitty")
        self.osascript_bin = shutil.which("osascript")

    def capture_recent_lines(self, session: TerminalSession, num_lines: int = 250) -> str:
        """Capture the last N lines of terminal output / conversation from the specified session."""
        # 1. Check if an AI agent conversation transcript exists for this session
        conv_history = self._extract_agent_conversation(session, num_turns=25)
        if conv_history.strip():
            return conv_history

        # 2. Check live scrollback from terminal multiplexer / socket
        raw_buf = ""
        if session.backend == "tmux":
            raw_buf = self._capture_tmux(session.target_handle, num_lines)
        elif session.backend == "kitty":
            raw_buf = self._capture_kitty(session.target_handle, num_lines)
        elif session.backend == "terminal":
            raw_buf = self._capture_macos_terminal(session.target_handle, num_lines)
        elif session.backend in ("pty", "pid", "tty"):
            raw_buf = self._capture_pty_or_pid(session, num_lines)

        if raw_buf.strip():
            return raw_buf

        # 3. Enrich with workspace context from session.cwd
        lines = [
            f"Terminal Session: `{session.session_id}` ({session.agent_name})",
            f"Working Directory: `{session.cwd}`"
        ]
        if session.cwd and os.path.isdir(session.cwd):
            try:
                top_items = [f for f in os.listdir(session.cwd) if not f.startswith(".")][:20]
                if top_items:
                    lines.append(f"Workspace Files: {', '.join(top_items)}")

                # Inspect logs / results folder
                for sub in ("logs", "results", "output"):
                    sub_dir = os.path.join(session.cwd, sub)
                    if os.path.isdir(sub_dir):
                        sub_files = sorted(
                            [f for f in os.listdir(sub_dir) if not f.startswith(".")],
                            key=lambda f: os.path.getmtime(os.path.join(sub_dir, f)) if os.path.exists(os.path.join(sub_dir, f)) else 0,
                            reverse=True
                        )
                        if sub_files:
                            lines.append(f"Recent {sub} files: {', '.join(sub_files[:8])}")
                            latest_sub_file = os.path.join(sub_dir, sub_files[0])
                            try:
                                with open(latest_sub_file, "r", encoding="utf-8", errors="ignore") as lf:
                                    tail = lf.readlines()[-60:]
                                    if tail:
                                        lines.append(f"Latest {sub}/{sub_files[0]} log tail:\n" + "".join(tail))
                            except Exception:
                                pass

                # Check recent git status
                gs = subprocess.run(["git", "status", "--short"], cwd=session.cwd, capture_output=True, text=True, timeout=0.8)
                if gs.returncode == 0 and gs.stdout.strip():
                    mod_files = [l.strip() for l in gs.stdout.splitlines()[:15]]
                    lines.append(f"Recent Git changes: {', '.join(mod_files)}")
            except Exception:
                pass

        return "\n".join(lines)

    def _extract_agent_conversation(self, session: TerminalSession, num_turns: int = 25) -> str:
        """Extract recent conversation history (User and Assistant turns) from agent transcripts."""
        pid = session.pid
        tty = getattr(session, "pane_id", "")
        cwd = session.cwd

        target_conv = getattr(session, "extra", {}).get("conv_id")
        # Check process table for explicit --conversation=<uuid> if not in extra
        if not target_conv:
            try:
                ps = subprocess.run(["ps", "-A", "-o", "pid,ppid,tty,args"], capture_output=True, text=True, timeout=0.5)
                for l in ps.stdout.splitlines():
                    if l.strip().startswith("PID"): continue
                    parts = l.strip().split(None, 3)
                    if len(parts) >= 4 and parts[0].isdigit():
                        p, pp, t, args = int(parts[0]), int(parts[1]), parts[2], parts[3]
                        if (t == tty and t) or p == pid or pp == pid:
                            m = re.search(r"--conversation=([a-f0-9\-]+)", args)
                            if m:
                                target_conv = m.group(1)
                                break
            except Exception:
                pass

        brain_dir = os.path.expanduser("~/.gemini/antigravity-cli/brain")
        # Match by workspace folder in brain if not in args
        if not target_conv and os.path.isdir(brain_dir):
            best_conv = None
            best_mtime = 0
            try:
                for cid in os.listdir(brain_dir):
                    cpath = os.path.join(brain_dir, cid)
                    log_f = os.path.join(cpath, ".system_generated", "logs", "transcript.jsonl")
                    if os.path.exists(log_f):
                        try:
                            with open(log_f, errors="ignore") as f:
                                head = "".join([f.readline() for _ in range(30)])
                                if cwd and os.path.basename(cwd) in head:
                                    mtime = os.path.getmtime(log_f)
                                    if mtime > best_mtime:
                                        best_mtime = mtime
                                        best_conv = cid
                        except Exception:
                            pass
                target_conv = best_conv
            except Exception:
                pass

        if target_conv:
            log_f = os.path.join(brain_dir, target_conv, ".system_generated", "logs", "transcript.jsonl")
            if os.path.exists(log_f):
                turns = []
                try:
                    with open(log_f, errors="ignore") as f:
                        for line in f:
                            try:
                                obj = json.loads(line)
                                t = obj.get("type")
                                content = (obj.get("content") or "").strip()
                                if t == "USER_INPUT" and content:
                                    clean_c = re.sub(r"<[^>]+>", "", content).strip()
                                    turns.append(f"User: {clean_c[:1500]}")
                                elif t == "PLANNER_RESPONSE" and content:
                                    turns.append(f"Assistant: {content[:3000]}")
                            except Exception:
                                pass
                    if turns:
                        return f"Conversation Session `{target_conv}`:\n" + "\n\n".join(turns[-num_turns:])
                except Exception:
                    pass

        return ""

    def _capture_pty_or_pid(self, session: TerminalSession, num_lines: int) -> str:
        """Capture scrollback from a PTY/PID session."""
        pid = session.pid
        target_handle = session.target_handle

        # Check tmux first
        if self.tmux_bin and pid > 0:
            try:
                cmd = [self.tmux_bin, "list-panes", "-a", "-F", "#{pane_pid}|#{pane_id}"]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.0)
                if res.returncode == 0:
                    for line in res.stdout.strip().splitlines():
                        parts = line.split("|")
                        if len(parts) >= 2:
                            p_pid = int(parts[0]) if parts[0].isdigit() else 0
                            p_id = parts[1]
                            if p_pid == pid:
                                return self._capture_tmux(p_id, num_lines)
            except Exception:
                pass

        # Check Apple Terminal / iTerm2 by TTY
        clean_tty = target_handle.replace("/dev/", "").strip()
        if self.osascript_bin and clean_tty:
            script = f'''
            tell application "System Events"
                set hasTerm to (count of (every process whose name is "Terminal")) > 0
            end tell
            if hasTerm then
                tell application "Terminal"
                    repeat with w in windows
                        repeat with t in tabs of w
                            if (tty of t) contains "{clean_tty}" then
                                return history of t
                            end if
                        end repeat
                    end repeat
                end tell
            end if
            return ""
            '''
            try:
                res = subprocess.run([self.osascript_bin, "-e", script], capture_output=True, text=True, timeout=1.5)
                if res.returncode == 0 and res.stdout.strip():
                    clean = strip_ansi(res.stdout)
                    lines = clean.splitlines()
                    return "\n".join(lines[-num_lines:])
            except Exception:
                pass

        # Check for Gemini / Antigravity transcripts if agent is Gemini or Antigravity
        gemini_brain = os.path.expanduser("~/.gemini/antigravity-cli/brain")
        if os.path.isdir(gemini_brain):
            try:
                conv_dirs = sorted(
                    [os.path.join(gemini_brain, d) for d in os.listdir(gemini_brain) if os.path.isdir(os.path.join(gemini_brain, d))],
                    key=os.path.getmtime,
                    reverse=True
                )
                for cd in conv_dirs[:2]:
                    log_file = os.path.join(cd, ".system_generated", "logs", "transcript.jsonl")
                    if os.path.exists(log_file):
                        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                            recent_entries = []
                            for line in f.readlines()[-30:]:
                                try:
                                    import json
                                    obj = json.loads(line)
                                    content = obj.get("content", "")
                                    if content:
                                        recent_entries.append(content[:300])
                                except Exception:
                                    pass
                            if recent_entries:
                                return "\n".join(recent_entries[-num_lines:])
            except Exception:
                pass

        return ""

    def _capture_tmux(self, pane_id: str, num_lines: int) -> str:
        """Capture scrollback buffer from tmux pane."""
        if not self.tmux_bin:
            return ""
        try:
            # -p dumps to stdout, -S -N specifies start offset from bottom of scrollback
            cmd = [self.tmux_bin, "capture-pane", "-t", pane_id, "-p", "-S", f"-{num_lines}"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.0)
            if res.returncode == 0:
                raw_text = res.stdout
                clean = strip_ansi(raw_text)
                lines = clean.splitlines()
                # Return last num_lines
                return "\n".join(lines[-num_lines:])
        except Exception as e:
            logger.debug(f"Failed to capture tmux pane {pane_id}: {e}")
        return ""

    def _capture_kitty(self, window_id: str, num_lines: int) -> str:
        """Capture scrollback buffer from Kitty window via socket."""
        import glob
        if self.kitty_bin:
            candidate_sockets = []
            if os.environ.get("KITTY_LISTEN_ON"):
                candidate_sockets.append(os.environ.get("KITTY_LISTEN_ON"))
            candidate_sockets.extend(glob.glob("/tmp/mykitty*"))
            candidate_sockets.extend(glob.glob("/tmp/kitty*"))
            candidate_sockets.extend(glob.glob(os.path.expanduser("~/.cache/kitty/*")))

            for sock in set(candidate_sockets):
                for match_target in [f"pid:{window_id}", f"id:{window_id}", "recent:0"]:
                    try:
                        sock_arg = f"--to=unix:{sock}" if not sock.startswith("unix:") else f"--to={sock}"
                        cmd = [self.kitty_bin, "@", sock_arg, "get-text", "--extent=screen", f"--match={match_target}"]
                        res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.0)
                        if res.returncode == 0 and res.stdout.strip():
                            clean = strip_ansi(res.stdout)
                            lines = clean.splitlines()
                            return "\n".join(lines[-num_lines:])
                    except Exception:
                        pass
        return ""

    def _capture_macos_terminal(self, tty_or_idx: str, num_lines: int) -> str:
        """Capture history from Apple Terminal."""
        if not self.osascript_bin:
            return ""
        script = f'''
        tell application "Terminal"
            try
                set h to history of front tab of front window
                return h
            on error
                return ""
            end try
        end tell
        '''
        try:
            res = subprocess.run([self.osascript_bin, "-e", script], capture_output=True, text=True, timeout=2.0)
            if res.returncode == 0:
                clean = strip_ansi(res.stdout)
                lines = clean.splitlines()
                return "\n".join(lines[-num_lines:])
        except Exception as e:
            logger.debug(f"Failed to capture Apple Terminal: {e}")
        return ""

    def compute_new_output(self, initial_buffer: str, current_buffer: str) -> str:
        """Extract only the new output appended since initial_buffer was captured."""
        init_lines = [l.strip() for l in initial_buffer.splitlines() if l.strip()]
        curr_lines = [l.rstrip() for l in current_buffer.splitlines()]

        if not init_lines:
            return current_buffer

        # Find the last matching landmark line from initial buffer in current buffer
        last_init = init_lines[-1]
        for i in range(len(curr_lines) - 1, -1, -1):
            if curr_lines[i].strip() == last_init:
                new_slice = curr_lines[i + 1:]
                return "\n".join(new_slice).strip()

        # Fallback if landmark shifted out of scrollback window
        return current_buffer
