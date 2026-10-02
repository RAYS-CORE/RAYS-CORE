"""
RAYS Voice TTS (Text-to-Speech) Module
Cross-platform, multi-provider TTS with the same waterfall architecture as the STT module.

Provider waterfall (tries in order):
1. Edge TTS    — Free, Microsoft neural voices, no API key (pip install edge-tts)
2. OpenAI TTS  — tts-1 / tts-1-hd, needs OPENAI_API_KEY
3. ElevenLabs  — Premium voices, needs ELEVENLABS_API_KEY
4. pyttsx3     — Fully offline, zero dependencies, works on any OS
5. System TTS  — OS say/espeak/SAPI fallback

All providers return base64-encoded MP3/WAV audio that the browser can play directly.
Cross-platform: Windows, macOS, Linux.
"""

import asyncio
import base64
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional


# ── Helpers ────────────────────────────────────────────────────────────────────

def _log(msg: str) -> None:
    """Log to stderr so it doesn't corrupt JSON stdout."""
    try:
        print(f"[RAYS-TTS] {msg}", file=sys.stderr, flush=True)
    except Exception:
        pass


def _find_ffmpeg() -> Optional[str]:
    """Find ffmpeg binary cross-platform."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    system = platform.system()
    candidates: List[str] = []
    if system == "Darwin":
        candidates = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
    elif system == "Windows":
        candidates = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            os.path.join(os.path.expanduser("~"), "scoop", "shims", "ffmpeg.exe"),
        ]
    else:
        candidates = ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


FFMPEG_PATH = _find_ffmpeg()


def _sanitize_text(text: str) -> str:
    """Strip markdown/code so TTS speaks naturally — same approach as Hermes tts_text_normalize."""
    # Remove code blocks entirely
    text = re.sub(r"```[\s\S]*?```", "Code block omitted.", text)
    # Inline code → plain text
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)
    # Markdown links → label only
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove markdown formatting chars
    text = re.sub(r"[*_#~>|]", "", text)
    # Collapse whitespace
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def _mp3_to_b64(path: str) -> Optional[str]:
    """Read an audio file and return base64 string."""
    try:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")
    except Exception as e:
        _log(f"Failed to read audio file {path}: {e}")
        return None


def _wav_to_mp3(wav_path: str, mp3_path: str) -> bool:
    """Convert WAV to MP3 using ffmpeg (needed for pyttsx3 / system TTS output)."""
    ffmpeg = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    try:
        res = subprocess.run(
            [ffmpeg, "-y", "-i", wav_path, "-q:a", "4", mp3_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15,
        )
        return res.returncode == 0 and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0
    except Exception as e:
        _log(f"ffmpeg WAV→MP3 failed: {e}")
        return False


# ── Provider 1: Edge TTS (FREE — Microsoft Neural voices) ─────────────────────

def _try_edge_tts(text: str, out_mp3: str, voice: str = "en-US-AriaNeural", speed: float = 1.0) -> bool:
    """
    Use edge-tts (pip install edge-tts) — the same free default Hermes uses.
    Voices: en-US-AriaNeural (female), en-US-GuyNeural (male), en-GB-SoniaNeural, etc.
    Full list: edge-tts --list-voices
    """
    try:
        import edge_tts  # type: ignore

        rate_str = "+0%"
        if speed != 1.0:
            pct = int((speed - 1.0) * 100)
            rate_str = f"{pct:+d}%"

        async def _run():
            communicate = edge_tts.Communicate(text, voice, rate=rate_str)
            await communicate.save(out_mp3)

        try:
            asyncio.run(_run())
        except RuntimeError:
            # Event loop already running (e.g. Jupyter) — use thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pool.submit(asyncio.run, _run()).result(timeout=30)

        success = os.path.exists(out_mp3) and os.path.getsize(out_mp3) > 0
        if success:
            _log(f"Edge TTS OK: {voice} → {os.path.getsize(out_mp3)} bytes")
        return success
    except ImportError:
        _log("edge-tts not installed — pip install edge-tts")
        return False
    except Exception as e:
        _log(f"Edge TTS error: {e}")
        return False


# ── Provider 2: OpenAI TTS ────────────────────────────────────────────────────

def _try_openai_tts(text: str, out_mp3: str, voice: str = "alloy", model: str = "tts-1") -> bool:
    """
    OpenAI TTS (tts-1 or tts-1-hd). Needs OPENAI_API_KEY.
    Voices: alloy, echo, fable, onyx, nova, shimmer
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return False
    try:
        import urllib.request

        payload = json.dumps({"model": model, "input": text, "voice": voice}).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=payload, method="POST",
        )
        req.add_header("Authorization", f"Bearer {api_key}")
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=20) as resp:
            audio_bytes = resp.read()

        if not audio_bytes:
            return False

        with open(out_mp3, "wb") as f:
            f.write(audio_bytes)

        success = os.path.getsize(out_mp3) > 0
        if success:
            _log(f"OpenAI TTS OK: {model}/{voice} → {len(audio_bytes)} bytes")
        return success
    except ImportError:
        return False
    except Exception as e:
        _log(f"OpenAI TTS error: {e}")
        return False


