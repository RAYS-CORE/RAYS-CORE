import sys, os, base64
sys.path.insert(0, "/Users/samreedhbhuyan/Desktop/Win_C/RAYS-CORE/src")
from rays_core.voice_transcriber import transcribe_audio_base64

# Create a valid wav file (small beep) and read it to base64
import wave, struct
with wave.open("test.wav", "w") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(16000)
    # Write 1 second of silence/sine wave
    for i in range(16000):
        f.writeframesraw(struct.pack('<h', 0))

with open("test.wav", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

res = transcribe_audio_base64(b64, "audio/wav")
print(res)
