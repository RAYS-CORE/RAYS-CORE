import React, { useEffect, useRef } from "react";

interface FluidGlobeVisualizerProps {
  audioLevel?: number; // 0.0 to 1.0 normalized
  isActive?: boolean;
  isSpeaking?: boolean;
  isRouting?: boolean;
  className?: string;
  size?: number;
}

export const FluidGlobeVisualizer: React.FC<FluidGlobeVisualizerProps> = ({
  audioLevel = 0,
  isActive = false,
  isSpeaking = false,
  isRouting = false,
  className = "",
  size = 760,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioLevelRef = useRef<number>(0);
  const isRoutingRef = useRef<boolean>(false);
  const smoothedLevelRef = useRef<number>(0);

  audioLevelRef.current = audioLevel;
  isRoutingRef.current = isRouting;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Retina High-DPI Resolution scaling for crystal-clear 4K HD rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (gl) {
      // ──────────────────────────────────────────────────────────────────────
      // ULTRA-HD VOLUMETRIC FLUID SPHERE SHADER (4K SIMPLEX GRADIENT NOISE)
      // ──────────────────────────────────────────────────────────────────────
      const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = (a_position + 1.0) * 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_audio;
        uniform float u_routing;

        // ────────────────────────────────────────────────────────────────────
        // HIGH-PRECISION 3D SIMPLEX NOISE (ZERO ARTIFACTS / NO SINE BREAKDOWN)
        // ────────────────────────────────────────────────────────────────────
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

          // First corner
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);

          // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          // Permutations
          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

          // Gradients
          float n_ = 0.142857142857; // 1.0 / 7.0
          vec3 ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);

          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);

          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);

          // Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

          // Mix contributions
          vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }

        // Multi-Scale Fractal Brownian Motion with High-Frequency Detail
        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.50;
          vec3 shift = vec3(100.0);
          for (int i = 0; i < 5; ++i) {
            v += a * snoise(p);
            p = p * 2.08 + shift;
            a *= 0.50;
          }
          return v;
        }

        // Deep Royal Violet & Luminous Neon Purple Color Spectrum
        vec3 fluidColorPalette(float t) {
          vec3 c0 = vec3(0.04, 0.01, 0.12); // Deep Obsidian Abyss
          vec3 c1 = vec3(0.20, 0.02, 0.48); // Royal Deep Violet
          vec3 c2 = vec3(0.48, 0.06, 0.90); // Vivid Neon Purple (#7a10e6)
          vec3 c3 = vec3(0.68, 0.18, 1.00); // Electric Violet (#ae2eff)
          vec3 c4 = vec3(0.88, 0.60, 1.00); // Luminous Ice Lilac (#e099ff)

          vec3 col = mix(c0, c1, smoothstep(0.0, 0.22, t));
          col = mix(col, c2, smoothstep(0.22, 0.50, t));
          col = mix(col, c3, smoothstep(0.50, 0.78, t));
          col = mix(col, c4, smoothstep(0.78, 1.0, t));
          return col;
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

          // Audio-reactive breathing & scale
          float pulse = sin(u_time * 1.3) * 0.007;
          float audioScale = u_audio * 0.042;
          float globeRadius = 0.29 + pulse + audioScale;

          float dist = length(uv);

          // ──────────────────────────────────────────────────────────────────
          // 1. HD Volumetric Radiant Atmosphere & Corona (Violet / Neon Purple)
          // ──────────────────────────────────────────────────────────────────
          float coronaRadius = globeRadius * (1.32 + u_audio * 0.20);
          float coronaDist = (dist - globeRadius) / max(0.001, (coronaRadius - globeRadius));
          vec4 coronaColor = vec4(0.0);

          if (dist > globeRadius && dist < coronaRadius) {
            float cFactor = 1.0 - smoothstep(0.0, 1.0, coronaDist);
            float angle = atan(uv.y, uv.x);
            float streamers = snoise(vec3(cos(angle * 4.0), sin(angle * 4.0), u_time * 0.22)) * 0.25 +
                              snoise(vec3(cos(angle * 8.0), sin(angle * 8.0), u_time * 0.40)) * 0.15;

            float intensity = pow(cFactor, 2.0) * (0.88 + streamers + u_audio * 1.15);
            vec3 cGrad = mix(vec3(0.32, 0.04, 0.70), vec3(0.62, 0.12, 0.96), cFactor);
            cGrad = mix(cGrad, vec3(0.85, 0.55, 1.00), pow(cFactor, 2.6));
            coronaColor = vec4(cGrad * intensity, intensity * 0.80 * smoothstep(1.0, 0.82, coronaDist));
          }

          // ──────────────────────────────────────────────────────────────────
          // 2. 3D Raymarched Fluid Sphere with Analytical 3D Lighting
          // ──────────────────────────────────────────────────────────────────
          if (dist <= globeRadius) {
            // True 3D spherical surface coordinate
            float z = sqrt(max(0.0, globeRadius * globeRadius - dist * dist));
            vec3 norm = vec3(uv.x, uv.y, z) / globeRadius;
            vec3 p = norm;

            // Slow, majestic continuous fluid rotation
            float slowSpeed = 0.024 + u_routing * 0.05;
            float rotY = u_time * slowSpeed;
            float cosY = cos(rotY);
            float sinY = sin(rotY);
            p = vec3(p.x * cosY + p.z * sinY, p.y, -p.x * sinY + p.z * cosY);

            float tilt = 0.24;
            float cosT = cos(tilt);
            float sinT = sin(tilt);
            p = vec3(p.x, p.y * cosT - p.z * sinT, p.y * sinT + p.z * cosT);

            // Double Domain-Warped Viscous Fluid Simulation
            float t = u_time * 0.028;
            vec3 q = vec3(fbm(p * 2.4 + vec3(0.0, t, 0.0)),
                          fbm(p * 2.4 + vec3(t * 0.5, 0.0, t * 0.3)),
                          fbm(p * 2.4 + vec3(t * 0.2, t * 0.3, 0.0)));

            vec3 r = vec3(fbm(p * 3.6 + 1.8 * q + vec3(0.0, t * 1.1, 0.0)),
                          fbm(p * 3.6 + 1.8 * q + vec3(t * 0.8, t * 0.6, 0.0)),
                          fbm(p * 3.6 + 1.8 * q + vec3(0.0, 0.0, t * 0.9)));

            float f = fbm(p * 2.0 + 1.6 * r + vec3(u_time * 0.018, 0.0, 0.0));

            // Palette Mapping
            vec3 surfColor = fluidColorPalette(clamp(f * 1.30, 0.0, 1.0));

            // ────────────────────────────────────────────────────────────────
            // 3. HD Surface Energy Fissures with Sub-Pixel Sharpness
            // ────────────────────────────────────────────────────────────────
            float fissureNoise = snoise(p * 5.8 + r * 2.2);
            float fissure = 1.0 - smoothstep(0.0, 0.10, abs(fissureNoise - 0.5));
            fissure = pow(fissure, 1.8) * (0.42 + u_audio * 0.58);
            surfColor = mix(surfColor, surfColor + vec3(0.92, 0.84, 1.00) * 0.70, fissure);

            // ────────────────────────────────────────────────────────────────
            // 4. Analytical Directional Lighting + Subsurface Scattering (SSS)
            // ────────────────────────────────────────────────────────────────
            vec3 keyLight = normalize(vec3(0.55, 0.75, 0.90));
            vec3 rimLight = normalize(vec3(-0.50, -0.30, -0.60));

            float diffuse = max(0.0, dot(norm, keyLight)) * 0.35 + 0.65;
            float sss = pow(max(0.0, dot(-keyLight, norm)), 2.5) * 0.35;
            vec3 sssColor = vec3(0.65, 0.15, 0.95) * sss;

            // Specular micro-glint reflection on fluid crests
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            vec3 halfVec = normalize(keyLight + viewDir);
            float spec = pow(max(0.0, dot(norm, halfVec)), 28.0) * (0.35 + u_audio * 0.45);
            vec3 specColor = vec3(0.96, 0.90, 1.00) * spec;

            surfColor = surfColor * diffuse + sssColor + specColor;

            // ────────────────────────────────────────────────────────────────
            // 5. Spherical Fresnel Rim Glow (Luminous Neon Violet)
            // ────────────────────────────────────────────────────────────────
            float fresnel = pow(1.0 - abs(z / globeRadius), 2.2);
            vec3 limbGlow = mix(vec3(0.58, 0.10, 0.96), vec3(0.85, 0.55, 1.00), 0.5) * fresnel * (1.20 + u_audio * 0.85);
            surfColor += limbGlow;

            // Razor-Sharp Anti-Aliased Edge
            float edgeFade = smoothstep(globeRadius, globeRadius - (1.8 / min(u_resolution.x, u_resolution.y)), dist);

            gl_FragColor = vec4(surfColor, edgeFade);
          } else if (dist < coronaRadius) {
            gl_FragColor = coronaColor;
          } else {
            gl_FragColor = vec4(0.0);
          }
        }
      `;

      const compileShader = (src: string, type: number) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn("Shader compilation notice:", gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };

      const vs = compileShader(vsSource, gl.VERTEX_SHADER);
      const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);

      if (vs && fs) {
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        const positionLocation = gl.getAttribLocation(program, "a_position");
        const uResolution = gl.getUniformLocation(program, "u_resolution");
        const uTime = gl.getUniformLocation(program, "u_time");
        const uAudio = gl.getUniformLocation(program, "u_audio");
        const uRouting = gl.getUniformLocation(program, "u_routing");

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
          ]),
          gl.STATIC_DRAW
        );

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        let animId: number;
        const startTime = performance.now();

        const renderLoop = (now: number) => {
          const elapsed = (now - startTime) * 0.001;

          const targetAudio = audioLevelRef.current || 0;
          smoothedLevelRef.current += (targetAudio - smoothedLevelRef.current) * 0.22;
          const sLevel = smoothedLevelRef.current;

          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(uResolution, canvas.width, canvas.height);
          gl.uniform1f(uTime, elapsed);
          gl.uniform1f(uAudio, sLevel);
          gl.uniform1f(uRouting, isRoutingRef.current ? 1.0 : 0.0);

          gl.drawArrays(gl.TRIANGLES, 0, 6);
          animId = requestAnimationFrame(renderLoop);
        };

        animId = requestAnimationFrame(renderLoop);

        return () => {
          cancelAnimationFrame(animId);
          gl.deleteProgram(program);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
        };
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // High-Quality Procedural Canvas 2D Fallback (Violet & Neon Purple Palette)
    // ────────────────────────────────────────────────────────────────────────
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let fallbackAnim: number;

    const fallbackRender = () => {
      time += 0.02;
      const targetAudio = audioLevelRef.current || 0;
      smoothedLevelRef.current += (targetAudio - smoothedLevelRef.current) * 0.2;
      const sLevel = smoothedLevelRef.current;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      const rad = (w / 2) * (0.60 + sLevel * 0.1);

      // Solar Corona in Neon Violet
      const corona = ctx.createRadialGradient(cx, cy, rad * 0.8, cx, cy, rad * 1.35);
      corona.addColorStop(0, "rgba(179, 51, 255, 0.45)");
      corona.addColorStop(0.5, "rgba(133, 20, 240, 0.25)");
      corona.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = corona;
      ctx.fill();

      // Plasma Sun Surface
      const core = ctx.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
      core.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      core.addColorStop(0.25, "rgba(224, 158, 255, 0.94)");
      core.addColorStop(0.5, "rgba(179, 51, 255, 0.92)");
      core.addColorStop(0.75, "rgba(100, 15, 200, 0.95)");
      core.addColorStop(1, "rgba(15, 2, 30, 0.98)");

      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      fallbackAnim = requestAnimationFrame(fallbackRender);
    };

    fallbackAnim = requestAnimationFrame(fallbackRender);

    return () => {
      cancelAnimationFrame(fallbackAnim);
    };
  }, [size]);

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="pointer-events-none drop-shadow-[0_0_100px_rgba(133,20,240,0.65)]"
      />
    </div>
  );
};
