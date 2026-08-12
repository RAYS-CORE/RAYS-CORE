import re

with open("src/rays_core/rays_ui.py", "r") as f:
    content = f.read()

new_content = """
from prompt_toolkit import Application
from prompt_toolkit.layout import Layout, HSplit, VSplit, ConditionalContainer, Window
from prompt_toolkit.layout.controls import FormattedTextControl, BufferControl
from prompt_toolkit.buffer import Buffer
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.formatted_text import FormattedText, ANSI
from prompt_toolkit.history import FileHistory
from prompt_toolkit.filters import Condition
from prompt_toolkit.styles import Style

def _build_status_bar_text():
    import time
    
    ctx_used_str = "0"
    if _SESSION_CTX_USED >= 1000000:
        ctx_used_str = f"{_SESSION_CTX_USED/1000000:.1f}M"
    elif _SESSION_CTX_USED >= 1000:
        ctx_used_str = f"{_SESSION_CTX_USED/1000:.1f}K"
    else:
        ctx_used_str = str(_SESSION_CTX_USED)
        
    ctx_limit_str = "0"
    if _SESSION_CTX_LIMIT >= 1000000:
        ctx_limit_str = f"{_SESSION_CTX_LIMIT/1000000:.1f}M"
    elif _SESSION_CTX_LIMIT >= 1000:
        ctx_limit_str = f"{_SESSION_CTX_LIMIT/1000:.1f}K"
    else:
        ctx_limit_str = str(_SESSION_CTX_LIMIT)
        
    pct = 0
    if _SESSION_CTX_LIMIT > 0:
        pct = int(100 * _SESSION_CTX_USED / _SESSION_CTX_LIMIT)
    pct = min(100, max(0, pct))
    
    w = 8
    filled = int(w * pct / 100)
    bar = "=" * filled + " " * (w - filled)
    
    elapsed = 0
    if _SESSION_START_TIME > 0:
        elapsed = time.time() - _SESSION_START_TIME
    
    if elapsed < 60:
        time_str = f"{int(elapsed)}s"
    else:
        m = int(elapsed // 60)
        s = int(elapsed % 60)
        if s == 0:
            time_str = f"{m}m"
        else:
            time_str = f"{m}m {s}s"
            
    bg_tasks = len(_BACKGROUND_TASKS)
    bg_str = f" | ⊙ {bg_tasks}" if bg_tasks > 0 else ""
    
    text = f" $ {_SESSION_MODEL} | {ctx_used_str}/{ctx_limit_str} | [{bar}] {pct}% | {time_str}{bg_str}"
    
    return FormattedText([("class:bottom-toolbar", text)])

def _build_slash_dropdown_text(query: str, selected_idx: int):
    q = query.lower()
    if q.startswith('/'):
        q = q[1:]
    
    filtered = [cmd for cmd in SLASH_COMMANDS if q in cmd[0].lower()]
    
    items = []
    for i, (cmd, desc) in enumerate(filtered):
        style = "class:slash-selected" if i == selected_idx else ""
        cmd_padded = cmd.ljust(15)
        row = f" {cmd_padded} {desc} \\n"
        items.append((style, row))
        
    return FormattedText(items)

def get_user_prompt() -> Optional[str]:
    \"\"\"
    Get user input with multi-line support, persistent history, and Hermes-style
    bracketed paste squashing using prompt_toolkit.
    \"\"\"
    global _pt_session, _paste_counter, _PT_APP_REF
    import os
    import time
    
    history_path = os.path.join(os.path.expanduser("~"), ".rays_history")
    
    result = [None]
    selected_slash_idx = [0]
    
    input_buffer = Buffer(
        history=FileHistory(history_path),
        multiline=False,
        name='input',
        accept_handler=lambda buf: None
    )
    
    @Condition
    def is_slash_mode():
        return input_buffer.text.startswith('/')
        
    @Condition
    def is_agent_running():
        return _SESSION_AGENT_RUNNING
    
    def get_status_bar_text():
        return _build_status_bar_text()
        
    def _get_slash_items():
        return _build_slash_dropdown_text(input_buffer.text, selected_slash_idx[0])
        
    def get_hint_line():
        return FormattedText([("class:hint", " > | msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel")])
    
    body = HSplit([
        Window(),  # spacer
        ConditionalContainer(
            content=Window(content=FormattedTextControl(_get_slash_items), height=min(8, len(SLASH_COMMANDS))),
            filter=is_slash_mode
        ),
        ConditionalContainer(
            content=Window(height=1, content=FormattedTextControl(get_hint_line), style='class:hint'),
            filter=is_agent_running
        ),
        Window(height=1, content=BufferControl(buffer=input_buffer), get_line_prefix=lambda lnum, ww: ANSI(f'  \\x1b[38;5;205m❯\\x1b[0m ')),
        Window(height=1, content=FormattedTextControl(get_status_bar_text), style='class:bottom-toolbar'),
    ])
    
    layout = Layout(body, focused_element=input_buffer)
    
    kb = KeyBindings()
    
    @kb.add('enter')
    def _(event):
        if is_slash_mode():
            q = input_buffer.text.lower()
            if q.startswith('/'):
                q = q[1:]
            filtered = [cmd for cmd in SLASH_COMMANDS if q in cmd[0].lower()]
            if filtered and 0 <= selected_slash_idx[0] < len(filtered):
                input_buffer.text = filtered[selected_slash_idx[0]][0] + " "
                input_buffer.cursor_position = len(input_buffer.text)
                return
        result[0] = input_buffer.text
        event.app.exit()
        
    @kb.add('up', filter=is_slash_mode)
    def _(event):
        selected_slash_idx[0] = max(0, selected_slash_idx[0] - 1)
        
    @kb.add('down', filter=is_slash_mode)
    def _(event):
        q = input_buffer.text.lower()[1:]
        filtered = [cmd for cmd in SLASH_COMMANDS if q in cmd[0].lower()]
        selected_slash_idx[0] = min(len(filtered) - 1, selected_slash_idx[0] + 1)
        
    @kb.add('escape', filter=is_slash_mode)
    def _(event):
        input_buffer.text = ""
        
    @kb.add('tab', filter=is_slash_mode)
    def _(event):
        q = input_buffer.text.lower()[1:]
        filtered = [cmd for cmd in SLASH_COMMANDS if q in cmd[0].lower()]
        if filtered and 0 <= selected_slash_idx[0] < len(filtered):
            input_buffer.text = filtered[selected_slash_idx[0]][0] + " "
            input_buffer.cursor_position = len(input_buffer.text)
            
    @kb.add('c-c')
    def _(event):
        print(f"\\n  \\x1b[38;5;141mInterrupted — returning to prompt\\x1b[0m")
        result[0] = ""
        event.app.exit()
        
    prev_text = [""]
    
    def on_text_changed(buf):
        global _paste_counter
        text = buf.text
        if len(text) - len(prev_text[0]) > 10 and text.count('\\n') - prev_text[0].count('\\n') >= 5:
            if not text.strip().startswith('/'):
                _paste_counter += 1
                paste_dir = os.path.join(os.path.expanduser("~"), ".rays_pastes")
                os.makedirs(paste_dir, exist_ok=True)
                
                filename = f"paste_{_paste_counter}_{int(time.time())}.txt"
                filepath = os.path.join(paste_dir, filename)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(text)
                
                line_count = text.count('\\n') + 1
                placeholder = f"[Pasted text #{_paste_counter}: {line_count} lines \u2192 {filepath}]"
                
                buf.text = placeholder
                buf.cursor_position = len(placeholder)
                text = placeholder
                
        prev_text[0] = text
        
        # Reset selected index on text change
        selected_slash_idx[0] = 0

    input_buffer.on_text_changed += on_text_changed
    
    style = Style.from_dict({
        'bottom-toolbar': 'bg:#1a1a2e #888888',
        'slash-selected': 'bg:#d7af00 #000000 bold',
        'hint': '#555555',
    })
    
    app = Application(layout=layout, key_bindings=kb, style=style, full_screen=False)
    _PT_APP_REF = app
    
    try:
        app.run()
    except EOFError:
        result[0] = None
    finally:
        _PT_APP_REF = None
        input_buffer.on_text_changed -= on_text_changed
        
    if result[0] is None:
        return None
        
    if not result[0].strip():
        return ""
        
    return result[0].strip()
"""

# Find def get_user_prompt() -> Optional[str]:
start_idx = content.find("def get_user_prompt() -> Optional[str]:")
end_idx = content.find("def expand_pasted_text(user_input: str) -> str:", start_idx)

if start_idx != -1 and end_idx != -1:
    updated_content = content[:start_idx] + new_content + "\n" + content[end_idx:]
    with open("src/rays_core/rays_ui.py", "w") as f:
        f.write(updated_content)
    print("Replaced successfully")
else:
    print("Could not find start or end index")

