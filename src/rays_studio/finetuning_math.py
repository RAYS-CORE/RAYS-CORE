import os
import time
import json
import glob
import subprocess
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import get_peft_model, LoraConfig, TaskType
except ImportError:
    torch = None

class FinetuningEngine:
    def __init__(self):
        self.output_dir = os.path.expanduser("~/.rays_core/models/")
        os.makedirs(self.output_dir, exist_ok=True)

    def _calculate_perpendicular_layers(self, vram_gb: float) -> int:
        if vram_gb <= 8.0:
            return min(2, max(1, int(vram_gb // 4)))
        return max(1, int(vram_gb // 2))

    def _compile_to_gguf(self, hf_dir: str, model_name: str, suffix: str) -> str:
        safe_repo_name = model_name.replace("/", "_")
        out_name = f"compiled_{safe_repo_name}_{suffix}_{int(time.time())}.gguf"
        out_path = os.path.join(self.output_dir, out_name)
        
        print(f"[MATH ENGINE] Compiling tensors from {hf_dir} -> {out_path} via llama.cpp...")
        convert_script = os.path.expanduser("~/.rays_core/llama.cpp/convert_hf_to_gguf.py")
        if not os.path.exists(convert_script):
            raise Exception("llama.cpp conversion script not found.")
            
        subprocess.run(["python", convert_script, hf_dir, "--outfile", out_path], check=True)
        return out_path

    def finetune_local(self, model_name: str, safetensors_path: str, vram_gb: float) -> str:
        print(f"\n--- Starting Real PyTorch Fine-Tuning for {model_name} ---")
        if torch is None:
            raise Exception("PyTorch or transformers not installed.")
            
        num_layers = self._calculate_perpendicular_layers(vram_gb)
        
        # We use the user-selected model path instead of a hardcoded string
        expanded_path = os.path.expanduser(safetensors_path)
        print(f"[MATH ENGINE] Loading {model_name} weights from {expanded_path} into memory...")
        
        tokenizer = AutoTokenizer.from_pretrained(expanded_path)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        model = AutoModelForCausalLM.from_pretrained(expanded_path, torch_dtype=torch.float16, device_map="auto")
        
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=8,
            lora_alpha=32,
            lora_dropout=0.1
        )
        model = get_peft_model(model, peft_config)
        
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
        
        # Load Logs
        convo_dir = os.path.expanduser("~/.rays/conversations/")
        jsonl_files = glob.glob(os.path.join(convo_dir, "*", "execution_graphs.jsonl"))
        
        print(f"[MATH ENGINE] Extracted {len(jsonl_files)} execution graphs. Training...")
        model.train()
        
        for file in jsonl_files:
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    for line in f:
                        data = json.loads(line)
                        intent = data.get("intent", "")
                        # Check if response is pre-baked (like our synthetic data) or derive from dag
                        response = data.get("response", "")
                        if not response:
                            nodes = data.get("dag_nodes", [])
                            for node in nodes:
                                response += f" [Action: {node['tool']} -> Output: {node['output']}]"
                                
                        text = f"<|im_start|>user\n{intent}<|im_end|>\n<|im_start|>assistant\n{response}<|im_end|>"
                            
                        inputs = tokenizer(text, return_tensors="pt")
                        inputs = {k: v.to(model.device) for k, v in inputs.items()}
                        
                        print(f"[MATH ENGINE] Overfitting on conversation: {intent}")
                        for epoch in range(30):
                            outputs = model(**inputs, labels=inputs["input_ids"])
                            loss = outputs.loss
                            loss.backward()
                            optimizer.step()
                            optimizer.zero_grad()
                            if epoch % 5 == 0:
                                print(f"[MATH ENGINE] Epoch {epoch} Loss: {loss.item():.4f}")
            except Exception as e:
                print(f"[MATH ENGINE] Failed to parse/train on {file}: {e}")
                
        # Merge and Save
        print("[MATH ENGINE] Merging adapters into base model...")
        merged_model = model.merge_and_unload()
        hf_out_dir = os.path.join(self.output_dir, "qwen_tuned_hf")
        merged_model.save_pretrained(hf_out_dir)
        tokenizer.save_pretrained(hf_out_dir)
        
        print("[MATH ENGINE] PyTorch fine-tuning complete. Proceeding to GGUF conversion.")
        return self._compile_to_gguf(hf_out_dir, model_name, "local_tuned")

    def finetune_memory(self, model_name: str, safetensors_path: str, vram_gb: float) -> str:
        return ""
    def finetune_server(self, model_name: str, safetensors_path: str, vram_gb: float, hardware_info: dict) -> str:
        return ""
