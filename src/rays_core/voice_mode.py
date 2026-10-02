"""
RAYS Voice Mode — "Hey RAYS" cross-platform voice assistant.

╔══════════════════════════════════════════════════════════════════╗
║  Zero manual setup. Self-healing. Works on Windows/macOS/Linux. ║
╚══════════════════════════════════════════════════════════════════╝

Activated via:
    rays --voice .                     # full voice session
    rays --voice-list-devices          # list mic devices
    rays --voice-no-wake .             # skip "Hey RAYS" wake phrase
    /voice                             # toggle voice inside RAYS session

How it works:
  1. Mic capture   — PyAudio (preferred) with sounddevice fallback,
                     both auto-installed if missing.
  2. STT waterfall — voice_transcriber.py  (faster-whisper → Groq → OpenAI → Google)
  3. TTS waterfall — voice_tts.py          (edge-tts → OpenAI → ElevenLabs → pyttsx3 → espeak)
  4. Playback      — winsound (Win) | afplay (macOS) | ffplay/aplay/paplay/pw-play (Linux)

Self-healing:
  - Detects missing Python packages and installs them via pip automatically.
  - Suppresses noisy ALSA/JACK stderr on Linux (harmless probe messages).
  - All providers degrade gracefully — works fully offline, no API keys needed.
"""

from __future__ import annotations

import io
import os
import sys
import wave
import shutil
import signal
import struct
import tempfile
import platform
import threading
import subprocess
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Generator, Optional

# ─────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────
CHUNK             = 1024
CHANNELS          = 1
RATE              = 16_000          # 16 kHz — optimal for Whisper
SILENCE_THRESHOLD = 700             # RMS above this = speech
SILENCE_SECS      = 1.8            # trailing silence seconds to end clip
MAX_RECORD_SECS   = 30             # absolute max per utterance

WAKE_PHRASES = [
    "hey rays", "hey race", "hey raise", "hey ray",
    "ok rays", "okay rays", "rays",
]

_SYSTEM = platform.system()        # "Windows" | "Darwin" | "Linux"


# ─────────────────────────────────────────────────────────────────
# Logging (stderr, avoids corrupting JSON stdout)
# ─────────────────────────────────────────────────────────────────
def _log(msg: str, tag: str = "→") -> None:
    try:
        print(f"  [voice] {tag} {msg}", file=sys.stderr, flush=True)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────
# ALSA/JACK noise suppressor (Linux only)
# PyAudio probes every ALSA card on init — completely harmless but
# very noisy. We redirect stderr during those calls.
# ─────────────────────────────────────────────────────────────────
@contextmanager
def _quiet_alsa() -> Generator[None, None, None]:
    """Suppress ALSA/JACK probe noise on Linux during PyAudio init."""
    if _SYSTEM != "Linux":
        yield
        return
    devnull_fd = os.open(os.devnull, os.O_WRONLY)
    old_stderr = os.dup(2)
    try:
        os.dup2(devnull_fd, 2)
        yield
    finally:
        os.dup2(old_stderr, 2)
        os.close(old_stderr)
        os.close(devnull_fd)


# ─────────────────────────────────────────────────────────────────
# Auto package installer
# ─────────────────────────────────────────────────────────────────
def _pip_install(*packages: str) -> bool:
    """Install pip packages into the running interpreter. Returns True on success."""
    try:
        _log(f"Auto-installing: {' '.join(packages)}", "📦")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", *packages],
            capture_output=True, text=True, timeout=120,
        )
        return result.returncode == 0
    except Exception as e:
        _log(f"pip install failed: {e}", "✗")
        return False


