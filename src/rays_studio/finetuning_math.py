import os
import time
import json
import glob
import subprocess
try:
    from tqdm import tqdm
except ImportError:
    tqdm = lambda x, **kwargs: x

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import get_peft_model, LoraConfig, TaskType
except ImportError:
    torch = None

class FinetuningEngine:
    def __init__(self):
        self.output_dir = os.path.expanduser("~/.rays/models/")
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
        convert_script = os.path.expanduser("~/.rays/llama.cpp/convert_hf_to_gguf.py")
        if not os.path.exists(convert_script):
            raise RuntimeError(f"[MATH ENGINE] llama.cpp conversion script not found at {convert_script}")
            
        subprocess.run(["python", convert_script, hf_dir, "--outfile", out_path], check=True)
        return out_path

    def finetune_unified(self, model_name: str, safetensors_path: str, vram_gb: float, svd_constraints: dict = None) -> str:
        print(f"\n--- Starting FOGR Unified PyTorch Fine-Tuning for {model_name} ---")
        if torch is None:
            raise ImportError("PyTorch and transformers must be installed to run mathematical finetuning.")
            
        num_layers = self._calculate_perpendicular_layers(vram_gb)
        
        expanded_path = os.path.expanduser(safetensors_path)
        print(f"[MATH ENGINE] Loading {model_name} weights from {expanded_path} into memory...")
        
        tokenizer = AutoTokenizer.from_pretrained(expanded_path)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = AutoModelForCausalLM.from_pretrained(expanded_path, torch_dtype=torch.float16)
        model = model.to(device)

        # Apply SVD constraint math if provided by the Server Hub
        target_modules = ["q_proj", "v_proj"]
        lora_r = 8
        lora_dropout = 0.1
        
        if svd_constraints:
            print(f"[MATH ENGINE] Applying Federated SVD Constraints: {svd_constraints}")
            if svd_constraints.get("vram_class") == "low":
                lora_r = 4
                target_modules = ["q_proj"]
            elif svd_constraints.get("vram_class") == "high":
                lora_r = 16
                target_modules = ["q_proj", "k_proj", "v_proj", "o_proj"]
        else:
            print("[MATH ENGINE] No SVD constraints provided. Training fully locally.")

        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=lora_r,
            lora_alpha=32,
            lora_dropout=lora_dropout,
            target_modules=target_modules
        )
        model = get_peft_model(model, peft_config)
        
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
        
        # Load Logs for both Reasoning (Graphs) and Memory (Retrievals)
        convo_dir = os.path.expanduser("~/.rays/conversations/")
        graph_files = glob.glob(os.path.join(convo_dir, "*", "execution_graphs.jsonl"))
        memory_files = glob.glob(os.path.join(convo_dir, "*", "memory_retrievals.jsonl"))
        
        all_training_files = graph_files + memory_files
        print(f"[MATH ENGINE] Extracted {len(graph_files)} reasoning graphs and {len(memory_files)} memory logs. Training Unified Pipeline...")
        model.train()
        
        for file in all_training_files:
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    for line in f:
                        data = json.loads(line)
                        intent = data.get("intent", data.get("query", ""))
                        
                        response = data.get("response", "")
                        if not response:
                            if "dag_nodes" in data:
                                # Reasoning path
                                nodes = data.get("dag_nodes", [])
                                for node in nodes:
                                    response += f" [Action: {node['tool']} -> Output: {node['output']}]"
                            elif "retrieval_results" in data:
                                # Memory path
                                results = data.get("retrieval_results", [])
                                response = "Based on my long-term memory:\n" + "\n".join(results)
                                
                        text = f"<|im_start|>user\n{intent}<|im_end|>\n<|im_start|>assistant\n{response}<|im_end|>"
                            
                        inputs = tokenizer(text, return_tensors="pt")
                        inputs = {k: v.to(model.device) for k, v in inputs.items()}
                        
                        print(f"[MATH ENGINE] Optimizing (Loss minimization): {intent[:30]}...")
                        for epoch in tqdm(range(15), desc="Fine-tuning Epochs", unit="epoch"):
                            outputs = model(**inputs, labels=inputs["input_ids"])
                            loss = outputs.loss
                            loss.backward()
                            optimizer.step()
                            optimizer.zero_grad()
                            if epoch % 5 == 0:
                                print(f"[MATH ENGINE] Epoch {epoch} Loss: {loss.item():.4f}")
                        outputs = model(**inputs, labels=inputs["input_ids"])
                        loss = outputs.loss
                        loss.backward()
                        optimizer.step()
                        optimizer.zero_grad()
            except Exception as e:
                print(f"[MATH ENGINE] Failed to parse/train on {file}: {e}")
                
        # Merge and Save
        print("[MATH ENGINE] Merging SVD-constrained adapters into base model...")
        merged_model = model.merge_and_unload()
        
        # Save newly tuned huggingface model locally so we can convert it to GGUF
        hf_out_dir = os.path.join(self.output_dir, f"tuned_{model_name.replace('/', '_')}")
        os.makedirs(hf_out_dir, exist_ok=True)
        print(f"[MATH ENGINE] Saving tuned PyTorch weights to {hf_out_dir}...")
        merged_model.save_pretrained(hf_out_dir, safe_serialization=True)
        tokenizer.save_pretrained(hf_out_dir)
        
        return self._compile_to_gguf(hf_out_dir, model_name, "unified_tuned")

    def finetune_local(self, model_name: str, safetensors_path: str, vram_gb: float) -> str:
        return self.finetune_unified(model_name, safetensors_path, vram_gb)

    def finetune_memory(self, model_name: str, safetensors_path: str, vram_gb: float) -> str:
        return self.finetune_unified(model_name, safetensors_path, vram_gb)

    def finetune_server(self, model_name: str, safetensors_path: str, vram_gb: float, hardware_info: dict) -> str:
        # Simulate server constraint generation based on hw_info
        svd_constraints = {"vram_class": "low" if vram_gb <= 8.0 else "high"}
        return self.finetune_unified(model_name, safetensors_path, vram_gb, svd_constraints)
