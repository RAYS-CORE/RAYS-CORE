"""Investigation Planner — dynamically decomposes goals into structured sub-tasks."""
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class InvestigationTask:
    task_id: str
    planner_type: str  # e.g., 'search', 'geo', 'media'
    objective: str
    required_evidence: List[str]
    status: str = "pending"
    results: List[Any] = field(default_factory=list)

class InvestigationPlanner:
    def __init__(self, ai_client):
        self.ai_client = ai_client
        self.active_tasks: List[InvestigationTask] = []
        self.completed_tasks: List[InvestigationTask] = []

    def decompose_goal(self, main_goal: str) -> List[InvestigationTask]:
        """Uses the AI client to break down the main goal into specific planner tasks."""
        prompt = f"""
You are an OSINT Investigation Task Scheduler.
Given the main goal: "{main_goal}"

Decompose this into a list of deterministic tasks, assigning each to a specific planner:
- search_planner: For text, names, social media, databases.
- geo_planner: For locations, coordinates, maps.
- media_planner: For images, facial recognition, video analysis.

Return JSON in this format:
{{
  "tasks": [
    {{
      "task_id": "task_1",
      "planner_type": "search_planner",
      "objective": "Find associated email addresses for John Doe",
      "required_evidence": ["email_address", "source_url"]
    }}
  ]
}}
"""
        response = self.ai_client.generate_json(prompt, system_prompt="You are a deterministic task scheduler. Only return JSON.")
        tasks_data = response.get("tasks", [])
        
        new_tasks = []
        for td in tasks_data:
            task = InvestigationTask(
                task_id=td.get("task_id", f"task_{len(self.active_tasks)}"),
                planner_type=td.get("planner_type", "search_planner"),
                objective=td.get("objective", ""),
                required_evidence=td.get("required_evidence", [])
            )
            new_tasks.append(task)
            self.active_tasks.append(task)
            
        return new_tasks

    def get_next_task(self) -> InvestigationTask:
        for task in self.active_tasks:
            if task.status == "pending":
                return task
        return None

    def complete_task(self, task_id: str, results: List[Any]):
        for task in self.active_tasks:
            if task.task_id == task_id:
                task.status = "completed"
                task.results = results
                self.completed_tasks.append(task)
                self.active_tasks.remove(task)
                break