def _ensure_portaudio_system() -> None:
    """
    Install libportaudio system package if missing.
    Runs only when portaudio is not found by ctypes — prevents PyAudio build failure.
    """
    import ctypes.util
    if ctypes.util.find_library("portaudio"):
        return  # already present

    _log("portaudio not found — attempting system install…", "⚙")
    cmds: dict[str, list[list[str]]] = {
        "pacman": [["sudo", "pacman", "-S", "--needed", "--noconfirm", "portaudio"]],
        "apt-get": [["sudo", "apt-get", "install", "-y", "--no-install-recommends", "portaudio19-dev"]],
        "dnf":    [["sudo", "dnf", "install", "-y", "portaudio-devel"]],
        "brew":   [["brew", "install", "portaudio"]],
        # Windows: no action needed — PyAudio wheel bundles portaudio
    }
    for mgr, cmds_list in cmds.items():
        if shutil.which(mgr):
            for cmd in cmds_list:
                try:
                    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
                    _log(f"portaudio installed via {mgr}", "✓")
                    return
                except Exception:
                    pass
            break


def _try_import_pyaudio():
    """Import pyaudio, auto-installing it (and portaudio) if needed. Returns module or None."""
    try:
        import pyaudio  # type: ignore
        return pyaudio
    except ImportError:
        pass

    _ensure_portaudio_system()
    ok = _pip_install("pyaudio")
    if ok:
        try:
            import pyaudio  # type: ignore
            return pyaudio
        except ImportError:
            pass

    _log("PyAudio not available — trying sounddevice fallback", "⚠")
    return None


def _try_import_sounddevice():
    """Import sounddevice, auto-installing if needed. Returns module or None."""
    try:
        import sounddevice as sd  # type: ignore
        return sd
    except ImportError:
        pass

    ok = _pip_install("sounddevice")
    if ok:
        try:
            import sounddevice as sd  # type: ignore
            return sd
        except ImportError:
            pass
    return None


def _ensure_speech_recognition() -> None:
    try:
        import speech_recognition  # type: ignore  # noqa
    except ImportError:
        _pip_install("SpeechRecognition")


def _ensure_tts() -> None:
    """Make sure at least one TTS provider is available."""
    has_tts = False
    for pkg in ["edge_tts", "pyttsx3"]:
        try:
            __import__(pkg)
            has_tts = True
            break
        except ImportError:
            pass

    if not has_tts:
        # edge-tts is the best — try it first
        ok = _pip_install("edge-tts")
        if not ok:
            _pip_install("pyttsx3")


# ─────────────────────────────────────────────────────────────────
# RMS helper
# ─────────────────────────────────────────────────────────────────
def _rms(data: bytes) -> float:
    count = len(data) // 2
    if count == 0:
        return 0.0
    shorts = struct.unpack(f"{count}h", data[: count * 2])
    return (sum(s * s for s in shorts) / count) ** 0.5


# ─────────────────────────────────────────────────────────────────
# Microphone recording — PyAudio first, sounddevice fallback
# ─────────────────────────────────────────────────────────────────
def _record_pyaudio(
    pa,
    device_index: Optional[int] = None,
    threshold: float = SILENCE_THRESHOLD,
    silence_secs: float = SILENCE_SECS,
) -> Optional[str]:
    """Record with PyAudio. Returns temp WAV path or None."""
    import pyaudio  # type: ignore

    with _quiet_alsa():
        stream = pa.open(
            format=pyaudio.paInt16,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            input_device_index=device_index,
            frames_per_buffer=CHUNK,
        )

    frames: list[bytes] = []
    silent_chunks = 0
    max_silent = int(RATE / CHUNK * silence_secs)
    max_chunks  = int(RATE / CHUNK * MAX_RECORD_SECS)
    recording = False

    try:
        for _ in range(max_chunks):
            data   = stream.read(CHUNK, exception_on_overflow=False)
            rms    = _rms(data)
            if rms > threshold:
                if not recording:
                    recording = True
                    _log("🔴 Recording…", "")
                silent_chunks = 0
                frames.append(data)
            elif recording:
                frames.append(data)
                silent_chunks += 1
                if silent_chunks >= max_silent:
                    break
    finally:
        stream.stop_stream()
        stream.close()

    if not frames or not recording:
        return None

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(tmp.name, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)          # paInt16 = 2 bytes/sample
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))
    return tmp.name