# ── Provider 3: ElevenLabs ────────────────────────────────────────────────────

def _try_elevenlabs_tts(text: str, out_mp3: str, voice_id: str = "pNInz6obpgDQGcFmaJgB") -> bool:
    """
    ElevenLabs TTS. Needs ELEVENLABS_API_KEY.
    Default voice: Adam (pNInz6obpgDQGcFmaJgB)
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return False
    try:
        import urllib.request

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        payload = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }).encode()

        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("xi-api-key", api_key)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "audio/mpeg")

        with urllib.request.urlopen(req, timeout=20) as resp:
            audio_bytes = resp.read()

        if not audio_bytes:
            return False

        with open(out_mp3, "wb") as f:
            f.write(audio_bytes)

        success = os.path.getsize(out_mp3) > 0
        if success:
            _log(f"ElevenLabs TTS OK → {len(audio_bytes)} bytes")
        return success
    except Exception as e:
        _log(f"ElevenLabs TTS error: {e}")
        return False


# ── Provider 4: pyttsx3 (fully offline, any OS) ───────────────────────────────

def _try_pyttsx3_tts(text: str, out_wav: str) -> bool:
    """
    pyttsx3 — zero-dependency offline TTS.
    Windows: SAPI5 | macOS: NSSpeechSynthesizer | Linux: espeak
    pip install pyttsx3
    """
    try:
        import pyttsx3  # type: ignore
        engine = pyttsx3.init()
        engine.setProperty("rate", 175)   # words per minute
        engine.setProperty("volume", 1.0)

        # Pick the best English voice available
        voices = engine.getProperty("voices")
        english_voices = [v for v in voices if "en" in (v.languages[0].decode() if isinstance(v.languages[0], bytes) else v.languages[0]).lower()] if voices else []
        if english_voices:
            engine.setProperty("voice", english_voices[0].id)

        engine.save_to_file(text, out_wav)
        engine.runAndWait()
        engine.stop()

        success = os.path.exists(out_wav) and os.path.getsize(out_wav) > 0
        if success:
            _log(f"pyttsx3 TTS OK → {os.path.getsize(out_wav)} bytes WAV")
        return success
    except ImportError:
        _log("pyttsx3 not installed — pip install pyttsx3")
        return False
    except Exception as e:
        _log(f"pyttsx3 TTS error: {e}")
        return False


# ── Provider 5: System TTS (OS-native fallback) ───────────────────────────────

def _try_system_tts(text: str, out_wav: str) -> bool:
    """
    OS-native TTS fallback — no packages needed.
    macOS: say | Linux: espeak / espeak-ng | Windows: PowerShell SAPI
    """
    system = platform.system()
    try:
        if system == "Darwin":
            # macOS 'say' command — built-in, always available
            res = subprocess.run(
                ["say", "-o", out_wav, "--data-format=LEF32@22050", text],
                capture_output=True, timeout=30,
            )
            if res.returncode != 0:
                # Try AIFF then convert
                aiff = out_wav.replace(".wav", ".aiff")
                subprocess.run(["say", "-o", aiff, text], capture_output=True, timeout=30)
                if os.path.exists(aiff) and FFMPEG_PATH:
                    subprocess.run(
                        [FFMPEG_PATH, "-y", "-i", aiff, out_wav],
                        capture_output=True, timeout=15,
                    )
                    try:
                        os.unlink(aiff)
                    except Exception:
                        pass
        elif system == "Linux":
            # espeak-ng (most common on Linux)
            espeak = shutil.which("espeak-ng") or shutil.which("espeak")
            if not espeak:
                return False
            subprocess.run(
                [espeak, "-w", out_wav, "-s", "160", text],
                capture_output=True, timeout=30,
            )
        elif system == "Windows":
            # PowerShell SAPI5 — always available on Windows
            ps_script = (
                f"Add-Type -AssemblyName System.Speech; "
                f"$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$synth.SetOutputToWaveFile('{out_wav}'); "
                f"$synth.Speak('{text.replace(chr(39), '')}'); "
                f"$synth.Dispose()"
            )
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True, timeout=30,
            )
        else:
            return False

        success = os.path.exists(out_wav) and os.path.getsize(out_wav) > 0
        if success:
            _log(f"System TTS OK ({system}) → {os.path.getsize(out_wav)} bytes")
        return success
    except Exception as e:
        _log(f"System TTS error ({system}): {e}")
        return False


# ── Main synthesize function ───────────────────────────────────────────────────

def synthesize_speech(
    text: str,
    provider: Optional[str] = None,
    voice: Optional[str] = None,
    speed: float = 1.0,
) -> Dict[str, Any]:
    """
    Synthesize speech using the best available provider.
    Returns: {"success": bool, "audioBase64": str, "mimeType": str, "provider": str, "error": str}

    Provider waterfall (auto-selected unless 'provider' is specified):
      1. edge     — Free, Microsoft neural voices (pip install edge-tts)
      2. openai   — OpenAI TTS (needs OPENAI_API_KEY)
      3. elevenlabs — ElevenLabs (needs ELEVENLABS_API_KEY)
      4. pyttsx3  — Fully offline (pip install pyttsx3)
      5. system   — OS built-in (say/espeak/PowerShell SAPI)
    """
    text = _sanitize_text(text)
    if not text:
        return {"success": False, "audioBase64": "", "mimeType": "audio/mp3", "provider": "", "error": "Text is empty after sanitization"}

    # Determine which provider to try
    explicit = (provider or "").lower().strip()
    waterfall = (
        [explicit] if explicit else
        ["edge", "openai", "elevenlabs", "pyttsx3", "system"]
    )

    tmp_mp3 = None
    tmp_wav = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_mp3 = f.name
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp_wav = f.name

        for p in waterfall:
            success = False
            out_file = tmp_mp3
            mime = "audio/mpeg"

            if p == "edge":
                v = voice or "en-US-AriaNeural"
                success = _try_edge_tts(text, tmp_mp3, voice=v, speed=speed)

            elif p == "openai":
                v = voice or "alloy"
                success = _try_openai_tts(text, tmp_mp3, voice=v)

            elif p == "elevenlabs":
                v = voice or "pNInz6obpgDQGcFmaJgB"
                success = _try_elevenlabs_tts(text, tmp_mp3, voice_id=v)

            elif p == "pyttsx3":
                if _try_pyttsx3_tts(text, tmp_wav):
                    # Convert WAV → MP3 for uniform browser playback
                    if _wav_to_mp3(tmp_wav, tmp_mp3):
                        success = True
                        out_file = tmp_mp3
                    else:
                        # No ffmpeg — serve raw WAV
                        success = os.path.exists(tmp_wav) and os.path.getsize(tmp_wav) > 0
                        out_file = tmp_wav
                        mime = "audio/wav"

            elif p == "system":
                if _try_system_tts(text, tmp_wav):
                    if _wav_to_mp3(tmp_wav, tmp_mp3):
                        success = True
                        out_file = tmp_mp3
                    else:
                        success = os.path.exists(tmp_wav) and os.path.getsize(tmp_wav) > 0
                        out_file = tmp_wav
                        mime = "audio/wav"

            if success:
                b64 = _mp3_to_b64(out_file)
                if b64:
                    _log(f"TTS done via '{p}': {len(b64)} chars base64")
                    return {
                        "success": True,
                        "audioBase64": b64,
                        "mimeType": mime,
                        "provider": p,
                        "error": "",
                    }

        return {
            "success": False,
            "audioBase64": "",
            "mimeType": "audio/mpeg",
            "provider": "",
            "error": (
                "No TTS provider available. Install one of:\n"
                "  pip install edge-tts        # Free, best quality\n"
                "  pip install pyttsx3         # Offline, no API key\n"
                "Or set OPENAI_API_KEY / ELEVENLABS_API_KEY environment variable."
            ),
        }

    finally:
        for p in [tmp_mp3, tmp_wav]:
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except Exception:
                    pass


def list_edge_voices() -> Dict[str, Any]:
    """List all available Edge TTS voices (async)."""
    try:
        import edge_tts  # type: ignore

        async def _list():
            return await edge_tts.list_voices()

        try:
            voices = asyncio.run(_list())
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                voices = pool.submit(asyncio.run, _list()).result(timeout=10)

        en_voices = [
            {"name": v["ShortName"], "gender": v["Gender"], "locale": v["Locale"]}
            for v in voices
            if v.get("Locale", "").startswith("en")
        ]
        return {"success": True, "voices": en_voices, "total": len(voices)}
    except ImportError:
        return {"success": False, "voices": [], "error": "edge-tts not installed"}
    except Exception as e:
        return {"success": False, "voices": [], "error": str(e)}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAYS TTS CLI")
    parser.add_argument("text", nargs="?", help="Text to speak")
    parser.add_argument("--provider", default=None, help="Provider: edge/openai/elevenlabs/pyttsx3/system")
    parser.add_argument("--voice", default=None, help="Voice name/ID")
    parser.add_argument("--speed", type=float, default=1.0, help="Speed multiplier (0.5–2.0)")
    parser.add_argument("--list-voices", action="store_true", help="List available Edge TTS voices")
    args = parser.parse_args()

    if args.list_voices:
        res = list_edge_voices()
        print("JSON_START" + json.dumps(res) + "JSON_END")
    elif args.text:
        res = synthesize_speech(args.text, provider=args.provider, voice=args.voice, speed=args.speed)
        print("JSON_START" + json.dumps(res) + "JSON_END")
    else:
        # Read from stdin (called by vite middleware)
        raw = sys.stdin.read().strip()
        if raw:
            try:
                params = json.loads(raw)
                res = synthesize_speech(
                    params.get("text", ""),
                    provider=params.get("provider"),
                    voice=params.get("voice"),
                    speed=float(params.get("speed", 1.0)),
                )
            except Exception as e:
                res = {"success": False, "audioBase64": "", "mimeType": "audio/mpeg", "provider": "", "error": str(e)}
            print("JSON_START" + json.dumps(res) + "JSON_END")
