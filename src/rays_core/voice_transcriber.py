"""
RAYS Voice Transcriber Module
Transcribes base64-encoded audio (WebM, Opus, MP4, WAV, OGG) using multi-tier speech recognition:
1. faster-whisper (local, FREE, offline — if installed)
2. Groq Whisper API (if GROQ_API_KEY available) — ultra-fast <200ms
3. OpenAI Whisper API (if OPENAI_API_KEY available) — most reliable
4. SpeechRecognition Google STT (free, universal fallback)

Cross-platform: Windows, macOS, Linux.
"""
import os
import sys
import json
import base64
import tempfile
import shutil
import subprocess
import platform
from pathlib import Path
from typing import Dict, Any, Optional


def _find_ffmpeg() -> Optional[str]:
    """Find ffmpeg binary cross-platform (Windows, macOS, Linux)."""
    # 1. Check PATH first (most reliable)
    found = shutil.which("ffmpeg")
    if found:
        return found

    # 2. OS-specific common locations
    system = platform.system()
    if system == "Darwin":  # macOS
        candidates = [
            "/opt/homebrew/bin/ffmpeg",   # Apple Silicon Homebrew
            "/usr/local/bin/ffmpeg",       # Intel Homebrew
            "/opt/local/bin/ffmpeg",       # MacPorts
        ]
    elif system == "Windows":
        candidates = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
            os.path.join(os.path.expanduser("~"), "ffmpeg", "bin", "ffmpeg.exe"),
            os.path.join(os.path.expanduser("~"), "scoop", "shims", "ffmpeg.exe"),
        ]
    else:  # Linux
        candidates = [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/snap/bin/ffmpeg",
        ]

    for c in candidates:
        if os.path.isfile(c):
            return c

    return None


FFMPEG_PATH = _find_ffmpeg()


def _log(msg: str) -> None:
    """Log to stderr so it doesn't corrupt JSON stdout output."""
    try:
        print(f"[RAYS-STT] {msg}", file=sys.stderr, flush=True)
    except Exception:
        pass


def convert_to_wav(input_path: str, output_wav: str) -> bool:
    """Convert any audio file to 16kHz mono 16-bit PCM WAV using ffmpeg."""
    ffmpeg_bin = FFMPEG_PATH or shutil.which("ffmpeg")
    if not ffmpeg_bin:
        _log("ffmpeg not found — cannot convert audio. Install ffmpeg and add to PATH.")
        return False

    try:
        cmd = [
            ffmpeg_bin,
            "-y",           # overwrite output
            "-i", input_path,
            "-vn",          # no video
            "-ac", "1",     # mono
            "-ar", "16000", # 16kHz sample rate (Whisper optimal)
            "-sample_fmt", "s16",  # 16-bit PCM
            "-f", "wav",
            output_wav,
        ]
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
        )
        success = (
            res.returncode == 0
            and os.path.exists(output_wav)
            and os.path.getsize(output_wav) > 44  # larger than empty WAV header
        )
        if not success:
            _log(f"ffmpeg failed (code {res.returncode}): {res.stderr.decode('utf-8', errors='replace')[-300:]}")
        return success
    except subprocess.TimeoutExpired:
        _log("ffmpeg conversion timed out")
        return False
    except Exception as e:
        _log(f"ffmpeg exception: {e}")
        return False


def _get_mime_ext(mime_type: str) -> str:
    """Map MIME type to file extension, stripping codec parameters."""
    # Strip codec params e.g. "audio/webm;codecs=opus" -> "audio/webm"
    base_mime = mime_type.split(";")[0].strip().lower()
    mapping = {
        "audio/wav": ".wav",
        "audio/wave": ".wav",
        "audio/x-wav": ".wav",
        "audio/mp4": ".mp4",
        "audio/m4a": ".m4a",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/webm": ".webm",
    }
    return mapping.get(base_mime, ".webm")