def _record_sounddevice(
    device_index: Optional[int] = None,
    threshold: float = SILENCE_THRESHOLD,
    silence_secs: float = SILENCE_SECS,
) -> Optional[str]:
    """Record with sounddevice (fallback). Returns temp WAV path or None."""
    import sounddevice as sd  # type: ignore
    import numpy as np         # guaranteed if sounddevice installed

    frames: list[np.ndarray] = []
    silent_chunks = 0
    max_silent = int(RATE / CHUNK * silence_secs)
    max_chunks  = int(RATE / CHUNK * MAX_RECORD_SECS)
    recording = False

    with sd.InputStream(
        samplerate=RATE,
        channels=CHANNELS,
        dtype="int16",
        blocksize=CHUNK,
        device=device_index,
    ) as stream:
        for _ in range(max_chunks):
            block, _ = stream.read(CHUNK)
            rms = float(np.sqrt(np.mean(block.astype(np.float64) ** 2)))
            if rms > threshold:
                if not recording:
                    recording = True
                    _log("🔴 Recording…", "")
                silent_chunks = 0
                frames.append(block.copy())
            elif recording:
                frames.append(block.copy())
                silent_chunks += 1
                if silent_chunks >= max_silent:
                    break

    if not frames or not recording:
        return None

    audio = np.concatenate(frames, axis=0)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(tmp.name, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(audio.tobytes())
    return tmp.name


# ─────────────────────────────────────────────────────────────────
# Recording context manager
# Holds backend state (pa object) across multiple calls
# ─────────────────────────────────────────────────────────────────
class MicRecorder:
    """
    Context-manager that owns the PyAudio/sounddevice session.
    Automatically picks the best available backend.

    Usage:
        with MicRecorder() as rec:
            wav_path = rec.record()
    """

    def __init__(self, device_index: Optional[int] = None, threshold: float = SILENCE_THRESHOLD):
        self.device_index = device_index
        self.threshold    = threshold
        self._pa          = None
        self._sd          = None

    def __enter__(self) -> "MicRecorder":
        pa_mod = _try_import_pyaudio()
        if pa_mod is not None:
            with _quiet_alsa():
                self._pa = pa_mod.PyAudio()
        else:
            sd_mod = _try_import_sounddevice()
            if sd_mod is not None:
                self._sd = sd_mod
            else:
                raise RuntimeError(
                    "No audio input backend available.\n"
                    "Install PyAudio: pip install pyaudio\n"
                    "  Linux:   sudo pacman -S portaudio  (Arch) | sudo apt install portaudio19-dev  (Debian)\n"
                    "  macOS:   brew install portaudio\n"
                    "  Windows: pip install pyaudio  (pre-built wheel)"
                )
        return self

    def record(self) -> Optional[str]:
        """Record one utterance. Returns temp WAV path or None (no speech)."""
        if self._pa is not None:
            return _record_pyaudio(self._pa, self.device_index, self.threshold)
        if self._sd is not None:
            return _record_sounddevice(self.device_index, self.threshold)
        return None

    def list_devices(self) -> list[dict]:
        """Return list of available input devices."""
        devices = []
        if self._pa is not None:
            for i in range(self._pa.get_device_count()):
                info = self._pa.get_device_info_by_index(i)
                if info["maxInputChannels"] > 0:
                    devices.append({"index": i, "name": info["name"],
                                    "channels": info["maxInputChannels"],
                                    "rate": info["defaultSampleRate"]})
        elif self._sd is not None:
            import sounddevice as sd  # type: ignore
            for dev in sd.query_devices():
                if dev["max_input_channels"] > 0:
                    devices.append({"index": dev["index"], "name": dev["name"],
                                    "channels": dev["max_input_channels"],
                                    "rate": dev["default_samplerate"]})
        return devices

    def __exit__(self, *_) -> None:
        if self._pa is not None:
            try:
                self._pa.terminate()
            except Exception:
                pass
            self._pa = None


# ─────────────────────────────────────────────────────────────────
# Cross-platform audio playback
# ─────────────────────────────────────────────────────────────────
def _play_file(path: str, mime: str = "audio/mpeg") -> None:
    """
    Play an audio file cross-platform.
    Windows: winsound (WAV) or MCI (MP3)
    macOS:   afplay (built-in, no install needed)
    Linux:   ffplay → aplay → paplay → pw-play (all commonly pre-installed)
    """
    try:
        if _SYSTEM == "Windows":
            _play_windows(path, mime)
        elif _SYSTEM == "Darwin":
            subprocess.run(["afplay", path],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=120, check=False)
        else:
            _play_linux(path)
    except Exception as e:
        _log(f"Playback error: {e}", "✗")


def _play_windows(path: str, mime: str) -> None:
    """Windows playback: winsound for WAV, MCI for MP3, fallback os.startfile."""
    if path.lower().endswith(".wav"):
        try:
            import winsound  # type: ignore  # stdlib on Windows
            winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_NODEFAULT)
            return
        except Exception:
            pass
    # MCI (Media Control Interface) — plays MP3 natively, no extra install
    try:
        import ctypes
        mci = ctypes.windll.winmm  # type: ignore
        mci.mciSendStringW(f'open "{path}" type mpegvideo alias rays_tts', None, 0, None)
        mci.mciSendStringW("play rays_tts wait", None, 0, None)
        mci.mciSendStringW("close rays_tts", None, 0, None)
        return
    except Exception:
        pass
    # Last resort: Windows default media player (async, but better than nothing)
    try:
        os.startfile(path)  # type: ignore
    except Exception:
        pass


