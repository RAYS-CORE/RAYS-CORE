import requests
import time
import json
import re
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from . import rays_ui

class AIClient:
    def __init__(self, config: Dict[str, Any]):
        self.provider = config['provider']
        self.model = config['model']
        self.base_url = config['base_url']
        self.api_key = config.get('api_key', '')
        self.delay = config.get('delay', 0.05)
        self.max_workers = 50
        self.num_ctx = config.get('num_ctx', 32768)  # Reduced default for local stability
        self._ollama_embedding_endpoint = None # Cache for working endpoint
    
    def is_available(self) -> bool:
        """Check if the AI provider is reachable"""
        if self.provider == "ollama":
            try:
                # Direct check to the base URL
                resp = requests.get(self.base_url, timeout=2)
                return resp.status_code == 200
            except:
                return False
        elif self.provider in ("gemini", "openai", "groq", "claude"):
            # For API-based models, we just check if API key exists (network check is expensive/unreliable here)
            return bool(self.api_key)
        return False
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate single embedding vector"""
        snippet = (text[:50] + "...") if len(text) > 50 else text
        rays_ui.log_model_interaction("Model Read (Embedding)", snippet)
        result = self.get_embeddings_batch([text])
        return result[0] if result else []
    
    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate batch embeddings using threading"""
        if self.provider == "ollama":
            return self._ollama_parallel(texts)
        elif self.provider == "gemini":
            return self._gemini_parallel(texts)
        elif self.provider in ("openai", "groq", "claude"):
            return self._openai_compatible_parallel(texts)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate text completion from LLM"""
        # Light throttle - only Groq free tier needs breathing room
        if self.provider == "groq":
            time.sleep(1.0)
        else:
            time.sleep(0.5)

        rays_ui.log_model_interaction("Thinking", "…")
        
        if self.provider == "ollama":
            response = self._ollama_generate(prompt, system_prompt)
        elif self.provider == "gemini":
            response = self._gemini_generate(prompt, system_prompt)
        elif self.provider in ("openai", "groq", "claude"):
            response = self._openai_compatible_generate(prompt, system_prompt)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
            
        rays_ui.log_model_interaction("Thinking", "…")

        # Symmetric post-call delay to space out consecutive prompts.
        if self.provider == "groq":
            time.sleep(1.0)
        else:
            time.sleep(0.2)
        return response
    
    def generate_json(self, prompt: str, system_prompt: Optional[str] = None, retry_count: int = 3) -> Dict[str, Any]:
        """
        Generate JSON response from LLM with automatic parsing and retry logic.
        
        Args:
            prompt: User prompt
            system_prompt: System instructions
            retry_count: Number of retry attempts if JSON parsing fails
        
        Returns:
            Parsed JSON dictionary
        """
        for attempt in range(retry_count):
            try:
                # Add JSON formatting instruction to prompt
                json_prompt = prompt + "\n\nYou MUST respond with valid JSON only. No explanations, no markdown code blocks, just raw JSON."
                
                response = self.generate_text(json_prompt, system_prompt)
                
                if not response or not response.strip():
                    raise ValueError("Model returned empty response. Retrying...")
                
                # Extract JSON from response (handles markdown code blocks)
                parsed_json = self._extract_json(response)
                
                if parsed_json:
                    return parsed_json
                else:
                    if attempt < retry_count - 1:
                        rays_ui.print_warning(f"JSON parsing failed, retrying ({attempt + 1}/{retry_count})...")
                        time.sleep(1)
                    else:
                        raise ValueError("Failed to parse JSON after multiple attempts")
            
            except Exception as e:
                if attempt < retry_count - 1:
                    rays_ui.print_warning(f"Retrying JSON generation ({attempt + 1}/{retry_count})...")
                    time.sleep(2)
                else:
                    # Don't raise - return empty dict so orchestrator can handle gracefully
                    rays_ui.print_warning(f"JSON generation failed after {retry_count} attempts: {str(e)[:100]}")
                    return {}
        
        return {}
    
    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON from text (handles markdown code blocks and malformed JSON)"""
        def clean_json(s):
            # Remove markdown logic if present
            s = re.sub(r'```(?:json)?\s*', '', s)
            s = s.strip('`').strip()
            # Remove trailing commas in objects and arrays
            s = re.sub(r',\s*([\]}])', r'\1', s)
            # Remove comments (single line // or hash #)
            s = re.sub(r'^\s*//.*$', '', s, flags=re.MULTILINE)
            s = re.sub(r'^\s*#.*$', '', s, flags=re.MULTILINE)
            return s

        # Strategy 1: Look for { ... } code blocks first (often the cleanest)
        json_blocks = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        for block in json_blocks:
            try:
                return json.loads(clean_json(block))
            except json.JSONDecodeError:
                continue

        # Strategy 2: Look for any curly brace structure
        # Use a more aggressive pattern for finding the outermost { }
        try:
            start_idx = text.find('{')
            end_idx = text.rfind('}')
            if start_idx != -1 and end_idx != -1:
                candidate = text[start_idx:end_idx+1]
                return json.loads(clean_json(candidate))
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 3: Regex fallback for smaller objects
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.findall(json_pattern, text, re.DOTALL)
        for match in matches:
            try:
                return json.loads(clean_json(match))
            except json.JSONDecodeError:
                continue
        
        return None
    
    def extract_code_block(self, text: str, language: str = "python") -> str:
        """Extract code from markdown blocks or raw text with fallback."""
        # Strategy 1: Look for markdown code blocks
        patterns = [
            rf'```(?:{language})?\s*(.*?)\s*```',
            r'```\s*(.*?)\s*```',
            r'CODE_START\s*(.*?)\s*CODE_END',
            r'SOURCE_START\s*(.*?)\s*SOURCE_END'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                return match.group(1).strip()
        
        # Strategy 2: If no blocks but looks like raw code, return as is (minus leading/trailing junk)
        if text.strip().startswith(('def ', 'import ', 'class ', 'from ')):
             # Strip common preamble like "Here is the code:"
             lines = text.strip().split('\n')
             start_idx = 0
             for i, line in enumerate(lines):
                 if line.strip().startswith(('def ', 'import ', 'class ', 'from ')):
                     start_idx = i
                     break
             return '\n'.join(lines[start_idx:]).strip()

        return text.strip()
    
    # ========== OLLAMA METHODS ==========
    
    def _ollama_generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate text using Ollama"""
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_ctx": self.num_ctx,
                "num_predict": 16384,  # Safety limit to prevent infinite loops
                "stop": ["```\n", "}\n\n", "PROMPT_END"]
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        try:
            # Use streaming internally to show progress if needed, but for now just handle the large response better
            payload["stream"] = True
            response = requests.post(url, json=payload, timeout=3600, stream=True)
            response.raise_for_status()
            
            full_response = ""
            prompt_tokens = 0
            completion_tokens = 0
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    text = chunk.get('response', '')
                    full_response += text
                    if chunk.get('done'):
                        prompt_tokens = int(
                            chunk.get('prompt_eval_count')
                            or chunk.get('prompt_tokens')
                            or 0
                        )
                        completion_tokens = int(
                            chunk.get('eval_count')
                            or chunk.get('completion_tokens')
                            or 0
                        )
                        break
            total = prompt_tokens + completion_tokens
            if total > 0:
                rays_ui.hud_add_tokens(total)
            elif full_response or prompt:
                rays_ui.hud_add_tokens(
                    max(1, len(prompt) // 4) + max(1, len(full_response) // 4)
                )
            return full_response
        except Exception as e:
            rays_ui.print_exception(e)
            return ""
    
    def _ollama_parallel(self, texts: List[str]) -> List[List[float]]:
        """Ollama parallel embedding"""
        def embed_single(text):
            # Check cache first
            if self._ollama_embedding_endpoint:
                try:
                    payload = {"model": self.model, "input": text} if "embed" in self._ollama_embedding_endpoint.split('/')[-1] else {"model": self.model, "prompt": text}
                    if "embeddings" in self._ollama_embedding_endpoint:
                        payload = {"model": self.model, "prompt": text}
                    else:
                        payload = {"model": self.model, "input": text}
                        
                    response = requests.post(self._ollama_embedding_endpoint, json=payload, timeout=600)
                    response.raise_for_status()
                    result = response.json()
                    return result.get('embedding') or result.get('embeddings', [[]])[0]
                except Exception:
                    pass # Fallback to discovery if cache fails
            
            # Discovery Phase
            endpoints = [f"{self.base_url}/api/embed", f"{self.base_url}/api/embeddings"]
            
            for endpoint in endpoints:
                try:
                    time.sleep(0.01)
                    if "embeddings" in endpoint:
                        payload = {"model": self.model, "prompt": text}
                    else:
                        payload = {"model": self.model, "input": text}
                        
                    response = requests.post(endpoint, json=payload, timeout=600) # Increased timeout
                    if response.status_code in [404, 501]: 
                        continue
                    
                    response.raise_for_status()
                    result = response.json()
                    
                    if 'embedding' in result or 'embeddings' in result:
                        self._ollama_embedding_endpoint = endpoint # Cache it!
                        return result.get('embedding') or result.get('embeddings', [[]])[0]
                except Exception:
                    continue
            return []
        
        results = [[] for _ in texts]
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_idx = {executor.submit(embed_single, text): idx for idx, text in enumerate(texts)}
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                res = future.result()
                results[idx] = res if res is not None else []
        
        return results
    
    # ========== GEMINI METHODS ==========
    
    def _gemini_generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate text using Gemini"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": system_prompt}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        
        payload = {"contents": contents}
        
        try:
            response = requests.post(url, json=payload, timeout=3600)
            response.raise_for_status()
            data = response.json()
            usage = data.get("usageMetadata") or {}
            total = int(usage.get("promptTokenCount") or 0) + int(
                usage.get("candidatesTokenCount") or 0
            )
            if total > 0:
                rays_ui.hud_add_tokens(total)
            elif prompt:
                rays_ui.hud_add_tokens(max(1, len(prompt) // 4))
            return data['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            rays_ui.print_exception(e)
            return ""
    
    def _gemini_parallel(self, texts: List[str]) -> List[List[float]]:
        """Gemini parallel embedding"""
        def embed_single(text):
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:embedContent?key={self.api_key}"
                payload = {"content": {"parts": [{"text": text}]}}
                response = requests.post(url, json=payload, timeout=120)
                response.raise_for_status()
                return response.json()['embedding']['values']
            except Exception as e:
                rays_ui.print_exception(e)
                return []
        
        results = [[] for _ in texts]
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_idx = {executor.submit(embed_single, text): idx for idx, text in enumerate(texts)}
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                res = future.result()
                results[idx] = res if res is not None else []
        
        return results

    # ========== OPENAI/GROQ/CLAUDE METHODS ==========
     
    def _truncate_prompt_for_groq(self, prompt: str, max_chars: int = 5000) -> str:
        """Truncate large dynamic sections for Groq's free tier 6000 TPM limit.
        
        Strategy: ALWAYS preserve the start (role/user prompt) and the END 
        (AVAILABLE TOOLS + RESPOND WITH JSON schema). Only trim the middle.
        Groq free tier: ~4 chars per token => 5000 chars = ~1250 tokens.
        """
        if len(prompt) <= max_chars:
            return prompt
        
        # Reserve space for start and end
        HEAD_CHARS = 800   # Keep role definition + user prompt
        TAIL_CHARS = 1200  # Keep AVAILABLE TOOLS + RESPOND WITH JSON schema
        
        if len(prompt) <= HEAD_CHARS + TAIL_CHARS:
            return prompt  # Already small enough
        
        head = prompt[:HEAD_CHARS]
        tail = prompt[-TAIL_CHARS:]
        middle = prompt[HEAD_CHARS:-TAIL_CHARS]
        
        # How much middle can we keep?
        middle_budget = max_chars - HEAD_CHARS - TAIL_CHARS - 60  # 60 for separator
        
        if middle_budget <= 0:
            return head + "\n[...context truncated for token limit...]\n" + tail
        
        trim_rules = {
            "**YOUR SESSION SO FAR": {"type": "tail", "budget": 3000},
            "**SKILL DEFINITION (SKILL.md):**": {"type": "head", "budget": 3000},
            "**PRIOR SUB-AGENT RUNS (full transcripts):**": {"type": "head", "budget": 1000},
            "**FULL EXECUTION TRANSCRIPTS": {"type": "head", "budget": 1000},
            "**AVAILABLE SKILLS:**": {"type": "head", "budget": 5000},
            "**MCP TOOL CATALOG": {"type": "head", "budget": 2000},
        }
        
        trimmed_middle = middle
        for marker, rule in trim_rules.items():
            if len(trimmed_middle) <= middle_budget:
                break
            idx = trimmed_middle.find(marker)
            if idx == -1:
                continue
            next_section = trimmed_middle.find("\n**", idx + len(marker))
            
            content_start = idx + len(marker)
            if next_section == -1:
                section_content = trimmed_middle[content_start:]
                rest = ""
            else:
                section_content = trimmed_middle[content_start:next_section]
                rest = trimmed_middle[next_section:]
                
            budget = rule["budget"]
            if len(section_content) > budget:
                if rule["type"] == "tail":
                    section_content = "\n[...truncated...]\n" + section_content[-budget:]
                else:
                    section_content = section_content[:budget] + "\n[...truncated...]\n"
            
            trimmed_middle = trimmed_middle[:idx] + marker + "\n" + section_content + rest
        
        # Final cut on middle if still too long
        if len(trimmed_middle) > middle_budget:
            trimmed_middle = trimmed_middle[:middle_budget] + "\n[...truncated...]\n"
        
        return head + trimmed_middle + tail

    def _openai_compatible_generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate text using OpenAI-compatible API (OpenAI, Groq, Anthropic etc.)"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Adjust base URL
        if self.provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
        elif self.provider == "groq":
            url = "https://api.groq.com/openai/v1/chat/completions"
        elif self.provider == "claude":
            url = "https://api.anthropic.com/v1/messages"
            headers["x-api-key"] = self.api_key
            headers["anthropic-version"] = "2023-06-01"
            if "Authorization" in headers:
                del headers["Authorization"]
        else:
            url = self.base_url

        # Truncate prompt for Groq free tier TPM limits
        if self.provider == "groq":
            prompt = self._truncate_prompt_for_groq(prompt, max_chars=15000)

        if self.provider == "claude":
            payload = {
                "model": self.model,
                "max_tokens": 8192,
                "messages": [{"role": "user", "content": prompt}]
            }
            if system_prompt:
                payload["system"] = system_prompt
        else:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.2
            }
            if "You MUST respond with valid JSON only." in prompt and self.provider in ("groq", "openai"):
                payload["response_format"] = {"type": "json_object"}
        
        for attempt in range(5):
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=3600)
                response.raise_for_status()
                data = response.json()
                
                if self.provider == "claude":
                    usage = data.get("usage") or {}
                    total = int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0)
                    if total > 0:
                        rays_ui.hud_add_tokens(total)
                    return data['content'][0]['text']
                else:
                    usage = data.get("usage") or {}
                    total = int(usage.get("total_tokens") or 0)
                    if total > 0:
                        rays_ui.hud_add_tokens(total)
                    elif prompt:
                        rays_ui.hud_add_tokens(max(1, len(prompt) // 4))
                    return data['choices'][0]['message']['content']
            except requests.exceptions.HTTPError as e:
                error_msg = f"HTTP {e.response.status_code}: {e.response.text}"
                if e.response.status_code == 429:
                    text_lower = e.response.text.lower()
                    
                    # Check if it's an absolute size limit vs a rate limit
                    if "too large" in text_lower or ("requested" in text_lower and "exceeds" in text_lower):
                        rays_ui.print_warning(f"\n[ERROR] Prompt is too large for Groq free tier: {error_msg}")
                        return '{"error": "Context window exceeded TPM limits", "status": "failed", "capabilities": [], "skills_to_use": [], "mcp_servers_to_use": []}'
                    
                    # It's a standard rate limit - extract wait time and sleep
                    wait_time = 30.0 # Default fallback
                    match = re.search(r'try again in (\d+\.?\d*)s', text_lower)
                    if match:
                        wait_time = float(match.group(1)) + 1.0 # Add 1s buffer
                        
                    rays_ui.print_warning(f"Rate limit hit. Sleeping for {wait_time:.1f}s and retrying ({attempt+1}/5)...")
                    time.sleep(wait_time)
                    continue # Retry the loop
                else:
                    rays_ui.print_warning(f"API Error: {error_msg}")
                    raise e
        
        rays_ui.print_warning("Failed after 5 rate limit retries.")
        raise Exception("Rate limit retries exhausted")

    def _openai_compatible_parallel(self, texts: List[str]) -> List[List[float]]:
        """Parallel embeddings (OpenAI compatible)"""
        # Usually OpenAI provides an embeddings endpoint
        if self.provider == "claude":
            # Anthropic doesn't have an embedding endpoint natively in the same way, return mock or fallback
            return [[] for _ in texts]
            
        def embed_single(text):
            try:
                url = "https://api.openai.com/v1/embeddings" if self.provider == "openai" else "https://api.groq.com/openai/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "text-embedding-3-small" if self.provider == "openai" else self.model,
                    "input": text
                }
                response = requests.post(url, headers=headers, json=payload, timeout=120)
                response.raise_for_status()
                return response.json()['data'][0]['embedding']
            except Exception as e:
                return []
                
        results = [[] for _ in texts]
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_idx = {executor.submit(embed_single, text): idx for idx, text in enumerate(texts)}
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                res = future.result()
                results[idx] = res if res is not None else []
        return results
