import os
import json
import time
import uuid

def generate_fake_agent_logs():
    """
    Generates fake RAYS CORE Agent Execution DAGs and drops them 
    into the daemon's listening directory to trigger autonomous fine-tuning.
    """
    log_dir = os.path.expanduser("~/.rays_core/logs/success/")
    os.makedirs(log_dir, exist_ok=True)
    
    print(f"Generating fake RAYS CORE agent logs in {log_dir}...")
    
    # Fake Task 1: OSINT Web Scraping
    task_1 = {
        "task_id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_query": "Find the latest statements by Company X regarding the merger.",
        "execution_dag": {
            "nodes": [
                {"step_id": 1, "type": "thought", "content": "I should use the search tool to find news about Company X merger."},
                {"step_id": 2, "type": "tool_call", "tool_name": "search_web", "parameters": {"query": "Company X merger news"}},
                {"step_id": 3, "type": "thought", "content": "I found 3 articles. I need to scrape the first one for direct statements."},
                {"step_id": 4, "type": "tool_call", "tool_name": "scrape_url", "parameters": {"url": "https://news.com/company-x"}}
            ]
        },
        "success_flag": True
    }
    
    # Fake Task 2: Code Bug Fixing
    task_2 = {
        "task_id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_query": "Fix the null pointer exception in auth.py.",
        "execution_dag": {
            "nodes": [
                {"step_id": 1, "type": "thought", "content": "I need to read auth.py to see where the user object is referenced before instantiation."},
                {"step_id": 2, "type": "tool_call", "tool_name": "read_file", "parameters": {"path": "src/auth.py"}},
                {"step_id": 3, "type": "thought", "content": "Line 42 assumes 'user' exists. I will add a None check."},
                {"step_id": 4, "type": "tool_call", "tool_name": "write_to_file", "parameters": {"path": "src/auth.py", "edits": "if user is None: return 401"}}
            ]
        },
        "success_flag": True
    }
    
    # Write Task 1
    t1_path = os.path.join(log_dir, f"log_{task_1['task_id']}.jsonl")
    with open(t1_path, 'w') as f:
        f.write(json.dumps(task_1) + "\n")
    print(f"Dropped Task 1 log: {t1_path}")
    
    # Write Task 2
    time.sleep(1) # stagger them
    t2_path = os.path.join(log_dir, f"log_{task_2['task_id']}.jsonl")
    with open(t2_path, 'w') as f:
        f.write(json.dumps(task_2) + "\n")
    print(f"Dropped Task 2 log: {t2_path}")
    
    print("\nFake logs generated successfully! If daemon.py or tui.py is running, it will automatically detect these and trigger the PyTorch training burst.")

if __name__ == "__main__":
    generate_fake_agent_logs()
