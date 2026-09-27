/**
 * LoadingScreen — vanilla-JS port of the supplied React loading animation.
 * Renders a full-screen holographic globe + HUD + progress bar overlay,
 * then calls onDone() once both the minimum animation duration has elapsed
 * AND the supplied readyPromise has resolved (whichever finishes later).
 *
 * Usage:
 *   mountLoadingScreen(initPromise).then(() => { ...dashboard is ready... });
 *
 * Does not touch any existing DOM/CSS — fully self-contained, injects its
 * own <style> tag and a single root <div id="rsp-loading">.
 */

const PHASES = [
  'INITIALIZING SYSTEM',
  'SYNCING GLOBAL DATA',
  'LOADING ASSETS',
  'ESTABLISHING CONNECTION',
  'CALIBRATING SENSORS',
  'SYSTEM READY',
];

const MIN_DURATION_MS = 3500; // floor so the animation never feels rushed

export function mountLoadingScreen(readyPromise) {
  return new Promise((resolveOuter) => {
    injectCSS();

    const root = document.createElement('div');
    root.id = 'rsp-loading';
    root.innerHTML = `
      <canvas id="rsp-loading-canvas" width="1920" height="1080"></canvas>
      <div class="rsp-ld-vignette"></div>
      <div class="rsp-ld-scanline"></div>
      <svg class="rsp-ld-diag" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="72" y1="18" x2="78" y2="10" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
        <line x1="79" y1="10" x2="85" y2="16" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
        <line x1="18" y1="75" x2="12" y2="82" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
        <line x1="82" y1="72" x2="88" y2="78" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
        <line x1="15" y1="22" x2="22" y2="16" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
        <circle cx="72" cy="18" r="1.2" fill="none" stroke="rgba(0,220,255,0.5)" stroke-width="0.3"/>
      </svg>

      ${hudCornerHTML('tl')}
      ${hudCornerHTML('tr')}
      ${hudCornerHTML('bl')}
      ${hudCornerHTML('br')}

      <div class="rsp-ld-topmark">
        <div class="rsp-ld-topline rsp-ld-topline-l"></div>
        <div class="rsp-ld-diamond"></div>
        <div class="rsp-ld-topline rsp-ld-topline-r"></div>
      </div>

      <div class="rsp-ld-center">
        <div class="rsp-ld-title">RAY SPY</div>
        <div class="rsp-ld-symbol-wrap">${symbolSVG()}</div>
        <div class="rsp-ld-phase" id="rsp-ld-phase">${PHASES[0]}</div>
        <div class="rsp-ld-barwrap">
          <div class="rsp-ld-bartrack">
            <div class="rsp-ld-barfill" id="rsp-ld-barfill">
              <div class="rsp-ld-barshine"></div>
            </div>
          </div>
          <div class="rsp-ld-barlabels">
            <span id="rsp-ld-pct">■ LOADING 0%</span>
            <span id="rsp-ld-blocks">□□□□□□□□□□</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // ── Globe canvas animation ──
    const stopGlobe = startGlobeAnimation(root.querySelector('#rsp-loading-canvas'));

    // ── HUD corner fade-in (matches the React animation-delay timings) ──
    requestAnimationFrame(() => root.classList.add('rsp-ld-show'));

    // ── Progress bar driven by elapsed time, gated by readyPromise ──
    const phaseEl = root.querySelector('#rsp-ld-phase');
    const fillEl  = root.querySelector('#rsp-ld-barfill');
    const pctEl   = root.querySelector('#rsp-ld-pct');
    const blkEl   = root.querySelector('#rsp-ld-blocks');

    const start = performance.now();
    let appReady = false;
    let rafId;

    (readyPromise || Promise.resolve()).then(() => { appReady = true; });

    function tick() {
      const elapsed = performance.now() - start;
      // Progress visually caps at 92% until the real init() resolves,
      // then races to 100% — avoids a "100%" that lies about actual readiness.
      const timeP = Math.min(1, elapsed / MIN_DURATION_MS);
      const cap = appReady ? 1 : 0.92;
      const p = Math.min(timeP, cap);
      const pct = Math.round(p * 100);

      phaseEl.textContent = PHASES[Math.min(PHASES.length - 1, Math.floor(p * PHASES.length))];
      fillEl.style.width = `${pct}%`;
      fillEl.classList.toggle('rsp-ld-red', pct > 60);
      pctEl.textContent = `■ LOADING ${pct}%`;
      blkEl.textContent = '■'.repeat(Math.ceil(pct / 10)) + '□'.repeat(10 - Math.ceil(pct / 10));

      if (pct >= 100 && appReady) {
        stopGlobe();
        root.classList.add('rsp-ld-done');
        setTimeout(() => {
          root.remove();
          resolveOuter();
        }, 800);
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  });
}

// ─────────────────────────────────────────────────────────────────────────
function hudCornerHTML(pos) {
  const isL = pos.includes('l');
  const isT = pos.includes('t');
  const label = isT ? (isL ? '◀ SYS-MAIN' : 'NET-LINK ▶') : (isL ? '◀ DATA-LOG' : 'STATUS ▶');
  const lineLabels = ['OK', 'READY', 'ACTIVE', 'LINKED', 'SYNC', 'RUN'];
  const lines = lineLabels.map((l, i) => `<div class="rsp-ld-hudline" style="animation-delay:${1.2 + i * 0.12}s">&gt; SYS.${String(i + 1).padStart(3, '0')} ${l}</div>`).join('');

  return `
    <div class="rsp-ld-corner rsp-ld-corner-${pos}">
      <div class="rsp-ld-corner-box rsp-ld-corner-box-${pos}">
        <div class="rsp-ld-corner-tick rsp-ld-corner-tick-${pos}"></div>
        <div class="rsp-ld-corner-label rsp-ld-corner-label-${pos}">${label}</div>
      </div>
      ${lines}
    </div>
  `;
}

function symbolSVG() {
  // Static glow color; the React version animated cyan→red via JS state.
  // Here we drive the same shift purely with CSS (see .rsp-ld-symbol-wrap svg path).
  return `
    <svg width="200" height="145" viewBox="0 0 180 130" fill="none" class="rsp-ld-symbol-svg">
      <rect x="60" y="8"  width="20" height="6" rx="3" class="rsp-ld-sym-fill" opacity="0.9" />
      <rect x="100" y="8" width="20" height="6" rx="3" class="rsp-ld-sym-fill" opacity="0.9" />
      <rect x="50" y="22"  width="15" height="6" rx="3" class="rsp-ld-sym-fill" opacity="0.9" />
      <rect x="75" y="22"  width="30" height="6" rx="3" class="rsp-ld-sym-fill" opacity="0.9" />
      <rect x="115" y="22" width="15" height="6" rx="3" class="rsp-ld-sym-fill" opacity="0.9" />
      <path d="M 20 118 Q 35 80 70 62"   class="rsp-ld-sym-stroke" stroke-width="5.5" stroke-linecap="round" fill="none" />
      <path d="M 160 118 Q 145 80 110 62" class="rsp-ld-sym-stroke" stroke-width="5.5" stroke-linecap="round" fill="none" />
      <path d="M 52 118 Q 58 85 90 70"   class="rsp-ld-sym-stroke" stroke-width="5.5" stroke-linecap="round" fill="none" />
      <path d="M 128 118 Q 122 85 90 70"  class="rsp-ld-sym-stroke" stroke-width="5.5" stroke-linecap="round" fill="none" />
      <path d="M 70 62 Q 90 54 110 62"   class="rsp-ld-sym-stroke" stroke-width="5.5" stroke-linecap="round" fill="none" />
      <line x1="90" y1="70" x2="90" y2="50" class="rsp-ld-sym-stroke" stroke-width="1.5" opacity="0.5" />
      <line x1="52" y1="118" x2="128" y2="118" class="rsp-ld-sym-stroke" stroke-width="1.5" opacity="0.35" />
      <line x1="20" y1="118" x2="160" y2="118" class="rsp-ld-sym-stroke" stroke-width="1.5" opacity="0.35" />
      <circle cx="90" cy="50" r="2.5" class="rsp-ld-sym-fill" opacity="0.9" />
    </svg>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
function startGlobeAnimation(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let animId;
  let t = 0;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.42;

  const particles = [];
  for (let i = 0; i < 280; i++) {
    particles.push({
      lat: (Math.random() - 0.5) * Math.PI,
      lon: Math.random() * Math.PI * 2,
      size: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.0004 + 0.0001,
      bright: Math.random(),
    });
  }

  const streaks = [];
  for (let i = 0; i < 25; i++) {
    const angle = (Math.random() - 0.5) * 0.4;
    streaks.push({
      x: Math.random() * W,
      y: cy + (Math.random() - 0.5) * 40,
      len: Math.random() * 80 + 20,
      angle,
      alpha: Math.random() * 0.7 + 0.1,
      speed: (Math.random() * 3 + 2) * (Math.random() > 0.5 ? 1 : -1),
    });
  }

  function globePoint(lat, lon) {
    const x = cx + R * Math.cos(lat) * Math.sin(lon);
    const y = cy + R * Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(lon);
    return { x, y, z };
  }

  function draw() {
    t += 0.005;
    ctx.clearRect(0, 0, W, H);

    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
    bgGrad.addColorStop(0, 'rgba(0,60,180,0.22)');
    bgGrad.addColorStop(0.6, 'rgba(0,30,100,0.18)');
    bgGrad.addColorStop(1, 'rgba(0,10,40,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    const gridGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.2, 0, cx, cy, R);
    gridGrad.addColorStop(0, 'rgba(20,120,255,0.28)');
    gridGrad.addColorStop(0.5, 'rgba(0,60,180,0.15)');
    gridGrad.addColorStop(1, 'rgba(0,20,80,0.08)');
    ctx.fillStyle = gridGrad;
    ctx.fillRect(0, 0, W, H);

    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const lat = (i / steps) * Math.PI - Math.PI / 2;
      ctx.beginPath();
      let first = true;
      for (let j = 0; j <= 120; j++) {
        const lon = (j / 120) * Math.PI * 2 + t * 0.3;
        const p = globePoint(lat, lon);
        if (p.z > 0) {
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else ctx.lineTo(p.x, p.y);
        } else first = true;
      }
      ctx.strokeStyle = `rgba(0,180,255,${0.05 + Math.abs(Math.cos(lat)) * 0.08})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    for (let i = 0; i <= steps; i++) {
      const lon = (i / steps) * Math.PI * 2 + t * 0.3;
      ctx.beginPath();
      let first = true;
      for (let j = 0; j <= 80; j++) {
        const lat = (j / 80) * Math.PI - Math.PI / 2;
        const p = globePoint(lat, lon);
        if (p.z > 0) {
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else ctx.lineTo(p.x, p.y);
        } else first = true;
      }
      ctx.strokeStyle = `rgba(0,160,255,0.06)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    particles.forEach((p) => {
      p.lon += p.speed;
      const pt = globePoint(p.lat, p.lon + t * 0.25);
      if (pt.z <= 0) return;
      const flicker = 0.5 + 0.5 * Math.sin(t * 8 + p.bright * 10);
      const alpha = (0.4 + 0.6 * pt.z) * (0.6 + 0.4 * flicker);
      const color = p.bright > 0.7 ? `rgba(255,60,60,${alpha * 0.8})` : `rgba(0,220,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.size * pt.z, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    ctx.restore();

    const rimGrad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.05);
    rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
    rimGrad.addColorStop(0.6, 'rgba(0,100,255,0.12)');
    rimGrad.addColorStop(1, 'rgba(0,180,255,0.35)');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 8;
    ctx.stroke();

    const beamAlpha = 0.35 + 0.15 * Math.sin(t * 2);
    const beamGrad = ctx.createLinearGradient(0, cy, W, cy);
    beamGrad.addColorStop(0, 'rgba(255,20,20,0)');
    beamGrad.addColorStop(0.3, `rgba(255,20,20,${beamAlpha})`);
    beamGrad.addColorStop(0.5, `rgba(255,60,60,${beamAlpha * 1.4})`);
    beamGrad.addColorStop(0.7, `rgba(255,20,20,${beamAlpha})`);
    beamGrad.addColorStop(1, 'rgba(255,20,20,0)');
    ctx.beginPath();
    ctx.rect(0, cy - 1.5, W, 3);
    ctx.fillStyle = beamGrad;
    ctx.fill();

    streaks.forEach((s) => {
      s.x += s.speed;
      if (s.x > W + s.len) s.x = -s.len;
      if (s.x < -s.len) s.x = W + s.len;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      const sg = ctx.createLinearGradient(-s.len / 2, 0, s.len / 2, 0);
      sg.addColorStop(0, 'rgba(0,200,255,0)');
      sg.addColorStop(0.5, `rgba(0,200,255,${s.alpha * 0.5})`);
      sg.addColorStop(1, 'rgba(0,200,255,0)');
      ctx.beginPath();
      ctx.rect(-s.len / 2, -0.8, s.len, 1.6);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.restore();
    });

    animId = requestAnimationFrame(draw);
  }
  draw();

  return () => cancelAnimationFrame(animId);
}

// ─────────────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('rsp-loading-css')) return;
  const s = document.createElement('style');
  s.id = 'rsp-loading-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

    #rsp-loading {
      position: fixed; inset: 0; z-index: 10000;
      background: #030810; overflow: hidden;
      font-family: 'Orbitron', sans-serif;
      opacity: 1; transition: opacity 0.8s ease;
    }
    #rsp-loading.rsp-ld-done { opacity: 0; pointer-events: none; }

    #rsp-loading-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    }

    .rsp-ld-vignette {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(to bottom, rgba(3,8,16,0.55) 0%, rgba(3,8,16,0.1) 40%, rgba(3,8,16,0.1) 60%, rgba(3,8,16,0.7) 100%);
    }
    .rsp-ld-scanline {
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: rgba(0,180,255,0.15);
      animation: rsp-ld-scanline 6s linear infinite;
      pointer-events: none;
    }
    @keyframes rsp-ld-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }

    .rsp-ld-diag { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0.6; }

    /* HUD corners */
    .rsp-ld-corner {
      position: absolute; width: 180px; display: flex; flex-direction: column; gap: 3px;
      opacity: 0; animation: rsp-ld-fade-hud 1.5s ease forwards; animation-delay: 0.8s;
    }
    #rsp-loading.rsp-ld-show .rsp-ld-corner { animation-play-state: running; }
    @keyframes rsp-ld-fade-hud { to { opacity: 1; } }
    .rsp-ld-corner-tl { top: 16px; left: 16px; }
    .rsp-ld-corner-tr { top: 16px; right: 16px; }
    .rsp-ld-corner-bl { bottom: 16px; left: 16px; }
    .rsp-ld-corner-br { bottom: 16px; right: 16px; }

    .rsp-ld-corner-box {
      border: 1px solid rgba(255,20,40,0.7);
      height: 28px; position: relative; margin-bottom: 4px;
    }
    .rsp-ld-corner-box-tl { border-bottom: none; border-right: none; }
    .rsp-ld-corner-box-tr { border-bottom: none; border-left: none; }
    .rsp-ld-corner-box-bl { border-top: none; border-right: none; }
    .rsp-ld-corner-box-br { border-top: none; border-left: none; }

    .rsp-ld-corner-tick { position: absolute; width: 50px; height: 1px; background: rgba(255,20,40,0.7); }
    .rsp-ld-corner-tick-tl { bottom: -1px; right: -1px; }
    .rsp-ld-corner-tick-tr { bottom: -1px; left: -1px; }
    .rsp-ld-corner-tick-bl { top: -1px; right: -1px; }
    .rsp-ld-corner-tick-br { top: -1px; left: -1px; }

    .rsp-ld-corner-label {
      position: absolute; font-size: 9px; color: rgba(255,60,60,0.9);
      font-family: monospace; letter-spacing: 0.15em;
    }
    .rsp-ld-corner-label-tl { top: 3px; left: 6px; }
    .rsp-ld-corner-label-tr { top: 3px; right: 6px; }
    .rsp-ld-corner-label-bl { bottom: 3px; left: 6px; }
    .rsp-ld-corner-label-br { bottom: 3px; right: 6px; }

    .rsp-ld-hudline {
      font-size: 9px; color: rgba(0,220,255,0.65);
      font-family: monospace; letter-spacing: 0.08em;
      opacity: 0; animation: rsp-ld-typein 0.3s ease forwards;
    }
    @keyframes rsp-ld-typein { from { opacity:0; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }

    /* Top mark */
    .rsp-ld-topmark {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px;
      opacity: 0; transition: opacity 1s;
    }
    #rsp-loading.rsp-ld-show .rsp-ld-topmark { opacity: 1; }
    .rsp-ld-topline { width: 60px; height: 2px; }
    .rsp-ld-topline-l { background: linear-gradient(to right, transparent, rgba(255,20,40,0.8)); }
    .rsp-ld-topline-r { background: linear-gradient(to left, transparent, rgba(255,20,40,0.8)); }
    .rsp-ld-diamond { width: 12px; height: 12px; border: 2px solid rgba(255,20,40,0.8); transform: rotate(45deg); }

    /* Center content */
    .rsp-ld-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding-bottom: 40px;
      opacity: 0; transition: opacity 0.8s ease;
    }
    #rsp-loading.rsp-ld-show .rsp-ld-center { opacity: 1; }

    .rsp-ld-title {
      font-size: clamp(28px,5vw,52px); font-weight: 900; letter-spacing: 0.3em;
      color: #fff; text-transform: uppercase; font-family: 'Orbitron', sans-serif;
      animation: rsp-ld-glow-text 2s ease-in-out infinite; margin-bottom: 16px;
      text-shadow: 0 0 20px rgba(0,200,255,0.8), 0 0 40px rgba(0,200,255,0.4);
    }
    @keyframes rsp-ld-glow-text {
      0%,100% { text-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
      50%      { text-shadow: 0 0 30px currentColor, 0 0 80px currentColor; }
    }

    .rsp-ld-symbol-wrap { animation: rsp-ld-pulse-ring 2.5s ease-in-out infinite; }
    @keyframes rsp-ld-pulse-ring {
      0%,100% { transform: scale(0.95); opacity: 0.7; }
      50%      { transform: scale(1.02); opacity: 1; }
    }
    .rsp-ld-symbol-svg {
      filter: drop-shadow(0 0 8px #00d4ff) drop-shadow(0 0 24px #00d4ff) drop-shadow(0 0 48px #00d4ff);
      animation: rsp-ld-symbol-color 6s ease-in-out infinite;
    }
    .rsp-ld-sym-fill   { fill: #00d4ff; transition: fill 0.5s; }
    .rsp-ld-sym-stroke { stroke: #00d4ff; transition: stroke 0.5s; }
    @keyframes rsp-ld-symbol-color {
      0%, 55%  { filter: drop-shadow(0 0 8px #00d4ff) drop-shadow(0 0 24px #00d4ff) drop-shadow(0 0 48px #00d4ff); }
      75%,100% { filter: drop-shadow(0 0 8px #ff1428) drop-shadow(0 0 24px #ff1428) drop-shadow(0 0 48px #ff1428); }
    }
    .rsp-ld-symbol-svg .rsp-ld-sym-fill,
    .rsp-ld-symbol-svg .rsp-ld-sym-stroke { animation: rsp-ld-symbol-fillcolor 6s ease-in-out infinite; }
    @keyframes rsp-ld-symbol-fillcolor {
      0%, 55%  { fill: #00d4ff; stroke: #00d4ff; }
      75%,100% { fill: #ff1428; stroke: #ff1428; }
    }

    .rsp-ld-phase {
      font-size: clamp(10px,1.5vw,14px); letter-spacing: 0.3em;
      color: rgba(255,255,255,0.85); font-family: 'Share Tech Mono', monospace;
      margin-top: 20px; margin-bottom: 14px;
      text-shadow: 0 0 10px rgba(0,200,255,0.6); min-height: 1.4em;
    }

    .rsp-ld-barwrap { width: clamp(260px,38vw,480px); display: flex; flex-direction: column; gap: 6px; }
    .rsp-ld-bartrack {
      width: 100%; height: 6px; background: rgba(255,255,255,0.08);
      border: 1px solid rgba(0,180,255,0.25); border-radius: 2px; overflow: hidden; position: relative;
    }
    .rsp-ld-barfill {
      height: 100%; width: 0%;
      background: linear-gradient(to right,#0044cc,#0088ff,#00ccff);
      border-radius: 2px; transition: width 0.1s linear, background 0.5s ease;
      position: relative;
      box-shadow: 0 0 12px rgba(0,180,255,0.8), 0 0 24px rgba(0,180,255,0.4);
    }
    .rsp-ld-barfill.rsp-ld-red {
      background: linear-gradient(to right,#cc0020,#ff2244,#ff5566);
      box-shadow: 0 0 12px rgba(255,30,50,0.8), 0 0 24px rgba(255,30,50,0.4);
    }
    .rsp-ld-barshine {
      position: absolute; top: 0; left: 0; width: 30%; height: 100%;
      background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent);
      animation: rsp-ld-bar-shine 1.5s linear infinite;
    }
    @keyframes rsp-ld-bar-shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }

    .rsp-ld-barlabels {
      display: flex; justify-content: space-between; font-size: 9px;
      color: rgba(0,200,255,0.6); font-family: monospace; letter-spacing: 0.1em;
    }
  `;
  document.head.appendChild(s);
}