def _try_faster_whisper(wav_path: str) -> Optional[str]:
    """Attempt transcription with faster-whisper (local, FREE, offline)."""
    try:
        from faster_whisper import WhisperModel  # type: ignore
        # Use tiny model for speed; upgrade to large-v3-turbo if available
        model_size = os.getenv("RAYS_WHISPER_MODEL", "base")
        _log(f"Using faster-whisper model: {model_size}")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(wav_path, beam_size=1, language="en")
        text = " ".join(seg.text for seg in segments).strip()
        if text:
            _log(f"faster-whisper: '{text[:60]}...' " if len(text) > 60 else f"faster-whisper: '{text}'")
        return text or None
    except ImportError:
        return None  # Package not installed — silently skip
    except Exception as e:
        _log(f"faster-whisper error: {e}")
        return None


def _try_groq(audio_path: str) -> Optional[str]:
    """Attempt transcription via Groq Whisper API."""
    groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
    if not groq_key:
        return None

    try:
        import urllib.request
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        boundary = "----RaysSTTBoundary" + hex(os.getpid())[2:]

        with open(audio_path, "rb") as af:
            file_bytes = af.read()

        filename = Path(audio_path).name
        body_parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-large-v3-turbo\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nen\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: audio/wav\r\n\r\n".encode(),
            file_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        body = b"".join(body_parts)

        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {groq_key}")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data.get("text", "").strip()
            if text:
                _log(f"Groq STT success: '{text[:60]}'" if len(text) > 60 else f"Groq STT: '{text}'")
            return text or None
    except Exception as e:
        _log(f"Groq STT error: {e}")
        return None


def _try_openai(audio_path: str) -> Optional[str]:
    """Attempt transcription via OpenAI Whisper API."""
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return None

    try:
        import urllib.request
        url = "https://api.openai.com/v1/audio/transcriptions"
        boundary = "----RaysOpenAISTT" + hex(os.getpid())[2:]

        with open(audio_path, "rb") as af:
            file_bytes = af.read()

        filename = Path(audio_path).name
        body_parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nen\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: audio/wav\r\n\r\n".encode(),
            file_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        body = b"".join(body_parts)

        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {openai_key}")
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data.get("text", "").strip()
            if text:
                _log(f"OpenAI STT success: '{text[:60]}'" if len(text) > 60 else f"OpenAI STT: '{text}'")
            return text or None
    except Exception as e:
        _log(f"OpenAI STT error: {e}")
        return None


def _try_google_sr(audio_path: str) -> Optional[str]:
    """Attempt transcription via SpeechRecognition (Google STT, free)."""
    try:
        import speech_recognition as sr  # type: ignore
        r = sr.Recognizer()
        r.energy_threshold = 200
        r.dynamic_energy_threshold = True
        r.pause_threshold = 0.8

        with sr.AudioFile(audio_path) as source:
            audio_data = r.record(source)

        try:
            text = r.recognize_google(audio_data).strip()
            if text:
                _log(f"Google STT: '{text[:60]}'" if len(text) > 60 else f"Google STT: '{text}'")
            return text or None
        except sr.UnknownValueError:
            _log("Google STT: No speech detected in audio")
            return ""  # Empty string = silence (not an error)
        except sr.RequestError as e:
            _log(f"Google STT request failed: {e}")
            return None
    except ImportError:
        _log("speech_recognition not installed — pip install SpeechRecognition")
        return None
    except Exception as e:
        _log(f"Google STT error: {e}")
        return None