def _play_linux(path: str) -> None:
    """Linux playback: try players in order of quality/availability."""
    for player, flags in [
        ("ffplay",  ["-nodisp", "-autoexit", "-loglevel", "quiet"]),
        ("aplay",   []),
        ("paplay",  []),
        ("pw-play", []),          # PipeWire native
        ("sox",     ["-q"]),      # play command from sox
        ("cvlc",    ["--play-and-exit", "--quiet"]),
    ]:
        if shutil.which(player):
            try:
                cmd = [player] + flags + [path]
                if player == "sox":
                    cmd = ["play", "-q", path]  # sox installs 'play' not 'sox play'
                subprocess.run(
                    cmd,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=120, check=False,
                )
                return
            except Exception:
                continue
    _log("No audio player found. Install ffplay: sudo pacman -S ffmpeg", "⚠")


def _play_bytes(data: bytes, mime: str = "audio/mpeg") -> None:
    """Write bytes to temp file and play it."""
    ext = ".mp3" if "mpeg" in mime else ".wav"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(data)
        tmp = f.name
    try:
        _play_file(tmp, mime)
    finally:
        try:
            os.unlink(tmp)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────
# STT
# ─────────────────────────────────────────────────────────────────
def transcribe(wav_path: str) -> str:
    """Transcribe WAV → text using the voice_transcriber waterfall."""
    _ensure_speech_recognition()
    try:
        from .voice_transcriber import transcribe_audio_file  # type: ignore
        result = transcribe_audio_file(wav_path)
        if result.get("success") and result.get("transcript"):
            provider = result.get("provider", "?")
            text     = result["transcript"].strip()
            _log(f"STT [{provider}] → '{text[:80]}'", "✓")
            return text
        _log(f"STT: {result.get('error', 'no speech')}", "⚠")
        return ""
    except Exception as e:
        _log(f"STT exception: {e}", "✗")
        return ""


