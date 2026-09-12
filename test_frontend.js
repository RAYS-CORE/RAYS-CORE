const fs = require("fs");
const { execSync } = require("child_process");

// 1. Generate a valid silent 1-second wav file
const buf = Buffer.alloc(44 + 16000 * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + 16000 * 2, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16); // subchunk1size
buf.writeUInt16LE(1, 20); // audio format (PCM)
buf.writeUInt16LE(1, 22); // num channels
buf.writeUInt32LE(16000, 24); // sample rate
buf.writeUInt32LE(32000, 28); // byte rate
buf.writeUInt16LE(2, 32); // block align
buf.writeUInt16LE(16, 34); // bits per sample
buf.write("data", 36);
buf.writeUInt32LE(16000 * 2, 40); // subchunk2size
// (rest is zeros)

fs.writeFileSync("silent.wav", buf);

// 2. Convert to webm using ffmpeg to simulate browser mediarecorder
execSync("ffmpeg -y -i silent.wav -c:a libopus silent.webm > /dev/null 2>&1");

const webmBuf = fs.readFileSync("silent.webm");
const b64 = webmBuf.toString("base64");

// 3. Send POST to local Vite
fetch("http://localhost:8080/api/voice/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64: b64, mimeType: "audio/webm;codecs=opus" })
})
.then(r => r.json())
.then(d => console.log("RESULT:", d))
.catch(e => console.error("ERROR:", e));

