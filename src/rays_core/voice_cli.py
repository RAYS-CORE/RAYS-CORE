import sys
import os
import json
import asyncio

# Ensure RAYS-CORE-main is in sys.path to import tools.
current_dir = os.path.dirname(os.path.abspath(__file__))
rays_core_main_dir = os.path.join(current_dir, "..", "..", "RAYS-CORE-main")
sys.path.insert(0, rays_core_main_dir)

try:
    from tools.transcription_tools import transcribe_audio
    from tools.tts_tool import text_to_speech_tool
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Import error: {str(e)}. sys.path={sys.path}"}))
    sys.exit(1)

def do_transcribe(audio_path):
    try:
        if not os.path.exists(audio_path):
            print(json.dumps({"success": False, "error": f"File not found: {audio_path}"}))
            return
        result = transcribe_audio(audio_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def do_speak(text):
    try:
        result = text_to_speech_tool(text=text)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: voice_cli.py [transcribe|speak] [path|text]"}))
        sys.exit(1)

    command = sys.argv[1]
    payload = sys.argv[2]

    if command == "transcribe":
        do_transcribe(payload)
    elif command == "speak":
        do_speak(payload)
    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {command}"}))