# ─────────────────────────────────────────────────────────────────
# TTS
# ─────────────────────────────────────────────────────────────────
def speak(text: str, voice: Optional[str] = None) -> None:
    """Synthesize text and play it — fully cross-platform, fully offline-capable."""
    if not text:
        return
    _ensure_tts()
    try:
        from .voice_tts import synthesize_speech  # type: ignore
        result = synthesize_speech(text, voice=voice)
        if result.get("success") and result.get("audioBase64"):
            import base64
            data = base64.b64decode(result["audioBase64"])
            _play_bytes(data, result.get("mimeType", "audio/mpeg"))
            return
        _log(f"TTS providers failed: {result.get('error', '')} — falling back to system TTS", "⚠")
    except Exception as e:
        _log(f"TTS exception: {e} — falling back", "⚠")

    # Hard OS fallback (no Python packages needed)
    _speak_system_fallback(text)


def _speak_system_fallback(text: str) -> None:
    """
    Use the OS built-in TTS engine directly.
    - Windows: PowerShell SAPI5 (always available on Windows 7+)
    - macOS:   say (built-in on all macOS versions)
    - Linux:   espeak-ng / espeak (installed with RAYS; auto-installs if missing)
    """
    if _SYSTEM == "Windows":
        safe = text.replace("'", "")
        ps = (
            "Add-Type -AssemblyName System.Speech; "
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            f"$s.Speak('{safe}'); $s.Dispose()"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, timeout=30,
        )
    elif _SYSTEM == "Darwin":
        subprocess.run(["say", text], capture_output=True, timeout=30)
    else:
        espeak = shutil.which("espeak-ng") or shutil.which("espeak")
        if not espeak:
            # Try to auto-install
            _log("espeak-ng not found — attempting install", "⚙")
            for mgr, pkg in [
                ("pacman",  ["sudo", "pacman", "-S", "--needed", "--noconfirm", "espeak-ng"]),
                ("apt-get", ["sudo", "apt-get", "install", "-y", "espeak-ng"]),
                ("dnf",     ["sudo", "dnf", "install", "-y", "espeak-ng"]),
            ]:
                if shutil.which(mgr):
                    try:
                        subprocess.run(pkg, check=True, capture_output=True, timeout=60)
                        espeak = shutil.which("espeak-ng")
                        break
                    except Exception:
                        pass
        if espeak:
            subprocess.run([espeak, "-s", "155", text],
                           capture_output=True, timeout=30)
        else:
            _log("No TTS available on this system", "✗")


# ─────────────────────────────────────────────────────────────────
# Wake-word helpers
# ─────────────────────────────────────────────────────────────────
def is_wake_word(text: str) -> bool:
    t = text.lower().strip()
    return any(wp in t for wp in WAKE_PHRASES)


def strip_wake_word(text: str) -> str:
    """Remove wake phrase prefix so RAYS receives only the command."""
    t = text.strip()
    for wp in WAKE_PHRASES:
        idx = t.lower().find(wp)
        if idx != -1:
            tail = t[idx + len(wp):].strip(" ,.-")
            if tail:
                return tail
    return t


# ─────────────────────────────────────────────────────────────────
# Single-shot prompt (used by /voice slash command)
# ─────────────────────────────────────────────────────────────────
def voice_prompt_once(
    recorder: MicRecorder,
    require_wake: bool = True,
    tts_voice: Optional[str] = None,
) -> Optional[str]:
    """
    Record one utterance, check wake word, return command or None.
    Designed to be called from inside the RAYS interactive loop.
    """
    wav = recorder.record()
    if not wav:
        return None
    try:
        text = transcribe(wav)
    finally:
        try:
            os.unlink(wav)
        except Exception:
            pass

    if not text:
        return None

    if require_wake:
        if not is_wake_word(text):
            return None
        command = strip_wake_word(text)
        if not command:
            speak("Yes?", voice=tts_voice)
            wav2 = recorder.record()
            if not wav2:
                return None
            try:
                command = transcribe(wav2)
            finally:
                try:
                    os.unlink(wav2)
                except Exception:
                    pass
        return command or None
    return text


