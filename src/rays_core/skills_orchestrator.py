import os
import json
import yaml
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from .ai_client import AIClient
from .execution_context import (
    format_prior_executions,
    format_session_actions,
    has_tool_actions,
)
from . import rays_ui
from .workspace_paths import resolve_workspace_path

class SkillsOrchestrator:
    def __init__(self, ai_client: AIClient, config: Dict[str, Any], codebase_root: Path):
        self.ai_client = ai_client
        self.config = config
        self.codebase_root = Path(codebase_root).resolve()
        self.local_skills_dir = self.codebase_root / "skills"
        self.global_skills_dir = Path.home() / ".rays" / "skills"
        
        # Native RAYS-Core bundled skills
        self.native_skills_dir = Path(__file__).resolve().parent.parent.parent / "skills"
        
        # Fallback system paths
        self.fallback_skill_dirs = [
            Path.home() / ".rays-core" / "skills",
            Path.home() / ".config" / "rays" / "skills"
        ]
        self.prompts = config.get('skills_orchestrator_prompts', {})

    def discover_skills(self) -> List[Dict[str, str]]:
        """Scan both local and global skills directories."""
        import sys
        skills = []
        seen_names = set()

        all_dirs = [self.local_skills_dir, self.global_skills_dir, self.native_skills_dir] + self.fallback_skill_dirs
        for skills_dir in all_dirs:
            if not skills_dir.exists():
                continue

            for skill_md in skills_dir.rglob("SKILL.md"):
                # Skip hidden directories like .git or .venv
                if any(part.startswith('.') for part in skill_md.parts):
                    continue

                skill_path = skill_md.parent
                skill_name = skill_path.name
                
                if skill_name in seen_names:
                    continue
                
                # Infer category from parent directory if it's not the root skills_dir
                inferred_category = ""
                if skill_path.parent != skills_dir:
                    inferred_category = skill_path.parent.name
                    
                try:
                    content = skill_md.read_text()
                    if content.startswith('---'):
                        parts = content.split('---', 2)
                        if len(parts) >= 3:
                            frontmatter = yaml.safe_load(parts[1])
                            
                            # Platform constraint filtering
                            platforms = frontmatter.get('platforms', [])
                            if platforms and sys.platform == 'darwin' and 'mac' not in [p.lower() for p in platforms] and 'macos' not in [p.lower() for p in platforms]:
                                continue
                            if platforms and sys.platform.startswith('linux') and 'linux' not in [p.lower() for p in platforms]:
                                continue
                            if platforms and sys.platform == 'win32' and 'windows' not in [p.lower() for p in platforms]:
                                continue

                            skills.append({
                                "name": frontmatter.get("name", skill_name),
                                "description": frontmatter.get("description", ""),
                                "category": frontmatter.get("category", inferred_category),
                                "path": skill_md.as_posix(),
                                "root": skill_path.as_posix(),
                                "platforms": platforms
                            })
                    else:
                        skills.append({
                            "name": skill_name,
                            "description": content.split('\n')[0].strip('# '),
                            "category": inferred_category,
                            "path": skill_md.as_posix(),
                            "root": skill_path.as_posix(),
                            "platforms": []
                        })
                    seen_names.add(skill_name)
                except Exception as e:
                    rays_ui.print_warning(f"Failed to read skill at {skill_path}: {e}")
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
        max_steps = int(self.config.get("skill_subagent_max_turns", 15))

        for turn in range(1, max_steps + 1):
            rays_ui.hud_set_status("Thinking", f"skill/{skill_name} · turn {turn}")

            prompt = self.prompts["execute_skill_step"].format(
                user_prompt=user_prompt,
                overall_plan=json.dumps(plan, indent=2),
                skill_name=skill_name,
                skill_root=skill_root,
                workspace_root=self.codebase_root.as_posix(),
                spawn_reason=reason,
                skill_md=skill_md_content,
                prior_executions=prior_transcript,
                session_actions=format_session_actions(session_actions),
                turn_number=turn,
            )

            response = self.ai_client.generate_json(prompt)
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
            return self._run_shell_command(args.get('command'))
        elif name == 'write_file':
            return self._write_file(args.get('path'), args.get('content'))
        elif name == 'patch_file':
            return self._patch_file(args.get('path'), args.get('search'), args.get('replace'))
        elif name == 'read_file':
            return self._read_file(args.get('path'))
        elif name == 'list_directory':
            return self._list_directory(args.get('path', '.'))
        else:
            return f"Error: Tool '{name}' is not allowed in this mode. Only run_shell_command, write_file, patch_file, read_file, and list_directory are permitted."

    def _run_shell_command(self, command: str) -> str:
        if not command:
            return "Error: 'command' argument is required for run_shell_command"
        rays_ui.print_step(f"Executing: {command}")
        try:
            # Explicitly run in codebase_root
            result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=self.codebase_root)
            output = result.stdout + result.stderr
            return output if output else "Command executed successfully with no output."
        except Exception as e:
            return f"Error executing command: {e}"

    def _resolve_path(self, path: str) -> Path:
        return resolve_workspace_path(self.codebase_root, path)

    def _write_file(self, path: str, content: str) -> str:
        if not path:
            return "Error: 'path' argument is required for write_file"
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        rays_ui.print_step(f"Writing file: {path}")
        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content or "")
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
        rays_ui.print_step(f"Patching file: {path}")
        try:
            if not full_path.exists():
                return f"Error: File does not exist: {path}"
            content = full_path.read_text()
            if not search:
                return "Error: 'search' block is required for patch_file"
            if search not in content:
                return f"Error: Search block not found in {path}"
            
            new_content = content.replace(search, replace or "", 1)
            full_path.write_text(new_content)
            return f"File patched successfully: {path}"
        except Exception as e:
            return f"Error patching file: {e}"

    def _read_file(self, path: str) -> str:
        if not path:
            return "Error: 'path' argument is required for read_file"
        try:
            full_path = self._resolve_path(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            if not full_path.exists():
                return f"Error: File does not exist: {path}"
            return full_path.read_text()
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