def transcribe_audio_file(file_path: str, preferred_provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Transcribe an audio file using available providers.
    If preferred_provider is specified (faster-whisper, groq, openai, google), tries that first.
    Otherwise uses waterfall: faster-whisper -> groq -> openai -> google.
    """
    if not os.path.exists(file_path):
        return {"success": False, "transcript": "", "error": "Audio file not found"}
    if os.path.getsize(file_path) == 0:
        return {"success": False, "transcript": "", "error": "Audio file is empty"}

    # Convert to 16kHz WAV for all providers
    temp_wav = None
    wav_path = file_path  # fallback to original if conversion fails

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            temp_wav = tmp.name

        converted = convert_to_wav(file_path, temp_wav)
        if converted:
            wav_path = temp_wav
        else:
            _log("WAV conversion failed — trying with original file")
            if file_path.lower().endswith(".wav"):
                wav_path = file_path
            else:
                wav_path = file_path

        # Build order based on preference
        pref = (preferred_provider or "").lower().strip()
        all_providers = ["faster-whisper", "groq", "openai", "google"]
        if pref in all_providers:
            provider_order = [pref] + [p for p in all_providers if p != pref]
        else:
            provider_order = all_providers

        providers_tried = []

        for p in provider_order:
            if p == "faster-whisper":
                providers_tried.append("faster-whisper")
                result = _try_faster_whisper(wav_path)
                if result is not None:
                    return {"success": True, "transcript": result, "error": "", "provider": "faster-whisper"}

            elif p == "groq":
                if os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY"):
                    providers_tried.append("groq")
                    result = _try_groq(wav_path)
                    if result is not None:
                        if result == "":
                            return {"success": True, "transcript": "", "error": "No speech detected", "provider": "groq"}
                        return {"success": True, "transcript": result, "error": "", "provider": "groq"}

            elif p == "openai":
                if os.getenv("OPENAI_API_KEY"):
                    providers_tried.append("openai")
                    result = _try_openai(wav_path)
                    if result is not None:
                        if result == "":
                            return {"success": True, "transcript": "", "error": "No speech detected", "provider": "openai"}
                        return {"success": True, "transcript": result, "error": "", "provider": "openai"}

            elif p == "google":
                providers_tried.append("google")
                result = _try_google_sr(wav_path)
                if result is not None:
                    if result == "":
                        return {"success": True, "transcript": "", "error": "No speech detected", "provider": "google"}
                    return {"success": True, "transcript": result, "error": "", "provider": "google"}

        _log(f"All STT providers failed. Tried: {', '.join(providers_tried)}")
        return {
            "success": False,
            "transcript": "",
            "error": f"All STT providers failed ({', '.join(providers_tried)}). "
                     "Set GROQ_API_KEY or OPENAI_API_KEY, or install: pip install SpeechRecognition faster-whisper",
        }

    finally:
        # Always clean up temp WAV
        if temp_wav and os.path.exists(temp_wav):
            try:
                os.unlink(temp_wav)
            except Exception:
                pass


def transcribe_audio_base64(data_b64: str, mime_type: str = "audio/webm", provider: Optional[str] = None) -> Dict[str, Any]:
    """Transcribe base64-encoded audio data with optional preferred provider."""
    temp_path = None
    try:
        if "base64," in data_b64:
            data_b64 = data_b64.split("base64,")[1]

        data_b64 = data_b64.strip().replace("\n", "").replace("\r", "")

        raw_bytes = base64.b64decode(data_b64)
        if len(raw_bytes) < 64:
            return {"success": False, "transcript": "", "error": f"Audio data too short ({len(raw_bytes)} bytes)"}

        ext = _get_mime_ext(mime_type)

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(raw_bytes)
            temp_path = f.name

        _log(f"Received {len(raw_bytes)} bytes of {mime_type} audio — transcribing (preferred: {provider or 'auto'})...")
        return transcribe_audio_file(temp_path, preferred_provider=provider)

    except Exception as e:
        _log(f"transcribe_audio_base64 exception: {e}")
        return {"success": False, "transcript": "", "error": str(e)}
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass



if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        mtype = sys.argv[2] if len(sys.argv) > 2 else "audio/webm"
        provider = sys.argv[3] if len(sys.argv) > 3 else None
        if os.path.exists(arg):
            res = transcribe_audio_file(arg, preferred_provider=provider)
        else:
            res = transcribe_audio_base64(arg, mtype, provider=provider)
        print("JSON_START" + json.dumps(res) + "JSON_END")
    else:
        # Read from stdin (can be raw base64 or json)
        raw = sys.stdin.read().strip()
        if raw:
            try:
                params = json.loads(raw)
                res = transcribe_audio_base64(
                    params.get("audioBase64", ""),
                    params.get("mimeType", "audio/webm"),
                    provider=params.get("provider"),
                )
            except Exception:
                res = transcribe_audio_base64(raw, "audio/webm")
            print("JSON_START" + json.dumps(res) + "JSON_END")
        else:
            print("Usage: python voice_transcriber.py <file_path_or_base64> [mime_type] [provider]")

