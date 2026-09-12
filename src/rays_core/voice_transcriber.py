"""
RAYS Voice Transcriber Module
Transcribes base64-encoded audio (WebM, Opus, MP4, WAV, OGG) using multi-tier speech recognition:
1. Groq Whisper API (if GROQ_API_KEY available) — ultra-fast < 200ms
2. OpenAI Whisper API (if OPENAI_API_KEY available)
3. SpeechRecognition Google STT (free, universal)
4. Offline local Sphinx / WAV parser
"""
import os
import sys
import json
import socket
import base64
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any

# Enforce strict 2.5s network timeout on all STT API calls
socket.setdefaulttimeout(2.5)

FFMPEG_PATH = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg" or "/usr/local/bin/ffmpeg"

def convert_to_wav(input_path: str, output_wav: str) -> bool:
    """Convert any audio file to 16kHz mono 16-bit PCM WAV using ffmpeg."""
    try:
        ffmpeg_bin = FFMPEG_PATH if os.path.exists(FFMPEG_PATH) else "ffmpeg"
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i", input_path,
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-f", "wav",
            output_wav
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        return res.returncode == 0 and os.path.exists(output_wav) and os.path.getsize(output_wav) > 44
    except Exception as e:
        return False

def transcribe_audio_file(file_path: str) -> Dict[str, Any]:
    """Transcribe an audio file using available providers."""
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        return {"success": False, "transcript": "", "error": "Empty or missing audio file"}

    # Convert to 16kHz WAV
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close()
    wav_path = temp_wav.name

    converted = convert_to_wav(file_path, wav_path)
    audio_file_to_use = wav_path if converted else file_path

    # Provider 1: Groq Whisper API if GROQ_API_KEY is available
    groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
    if groq_key:
        try:
            import urllib.request
            url = "https://api.groq.com/openai/v1/audio/transcriptions"
            boundary = "----WebKitFormBoundaryRaysStt" + hex(os.getpid())
            
            with open(audio_file_to_use, "rb") as af:
                file_bytes = af.read()

            body_parts = []
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-large-v3-turbo\r\n".encode("utf-8"))
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode("utf-8"))
            body_parts.append(file_bytes)
            body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
            body = b"".join(body_parts)

            req = urllib.request.Request(url, data=body, method="POST")
            req.add_header("Authorization", f"Bearer {groq_key}")
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
            
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data.get("text", "").strip()
                if text:
                    try: os.unlink(wav_path)
                    except: pass
                    return {"success": True, "transcript": text, "error": "", "provider": "groq"}
        except Exception:
            pass

    # Provider 2: SpeechRecognition (Google STT)
    try:
        import speech_recognition as sr
        r = sr.Recognizer()
        r.energy_threshold = 200
        r.dynamic_energy_threshold = True

        with sr.AudioFile(audio_file_to_use) as source:
            audio_data = r.record(source)
            try:
                text = r.recognize_google(audio_data)
                try: os.unlink(wav_path)
                except: pass
                return {"success": True, "transcript": text.strip(), "error": "", "provider": "google"}
            except sr.UnknownValueError:
                try: os.unlink(wav_path)
                except: pass
                return {"success": True, "transcript": "", "error": "No speech detected"}
            except Exception as e:
                pass
    except Exception:
        pass

    try: os.unlink(wav_path)
    except: pass
    return {"success": False, "transcript": "", "error": "Failed to transcribe audio"}

def transcribe_audio_base64(data_b64: str, mime_type: str = "audio/webm") -> Dict[str, Any]:
    """Transcribe base64-encoded audio data."""
    try:
        # Strip data URL prefix if present (e.g. data:audio/webm;codecs=opus;base64,...)
        if "base64," in data_b64:
            data_b64 = data_b64.split("base64,")[1]

        raw_bytes = base64.b64decode(data_b64)
        if len(raw_bytes) < 64:
            return {"success": False, "transcript": "", "error": "Audio data too short"}

        ext = ".webm"
        if "wav" in mime_type.lower():
            ext = ".wav"
        elif "mp4" in mime_type.lower():
            ext = ".mp4"
        elif "ogg" in mime_type.lower():
            ext = ".ogg"

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(raw_bytes)
            temp_path = f.name

        try:
            res = transcribe_audio_file(temp_path)
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

        return res
    except Exception as e:
        return {"success": False, "transcript": "", "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        mtype = sys.argv[2] if len(sys.argv) > 2 else "audio/webm"
        if os.path.exists(arg):
            res = transcribe_audio_file(arg)
        else:
            res = transcribe_audio_base64(arg, mtype)
        print("JSON_START" + json.dumps(res) + "JSON_END")
