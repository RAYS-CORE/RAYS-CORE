import './landing.css';

export function mountLandingPage(onEnter) {
  const SPOT_COUNT = 48;

  /* ── Generate star box-shadow strings ── */
  function starShadows(n, size) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const x = Math.floor(Math.random() * 2000);
      const y = Math.floor(Math.random() * 2000);
      parts.push(`${x}px ${y}px #FFF`);
    }
    return parts.join(', ');
  }

  /* ── Inject star shadows as a <style> tag (avoids huge inline styles) ── */
  function injectStarStyles() {
    const small  = starShadows(700);
    const medium = starShadows(200);
    const big    = starShadows(100);
    const s = document.createElement('style');
    s.textContent = `
      .rsp-stars  { box-shadow: ${small};  }
      .rsp-stars::after  { box-shadow: ${small};  width:1px; height:1px; background:transparent; }
      .rsp-stars2 { box-shadow: ${medium}; }
      .rsp-stars2::after { box-shadow: ${medium}; width:2px; height:2px; background:transparent; }
      .rsp-stars3 { box-shadow: ${big};    }
      .rsp-stars3::after { box-shadow: ${big};    width:3px; height:3px; background:transparent; }
    `;
    document.head.appendChild(s);
  }
  injectStarStyles();

  /* ── Per-spot keyframes for hover drift and click burst ── */
  function injectSpotKeyframes() {
    const style = document.createElement('style');
    let css = '';
    for (let i = 0; i < SPOT_COUNT; i++) {
      const angle = (i / SPOT_COUNT) * 360 + (Math.random() * 15 - 7);
      const dist  = 60 + Math.random() * 60;
      const dx = Math.round(Math.cos((angle * Math.PI) / 180) * dist);
      const dy = Math.round(Math.sin((angle * Math.PI) / 180) * dist);
      css += `@keyframes rsp-hover-${i}{0%{opacity:0;transform:translate(-50%,-50%);}20%{opacity:.85;}100%{opacity:0;transform:translate(calc(-50% + ${Math.round(dx*0.6)}px),calc(-50% + ${Math.round(dy*0.6)}px));}}`;
      css += `@keyframes rsp-burst-${i}{0%{opacity:0;transform:translate(-50%,-50%) scale(0);}15%{opacity:1;transform:translate(calc(-50% + ${Math.round(dx*0.3)}px),calc(-50% + ${Math.round(dy*0.3)}px)) scale(1);}100%{opacity:0;transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0.3);}}`;
    }
    style.textContent = css;
    document.head.appendChild(style);
  }
  injectSpotKeyframes();

  /* ── Build spot elements ── */
  function makeSpots() {
    const hues = [8, 30, 55, 90, 140, 175, 200, 220, 260, 290, 330, 355];
    return Array.from({ length: SPOT_COUNT }).map((_, i) => {
      const hue  = hues[i % hues.length];
      const size = 6 + Math.round(Math.random() * 8);
      const hDur = (0.55 + Math.random() * 0.4).toFixed(2);
      const hDel = (Math.random() * 0.25).toFixed(2);
      const bDur = (0.7  + Math.random() * 0.4).toFixed(2);
      const bDel = (Math.random() * 0.3).toFixed(2);
      return `<div class="rsp-spot" style="
        background:hsl(${hue},57%,65%);
        width:${size}px;height:${size}px;
        left:140px;top:27px;
        --hi:rsp-hover-${i};--hd:${hDur}s;--hdel:${hDel}s;
        --bi:rsp-burst-${i};--bd:${bDur}s;--bdel:${bDel}s;
      "></div>`;
    }).join('');
  }

  /* ── DOM ── */
  const landing = document.createElement('div');
  landing.id = 'rsp-landing';

  landing.innerHTML = `
    <!-- Star layers (behind everything) -->
    <div class="rsp-stars"></div>
    <div class="rsp-stars2"></div>
    <div class="rsp-stars3"></div>

    <div class="rsp-hud-corner rsp-hud-tl"></div>
    <div class="rsp-hud-corner rsp-hud-tr"></div>
    <div class="rsp-hud-corner rsp-hud-bl"></div>
    <div class="rsp-hud-corner rsp-hud-br"></div>

    <div class="rsp-center">
      <div class="rsp-logo">RAYSpy</div>
      <div class="rsp-tagline">NO PLACE LEFT BEHIND</div>

      <div class="rsp-badge">
        <span>OPEN DATA // PUBLIC FEEDS // EDUCATIONAL</span>
        <span>TLE &middot; ADS-B &middot; CCTV MESH</span>
      </div>

      <div class="rsp-enter-label">ENTER RAYSPY SYSTEM</div>
      <div class="rsp-chevron">&#8964;</div>

      <div class="rsp-btn-wrap" id="rsp-btn-wrap">
        ${makeSpots()}
        <button type="button" class="rsp-button-inner" id="rsp-btn">
          <span class="rsp-t">ENTER SYSTEM<br/><small>CLICK TO ACCESS DASHBOARD</small></span>
          <i class="rsp-arrow">&#8594;</i>
          <i class="rsp-tick">&#10003;</i>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(landing);

  const btn  = landing.querySelector('#rsp-btn');
  const wrap = landing.querySelector('#rsp-btn-wrap');
  let clicked = false;

  btn.addEventListener('click', () => {
    if (clicked) return;
    clicked = true;
    wrap.classList.add('rsp-clicked');
    setTimeout(() => {
      landing.classList.add('rsp-exit');
      setTimeout(() => { landing.remove(); onEnter(); }, 600);
    }, 5000);
  });
}