# ─────────────────────────────────────────────────────────────────
# Continuous voice loop (used by rays --voice)
# ─────────────────────────────────────────────────────────────────
def voice_loop(
    on_command: Callable[[str], str],
    require_wake: bool = True,
    device_index: Optional[int] = None,
    tts_voice: Optional[str] = None,
    stop_event: Optional[threading.Event] = None,
) -> None:
    """
    Continuous listen → transcribe → dispatch loop.

    Args:
        on_command:   Callable(prompt) → response_str.  Called in a worker thread.
        require_wake: Only act on utterances starting with "Hey RAYS".
        device_index: Mic device index (None = system default).
        tts_voice:    TTS voice name override.
        stop_event:   Set to stop the loop externally.
    """
    _stop = stop_event or threading.Event()

    def _sigint(sig, frame):
        _stop.set()

    old_handler = signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGINT, _handle_sigint := _sigint)  # type: ignore[assignment]

    mode = "wake-word ('Hey RAYS')" if require_wake else "always-on"
    _log(f"Starting — mode: {mode} | OS: {_SYSTEM}", "🎙")
    _log("Press Ctrl+C to stop", "ℹ")

    speak("Hey RAYS is ready. I'm listening.", voice=tts_voice)

    try:
        with MicRecorder(device_index=device_index) as rec:
            while not _stop.is_set():
                try:
                    command = voice_prompt_once(
                        rec,
                        require_wake=require_wake,
                        tts_voice=tts_voice,
                    )
                    if not command:
                        continue

                    _log(f"Command: '{command}'", "🎤")
                    speak("On it.", voice=tts_voice)

                    def _run(cmd: str = command) -> None:
                        try:
                            response = on_command(cmd)
                            if response:
                                speak(response, voice=tts_voice)
                        except Exception as e:
                            _log(f"Command handler error: {e}", "✗")
                            speak("Sorry, something went wrong.", voice=tts_voice)

                    t = threading.Thread(target=_run, daemon=True)
                    t.start()
                    t.join(timeout=135)

                except Exception as e:
                    _log(f"Loop iteration error: {e}", "✗")
                    import time
                    time.sleep(0.5)
    finally:
        signal.signal(signal.SIGINT, old_handler)

    _log("Voice mode stopped.", "✓")


# ─────────────────────────────────────────────────────────────────
# Dependency check (non-destructive; used before entering voice mode)
# ─────────────────────────────────────────────────────────────────
def check_voice_deps() -> tuple[bool, list[str]]:
    """
    Check whether voice mode can start. Returns (all_ok, list_of_missing).
    This DOES attempt auto-install silently before reporting failure.
    """
    # Trigger auto-installs
    pa  = _try_import_pyaudio()
    sd  = None if pa else _try_import_sounddevice()
    _ensure_speech_recognition()
    _ensure_tts()

    missing: list[str] = []

    # Must have at least one mic backend
    if pa is None and sd is None:
        missing.append("pyaudio  (or sounddevice as fallback)")

    # Must have at least one STT backend
    has_stt = False
    for mod in ["faster_whisper", "speech_recognition"]:
        try:
            __import__(mod)
            has_stt = True
            break
        except ImportError:
            pass
    if not has_stt and not (os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")):
        missing.append("SpeechRecognition  (free Google STT fallback)")

    # Must have at least one TTS backend
    has_tts = False
    for mod in ["edge_tts", "pyttsx3"]:
        try:
            __import__(mod)
            has_tts = True
            break
        except ImportError:
            pass
    # System TTS counts too
    if not has_tts:
        has_tts = bool(
            _SYSTEM == "Windows" or
            _SYSTEM == "Darwin" or
            shutil.which("espeak-ng") or
            shutil.which("espeak")
        )
    if not has_tts:
        missing.append("edge-tts  (or pyttsx3 for offline TTS)")

    return (len(missing) == 0, missing)


# ─────────────────────────────────────────────────────────────────
# Device listing (utility for --voice-list-devices)
# ─────────────────────────────────────────────────────────────────
def list_mic_devices() -> list[dict]:
    """Return available microphone devices across all backends."""
    try:
        with MicRecorder() as rec:
            return rec.list_devices()
    except Exception as e:
        _log(f"Could not enumerate devices: {e}", "✗")
        return []
