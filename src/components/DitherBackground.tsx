import { useEffect, useRef, useState } from "react";

// Fond « dither » discret (inspiré de reactbits.dev/backgrounds/dither) :
// vagues animées + tramage ordonné (Bayer 4x4), concentré en haut à droite,
// aux couleurs de la charte. WebGL2 autonome, aucune dépendance, 100 % local.
// Entièrement défensif : si WebGL échoue (certains webviews), on retombe sur
// un dégradé CSS discret — jamais d'erreur qui casserait l'application.

const VERT = `#version 300 es
precision highp float;
const vec2 pos[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(pos[gl_VertexID], 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uRes;
out vec4 fragColor;

const float bayer[16] = float[16](
  0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.02;
  float f = 0.9 * 12.0;
  float w = 0.0;
  w += sin(uv.x * f + t * 3.0);
  w += sin(uv.y * f * 1.2 - t * 2.4);
  w += sin((uv.x + uv.y) * f * 0.8 + t * 1.7);
  w /= 3.0;
  float val = 0.5 + 0.5 * w;
  int ix = int(mod(gl_FragCoord.x, 4.0));
  int iy = int(mod(gl_FragCoord.y, 4.0));
  float threshold = (bayer[iy * 4 + ix] + 0.5) / 16.0;
  float levels = 2.5;
  float q = floor(val * levels + threshold) / levels;
  float corner = smoothstep(0.4, 1.0, uv.x) * smoothstep(0.4, 1.0, uv.y);
  float a = q * corner * 0.45;
  fragColor = vec4(vec3(0.694, 0.070, 0.105), a);
}`;

export function DitherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let cleanup: (() => void) | undefined;

    try {
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      });
      if (!gl) {
        setFallback(true);
        return;
      }

      const compile = (type: number, src: string): WebGLShader | null => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      if (!vs || !fs || !prog) {
        setFallback(true);
        return;
      }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        setFallback(true);
        return;
      }
      gl.useProgram(prog);

      const uTime = gl.getUniformLocation(prog, "uTime");
      const uRes = gl.getUniformLocation(prog, "uRes");

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.floor(window.innerWidth * dpr);
        const h = Math.floor(window.innerHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener("resize", resize);

      let start = 0;
      const render = (ts: number) => {
        if (!start) start = ts;
        gl.uniform1f(uTime, (ts - start) / 1000);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      // WebGL indisponible ou en échec : repli CSS, sans jamais planter.
      setFallback(true);
    }

    return () => cleanup?.();
  }, []);

  if (fallback) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 55% at 100% 0%, rgba(177,18,27,0.10), transparent 70%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
