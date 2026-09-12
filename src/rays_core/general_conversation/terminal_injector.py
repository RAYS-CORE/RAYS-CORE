"""Zero-improvisation keystroke injection into terminal agents across multiplexers & PTYs."""
import json
import logging
import os
import re
import shutil
import subprocess
from typing import Tuple, Optional, Any
from .session_detector import TerminalSession

logger = logging.getLogger(__name__)


class TerminalInjector:
    """Delivers exact prompt text into a target terminal session's agent prompt."""

    def __init__(self):
        self.tmux_bin = shutil.which("tmux")
        self.kitty_bin = shutil.which("kitty")
        self.osascript_bin = shutil.which("osascript")

    def inject_prompt(self, session: TerminalSession, prompt_text: str) -> Tuple[bool, str]:
        """
        Delivers the prompt into the target session and returns the result.
        
        Returns:
            Tuple[success: bool, detail: str]
        """
        clean_prompt = prompt_text.rstrip("\n")
        conv_id = getattr(session, "extra", {}).get("conv_id")
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        # 0. Primary: Direct Agent Execution in target workspace with live screen streaming
        if conv_id and os.path.exists(agy_bin):
            tty_name = getattr(session, "pane_id", "") or getattr(session, "extra", {}).get("tty", "")
            tty_path = f"/dev/{tty_name}" if tty_name and not tty_name.startswith("/") else tty_name
            tty_file = None
            if tty_path and os.path.exists(tty_path):
                try:
                    crlf_hdr = f"\r\n\033[1;35m──[RAYS Dispatched Prompt]──\033[0m\r\n{clean_prompt}\r\n\r\n\033[1;36m──[Live Agent Stream]──\033[0m\r\n".replace("\r\n", "\n").replace("\n", "\r\n")
                    tty_file = open(tty_path, "w")
                    tty_file.write(crlf_hdr)
                    tty_file.flush()
                except Exception:
                    tty_file = None

            try:
                from rays_core import rays_ui
                rays_ui.hud_set_status("Observing", f"{session.agent_name} · live streaming...")
                cmd = [
                    agy_bin,
                    f"--conversation={conv_id}",
                    "--dangerously-skip-permissions",
                    "-p",
                    clean_prompt
                ]
                proc = subprocess.Popen(cmd, cwd=session.cwd or os.getcwd(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                full_output = []
                for line in proc.stdout:
                    full_output.append(line)
                    if tty_file:
                        try:
                            crlf_line = line.replace("\r\n", "\n").replace("\n", "\r\n")
                            tty_file.write(crlf_line)
                            tty_file.flush()
                        except Exception:
                            pass
                proc.wait()
                if tty_file:
                    try:
                        tty_file.write("\r\n\r\n> ")
                        tty_file.flush()
                        tty_file.close()
                    except Exception:
                        pass
                res_text = "".join(full_output).strip()
                if res_text:
                    # Clean response to ensure only the final prompt answer is returned
                    clean_res = res_text
                    if clean_prompt and clean_res.startswith(clean_prompt):
                        clean_res = clean_res[len(clean_prompt):].strip()
                    lines = clean_res.splitlines()
                    while lines and lines[-1].strip() in (">", "❯", "$", "#", ">>>", "%"):
                        lines.pop()
                    final_ans = "\n".join(lines).strip()
                    return True, final_ans or res_text
            except Exception as e:
                logger.debug(f"Direct agent dispatch error: {e}")

        # 1. Tmux backend
        if session.backend == "tmux":
            return self._inject_tmux(session.target_handle, clean_prompt)

        # 2. PTY / Standalone PID / TTY backend
        if session.backend in ("pty", "pid", "tty"):
            return self._inject_pty_or_pid(session, clean_prompt)

        # Fallback to generic injection
        return self._inject_pty_or_pid(session, clean_prompt)

    def _inject_tmux(self, pane_id: str, prompt_text: str) -> Tuple[bool, str]:
        """Deliver literal keystrokes into tmux pane."""
        if not self.tmux_bin:
            return False, "tmux binary not found"
        try:
            # Step 1: Send text literally (-l flag prevents tmux key interpretation)
            cmd_send = [self.tmux_bin, "send-keys", "-t", pane_id, "-l", prompt_text]
            res1 = subprocess.run(cmd_send, capture_output=True, text=True, timeout=2.0)
            if res1.returncode != 0:
                return False, f"tmux send-keys failed: {res1.stderr.strip()}"

            # Step 2: Send Enter key
            cmd_enter = [self.tmux_bin, "send-keys", "-t", pane_id, "Enter"]
            res2 = subprocess.run(cmd_enter, capture_output=True, text=True, timeout=2.0)
            if res2.returncode != 0:
                return False, f"tmux send Enter failed: {res2.stderr.strip()}"

            return True, f"Successfully dispatched prompt to tmux pane `{pane_id}`"
        except Exception as e:
            return False, f"tmux injection error: {e}"

    def _inject_kitty(self, session_or_handle: Any, prompt_text: str) -> Tuple[bool, str]:
        """Deliver text directly into interactive Kitty terminal tab via AppKit Cocoa process activation and paste."""
        import glob
        import time
        target_str = session_or_handle.target_handle if hasattr(session_or_handle, "target_handle") else str(session_or_handle)
        pid = getattr(session_or_handle, "pid", 0)
        login_pid = getattr(session_or_handle, "extra", {}).get("login_pid") if hasattr(session_or_handle, "extra") else None

        # 1. Try remote control sockets (if configured)
        if self.kitty_bin:
            candidate_sockets = []
            if os.environ.get("KITTY_LISTEN_ON"):
                candidate_sockets.append(os.environ.get("KITTY_LISTEN_ON"))
            candidate_sockets.extend(glob.glob("/tmp/mykitty*"))
            candidate_sockets.extend(glob.glob("/tmp/kitty*"))
            candidate_sockets.extend(glob.glob(os.path.expanduser("~/.cache/kitty/*")))

            for sock in set(candidate_sockets):
                for match_target in [f"pid:{target_str}", f"id:{target_str}", "recent:0"]:
                    try:
                        sock_arg = f"--to=unix:{sock}" if not sock.startswith("unix:") else f"--to={sock}"
                        cmd = [self.kitty_bin, "@", sock_arg, "send-text", f"--match={match_target}", "--", f"{prompt_text}\n"]
                        res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.2)
                        if res.returncode == 0:
                            return True, f"Dispatched prompt directly into Kitty ({match_target}) via socket"
                    except Exception:
                        pass

        # 2. Find the root Kitty GUI process PID for this exact session
        kitty_gui_pid = getattr(session_or_handle, "extra", {}).get("gui_pid") if hasattr(session_or_handle, "extra") else None
        if not kitty_gui_pid:
            try:
                ps = subprocess.run(["ps", "-A", "-o", "pid,ppid,tty,command"], capture_output=True, text=True, timeout=0.5)
                for l in ps.stdout.splitlines():
                    if ("kitty" in l or "kitten" in l) and ("run-shell" in l or "login" in l):
                        parts = l.strip().split(None, 3)
                        if len(parts) >= 4 and parts[0].isdigit():
                            p, pp = int(parts[0]), int(parts[1])
                            if p == login_pid or p == pid or pp == pid:
                                kitty_gui_pid = pp
                                break
            except Exception:
                pass

        # 3. Use native macOS Cocoa AppKit to bring THAT EXACT Kitty OS window to the front
        if os.name != "nt":
            if kitty_gui_pid:
                try:
                    from AppKit import NSRunningApplication
                    app = NSRunningApplication.runningApplicationWithProcessIdentifier_(kitty_gui_pid)
                    if app:
                        # 3 = NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps
                        app.activateWithOptions_(3)
                        time.sleep(0.4)
                except Exception as e:
                    logger.debug(f"AppKit process activation failed: {e}")

            # Set clipboard using pbcopy to avoid AppleScript string escape issues
            try:
                subprocess.run(["pbcopy"], input=prompt_text.encode("utf-8"), check=True, timeout=1.0)
                time.sleep(0.1)
            except Exception:
                pass

            if self.osascript_bin:
                target_proc_clause = f"(every application process whose unix id is {kitty_gui_pid})" if kitty_gui_pid else '(every application process whose name is "kitty")'
                script = f'''
                tell application "System Events"
                    set procList to {target_proc_clause}
                    if (count of procList) > 0 then
                        set p to item 1 of procList
                        set frontmost of p to true
                        tell p
                            try
                                perform action "AXRaise" of window 1
                            end try
                        end tell
                        delay 0.15
                        keystroke "v" using {{command down}}
                        delay 0.2
                        key code 36
                        return "OK"
                    end if
                end tell
                return "FAILED"
                '''
                try:
                    res = subprocess.run([self.osascript_bin, "-e", script], capture_output=True, text=True, timeout=3.0)
                    if "OK" in res.stdout:
                        return True, f"Delivered prompt live into Kitty window (PID {kitty_gui_pid or pid})"
                except Exception as e:
                    logger.debug(f"AppleScript paste failed: {e}")

        return False, "Failed to deliver prompt to Kitty window."

    def _inject_macos_terminal(self, tty_or_idx: str, prompt_text: str) -> Tuple[bool, str]:
        """Deliver text into Apple Terminal via AppleScript."""
        if not self.osascript_bin:
            return False, "osascript binary not found"
        escaped_prompt = prompt_text.replace('\\', '\\\\').replace('"', '\\"')
        clean_tty = tty_or_idx.replace("/dev/", "").strip()
        script = f'''
        tell application "Terminal"
            set sent to false
            repeat with w in windows
                repeat with t in tabs of w
                    if (tty of t) contains "{clean_tty}" then
                        do script "{escaped_prompt}" in t
                        set sent to true
                        return "OK"
                    end if
                end repeat
            end repeat
            if not sent then
                do script "{escaped_prompt}" in front tab of front window
                return "OK"
            end if
        end tell
        '''
        try:
            res = subprocess.run([self.osascript_bin, "-e", script], capture_output=True, text=True, timeout=2.5)
            if res.returncode != 0 or "OK" not in res.stdout:
                return False, f"AppleScript injection error: {res.stdout or res.stderr}"
            return True, "Successfully dispatched prompt to Terminal"
        except Exception as e:
            return False, f"Terminal injection error: {e}"

    def _inject_pty_or_pid(self, session: TerminalSession, prompt_text: str) -> Tuple[bool, str]:
        """Deliver prompt to a process identified by PID or TTY device across multiplexers and GUI terminals."""
        pid = session.pid
        target_handle = session.target_handle

        # 1. Check if this PID belongs to a tmux pane
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
                                return self._inject_tmux(p_id, prompt_text)
                            # Check if pid is child of pane_pid
                            if p_pid > 0:
                                pg = subprocess.run(["pgrep", "-P", str(p_pid)], capture_output=True, text=True)
                                if str(pid) in pg.stdout.split():
                                    return self._inject_tmux(p_id, prompt_text)
            except Exception as e:
                logger.debug(f"tmux check for PID {pid} failed: {e}")

        # 2. Check if this TTY belongs to Apple Terminal or iTerm2 on macOS
        if self.osascript_bin and os.name != "nt":
            # Extract tty from target_handle or ps
            tty_name = ""
            if target_handle.startswith("/dev/"):
                tty_name = target_handle.replace("/dev/", "")
            elif "tty" in target_handle:
                tty_name = target_handle
            elif pid > 0:
                try:
                    ps = subprocess.run(["ps", "-p", str(pid), "-o", "tty="], capture_output=True, text=True)
                    if ps.returncode == 0 and ps.stdout.strip():
                        tty_name = ps.stdout.strip().replace("/dev/", "")
                except Exception:
                    pass

            if tty_name and "?" not in tty_name:
                escaped_prompt = prompt_text.replace('\\', '\\\\').replace('"', '\\"')

                # Try Apple Terminal
                script_terminal = f'''
                tell application "System Events"
                    set isRunning to (count of (every process whose name is "Terminal")) > 0
                end tell
                if isRunning then
                    tell application "Terminal"
                        repeat with w in windows
                            repeat with t in tabs of w
                                if (tty of t) contains "{tty_name}" then
                                    do script "{escaped_prompt}" in t
                                    return "OK"
                                end if
                            end repeat
                        end repeat
                    end tell
                end if
                return "NOT_FOUND"
                '''
                try:
                    res_term = subprocess.run([self.osascript_bin, "-e", script_terminal], capture_output=True, text=True, timeout=1.5)
                    if "OK" in res_term.stdout:
                        return True, f"Dispatched prompt to Apple Terminal tab ({tty_name})"
                except Exception:
                    pass

                # Try iTerm2
                script_iterm = f'''
                tell application "System Events"
                    set isRunning to (count of (every process whose name is "iTerm2" or name is "iTerm")) > 0
                end tell
                if isRunning then
                    tell application "iTerm"
                        repeat with w in windows
                            repeat with t in tabs of w
                                repeat with s in sessions of t
                                    if (tty of s) contains "{tty_name}" then
                                        tell s to write text "{escaped_prompt}"
                                        return "OK"
                                    end if
                                end repeat
                            end repeat
                        end repeat
                    end tell
                end if
                return "NOT_FOUND"
                '''
                try:
                    res_iterm = subprocess.run([self.osascript_bin, "-e", script_iterm], capture_output=True, text=True, timeout=1.5)
                    if "OK" in res_iterm.stdout:
                        return True, f"Dispatched prompt to iTerm2 session ({tty_name})"
                except Exception:
                    pass

        # 3. Direct write to TTY device (if available)
        dev_path = target_handle if target_handle.startswith("/dev/") else (f"/dev/{target_handle}" if "tty" in target_handle else "")
        if dev_path and os.path.exists(dev_path):
            try:
                with open(dev_path, "w", encoding="utf-8") as f:
                    f.write(prompt_text + "\n")
                    f.flush()
                return True, f"Dispatched prompt to device `{dev_path}`"
            except Exception as e:
                logger.debug(f"Direct TTY write to {dev_path} failed: {e}")

        # 4. macOS GUI Application Keystroke / Paste
        if self.osascript_bin and os.name != "nt" and pid > 0:
            try:
                # Find application owning the PID
                ps_app = subprocess.run(["ps", "-p", str(pid), "-o", "comm="], capture_output=True, text=True)
                comm = ps_app.stdout.strip()
                escaped_prompt = prompt_text.replace('\\', '\\\\').replace('"', '\\"')
                script_key = f'''
                tell application "System Events"
                    keystroke "{escaped_prompt}"
                    key code 36
                end tell
                return "OK"
                '''
                res_key = subprocess.run([self.osascript_bin, "-e", script_key], capture_output=True, text=True, timeout=1.5)
                if "OK" in res_key.stdout:
                    return True, f"Delivered prompt via keystroke to session ({session.agent_name})"
            except Exception as e:
                logger.debug(f"Keystroke delivery failed: {e}")

        return False, (
            f"Could not inject prompt into `{session.session_id}`. "
            f"Please ensure the target agent is running in tmux, Kitty, Terminal, or iTerm2."
        )
