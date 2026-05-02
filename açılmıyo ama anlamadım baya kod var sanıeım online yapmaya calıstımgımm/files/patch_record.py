import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Inject DOM elements & MediaRecorder initialization right before `window.addEventListener("keydown"...`
rec_setup = """// ─────────────────────────────────────────────
//  SCREEN RECORDING
// ─────────────────────────────────────────────
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

const recIndicator = document.createElement('div');
recIndicator.innerHTML = '&#9209; REC';
recIndicator.style.cssText = 'position:fixed; top:22px; right:22px; color:#ff2222; font-family:"Courier New", monospace; font-size:18px; font-weight:bold; display:none; z-index:100; text-shadow: 0 0 10px #ff2222;';
document.body.appendChild(recIndicator);

window.addEventListener("keydown", e => {"""
code = code.replace('window.addEventListener("keydown", e => {', rec_setup)

# 2. Inject 'R' key detection into keydown
keydown_old = re.compile(r"if \(e\.code === \"KeyF\"\) respawnAtNearestRunway\(\);\n\}\);", re.DOTALL)
keydown_new = """if (e.code === "KeyF") respawnAtNearestRunway();
  
  if (k === 'r') {
      if (!isRecording) {
          const stream = canvas.captureStream(60);
          const options = { mimeType: 'video/webm; codecs=vp9' };
          try {
              mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
          } catch(e) {
              mediaRecorder = new MediaRecorder(stream);
          }
          mediaRecorder.ondataavailable = function(event) {
              if (event.data.size > 0) recordedChunks.push(event.data);
          };
          mediaRecorder.onstop = function() {
              const blob = new Blob(recordedChunks, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'f22_flight_record_' + Date.now() + '.webm';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              recordedChunks = [];
          };
          mediaRecorder.start();
          isRecording = true;
          recIndicator.style.display = 'block';
          
          recIndicator.blinkInterval = setInterval(() => {
              recIndicator.style.opacity = recIndicator.style.opacity === '0' ? '1' : '0';
          }, 500);
      } else {
          mediaRecorder.stop();
          isRecording = false;
          recIndicator.style.display = 'none';
          recIndicator.style.opacity = '1';
          clearInterval(recIndicator.blinkInterval);
      }
  }
});"""
code = keydown_old.sub(keydown_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Screen recorder added.")
