/**
 * PrismaticBurst — Vanilla WebGL background animation
 * Adapted from the PrismaticBurst React/OGL component.
 * Usage:
 *   const burst = new PrismaticBurst(containerEl, { colors: ['#FFB300','#7C4DFF'], intensity: 2 });
 *   burst.destroy(); // cleanup
 */
(function (global) {
  'use strict';

  var VS = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  var FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform int   uAnimType;
uniform vec2  uMouse;
uniform int   uColorCount;
uniform float uDistort;
uniform vec2  uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int   uRayCount;

float hash21(vec2 p) {
  p = floor(p);
  float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
  return fract(f);
}

mat2 rot30() { return mat2(0.8, -0.5, 0.5, 0.8); }

float layeredNoise(vec2 fragPx) {
  vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
  vec2 q = rot30() * p;
  float n = 0.0;
  n += 0.40 * hash21(q);
  n += 0.25 * hash21(q * 2.0 + 17.0);
  n += 0.20 * hash21(q * 4.0 + 47.0);
  n += 0.10 * hash21(q * 8.0 + 113.0);
  n += 0.05 * hash21(q * 16.0 + 191.0);
  return n;
}

vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist) {
  float focal = res.y * max(dist, 1e-3);
  return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset) {
  vec2 toC = frag - 0.5 * res - offset;
  float r = length(toC) / (0.5 * min(res.x, res.y));
  float x = clamp(r, 0.0, 1.0);
  float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  float s = q * 0.5;
  s = pow(s, 1.5);
  float tail = 1.0 - pow(1.0 - s, 2.0);
  s = mix(s, tail, 0.2);
  float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
  return clamp(s + dn, 0.0, 1.0);
}

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  return texture(uGradient, vec2(t, 0.5)).rgb;
}

vec2 rot2d(vec2 v, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float bendAngle(vec3 q, float t) {
  return 0.8 * sin(q.x * 0.55 + t * 0.6)
       + 0.7 * sin(q.y * 0.50 - t * 0.5)
       + 0.6 * sin(q.z * 0.60 + t * 0.7);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float t = uTime * uSpeed;
  float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
  vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
  float marchT = 0.0;
  vec3 col = vec3(0.0);
  float n = layeredNoise(frag);
  vec4 cv = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
  mat2 M2 = mat2(cv.x, cv.y, cv.z, cv.w);
  float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

  mat3 rot3dMat = mat3(1.0);
  if (uAnimType == 1) {
    vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
    rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
  }
  mat3 hoverMat = mat3(1.0);
  if (uAnimType == 2) {
    vec2 m = uMouse * 2.0 - 1.0;
    hoverMat = rotY(m.x * 0.6) * rotX(m.y * 0.6);
  }

  for (int i = 0; i < 44; ++i) {
    vec3 P = marchT * dir;
    P.z -= 2.0;
    float rad = length(P);
    vec3 Pl = P * (10.0 / max(rad, 1e-6));

    if (uAnimType == 0) {
      vec2 tmp = M2 * vec2(Pl.x, Pl.z);
      Pl.x = tmp.x; Pl.z = tmp.y;
    } else if (uAnimType == 1) {
      Pl = rot3dMat * Pl;
    } else {
      Pl = hoverMat * Pl;
    }

    float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;
    float grow = smoothstep(0.35, 3.0, marchT);
    float a1 = amp * grow * bendAngle(Pl * 0.6, t);
    float a2 = 0.5 * amp * grow * bendAngle(vec3(Pl.z, Pl.y, Pl.x) * 0.5 + 3.1, t * 0.9);
    vec3 Pb = Pl;
    vec2 rxz = rot2d(vec2(Pb.x, Pb.z), a1); Pb.x = rxz.x; Pb.z = rxz.y;
    vec2 rxy = rot2d(vec2(Pb.x, Pb.y), a2); Pb.x = rxy.x; Pb.y = rxy.y;

    float rayPattern = smoothstep(
      0.5, 0.7,
      sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
      sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
    );

    if (uRayCount > 0) {
      float angR = atan(Pb.y, Pb.x);
      float comb = 0.5 + 0.5 * cos(float(uRayCount) * angR);
      comb = pow(comb, 3.0);
      rayPattern *= smoothstep(0.15, 0.95, comb);
    }

    vec3 spectralDefault = 1.0 + vec3(
      cos(marchT * 3.0 + 0.0),
      cos(marchT * 3.0 + 1.0),
      cos(marchT * 3.0 + 2.0)
    );
    float saw = fract(marchT * 0.25);
    float tRay = saw * saw * (3.0 - 2.0 * saw);
    vec3 userGradient = 2.0 * sampleGradient(tRay);
    vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
    vec3 base = (0.05 / (0.4 + stepLen)) * smoothstep(5.0, 0.0, rad) * spectral;
    col += base * rayPattern;
    marchT += stepLen;
  }

  col *= edgeFade(frag, uResolution, uOffset);
  col *= uIntensity;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function hexToRgb(hex) {
    var h = hex.trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function compileShader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[PrismaticBurst] Shader compile error:', gl.getShaderInfoLog(s));
    }
    return s;
  }

  function PrismaticBurst(container, opts) {
    opts = opts || {};
    this.container = container;
    this.paused = !!opts.paused;
    this.raf = null;
    this.mouseTarget = [0.5, 0.5];
    this.mouseSmooth = [0.5, 0.5];
    this.accumTime = 0;
    this.last = performance.now();
    this.opts = {
      intensity:     opts.intensity     !== undefined ? opts.intensity     : 2,
      speed:         opts.speed         !== undefined ? opts.speed         : 0.5,
      animationType: opts.animationType || 'rotate3d',
      colors:        opts.colors        || null,
      distort:       opts.distort       !== undefined ? opts.distort       : 0,
      rayCount:      opts.rayCount      !== undefined ? opts.rayCount      : 24,
      mixBlendMode:  opts.mixBlendMode  || 'screen',
      hoverDampness: opts.hoverDampness !== undefined ? opts.hoverDampness : 0.25,
      offsetX:       opts.offsetX       || 0,
      offsetY:       opts.offsetY       || 0,
      noiseAmount:   opts.noiseAmount   !== undefined ? opts.noiseAmount   : 0.8,
    };
    this._init();
  }

  PrismaticBurst.prototype._init = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;

    var canvas = document.createElement('canvas');
    this.canvas = canvas;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var blend = this.opts.mixBlendMode;
    if (blend && blend !== 'none') canvas.style.mixBlendMode = blend;
    this.container.appendChild(canvas);

    var gl = canvas.getContext('webgl2');
    if (!gl) {
      console.warn('[PrismaticBurst] WebGL2 not available, skipping.');
      return;
    }
    this.gl = gl;

    var vs = compileShader(gl, gl.VERTEX_SHADER, VS);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, FS);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[PrismaticBurst] Program link error:', gl.getProgramInfoLog(prog));
      return;
    }
    this.prog = prog;
    gl.useProgram(prog);

    /* fullscreen triangle */
    var tri = new Float32Array([-1, -1, -1, 3, 3, -1]);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    /* uniform locations */
    var names = ['uResolution','uTime','uIntensity','uSpeed','uAnimType',
                 'uMouse','uColorCount','uDistort','uOffset','uGradient',
                 'uNoiseAmount','uRayCount'];
    this.u = {};
    var self = this;
    names.forEach(function (n) { self.u[n] = gl.getUniformLocation(prog, n); });

    this._buildGradientTex();
    this._setStaticUniforms();
    this._bindResize();
    this._bindPointer();
    this._loop();
  };

  PrismaticBurst.prototype._buildGradientTex = function () {
    var gl = this.gl;
    var colors = this.opts.colors;
    var width = 1, data;
    if (colors && colors.length > 0) {
      width = colors.length;
      data = new Uint8Array(width * 4);
      for (var i = 0; i < colors.length; i++) {
        var rgb = hexToRgb(colors[i]);
        data[i * 4]     = rgb[0];
        data[i * 4 + 1] = rgb[1];
        data[i * 4 + 2] = rgb[2];
        data[i * 4 + 3] = 255;
      }
    } else {
      data = new Uint8Array([255, 255, 255, 255]);
    }
    this.colorCount = colors ? colors.length : 0;
    var tex = gl.createTexture();
    this.gradTex = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  PrismaticBurst.prototype._setStaticUniforms = function () {
    var gl = this.gl;
    var u = this.u;
    var o = this.opts;
    var animMap = { rotate: 0, rotate3d: 1, hover: 2 };
    gl.uniform1f(u.uIntensity, o.intensity);
    gl.uniform1f(u.uSpeed, o.speed);
    gl.uniform1i(u.uAnimType, animMap[o.animationType] !== undefined ? animMap[o.animationType] : 1);
    gl.uniform1f(u.uDistort, o.distort);
    gl.uniform1i(u.uRayCount, Math.max(0, Math.floor(o.rayCount)));
    gl.uniform1f(u.uNoiseAmount, o.noiseAmount);
    gl.uniform2f(u.uOffset, o.offsetX, o.offsetY);
    gl.uniform1i(u.uColorCount, this.colorCount);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.gradTex);
    gl.uniform1i(u.uGradient, 0);
  };

  PrismaticBurst.prototype._resize = function () {
    var gl = this.gl;
    var w = (this.container.clientWidth  || 1);
    var h = (this.container.clientHeight || 1);
    this.canvas.width  = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uResolution, this.canvas.width, this.canvas.height);
  };

  PrismaticBurst.prototype._bindResize = function () {
    var self = this;
    this._resizeFn = function () { self._resize(); };
    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(this._resizeFn);
      this._ro.observe(this.container);
    } else {
      window.addEventListener('resize', this._resizeFn);
    }
    this._resize();
  };

  PrismaticBurst.prototype._bindPointer = function () {
    var self = this;
    this._pointerFn = function (e) {
      var rect = self.container.getBoundingClientRect();
      var x = (e.clientX - rect.left) / Math.max(rect.width,  1);
      var y = (e.clientY - rect.top)  / Math.max(rect.height, 1);
      self.mouseTarget[0] = Math.max(0, Math.min(1, x));
      self.mouseTarget[1] = Math.max(0, Math.min(1, y));
    };
    document.addEventListener('pointermove', this._pointerFn, { passive: true });
  };

  PrismaticBurst.prototype._loop = function () {
    var self = this;
    var gl = this.gl;
    function frame(now) {
      var dt = Math.max(0, now - self.last) * 0.001;
      self.last = now;
      if (!self.paused) self.accumTime += dt;

      var damp = 0.02 + Math.max(0, Math.min(1, self.opts.hoverDampness)) * 0.5;
      var alpha = 1 - Math.exp(-dt / damp);
      self.mouseSmooth[0] += (self.mouseTarget[0] - self.mouseSmooth[0]) * alpha;
      self.mouseSmooth[1] += (self.mouseTarget[1] - self.mouseSmooth[1]) * alpha;

      gl.useProgram(self.prog);
      gl.uniform1f(self.u.uTime, self.accumTime);
      gl.uniform2f(self.u.uMouse, self.mouseSmooth[0], self.mouseSmooth[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      self.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };

  PrismaticBurst.prototype.destroy = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._ro) this._ro.disconnect();
    else window.removeEventListener('resize', this._resizeFn);
    document.removeEventListener('pointermove', this._pointerFn);
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  /* ── Cursor Trail ── */
  function initCursorTrail(colorA, colorB) {
    colorA = colorA || '#FFB300';
    colorB = colorB || '#7C4DFF';
    var dots = [];
    var TRAIL = 18;
    var mouse = { x: -200, y: -200 };
    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;';
    document.body.appendChild(container);
    for (var i = 0; i < TRAIL; i++) {
      var d = document.createElement('div');
      var t = i / (TRAIL - 1);
      var size = 14 - t * 10;
      /* interpolate color */
      var ra = parseInt(colorA.slice(1,3),16), ga = parseInt(colorA.slice(3,5),16), ba = parseInt(colorA.slice(5,7),16);
      var rb = parseInt(colorB.slice(1,3),16), gb = parseInt(colorB.slice(3,5),16), bb = parseInt(colorB.slice(5,7),16);
      var r = Math.round(ra + (rb-ra)*t), g = Math.round(ga + (gb-ga)*t), b = Math.round(ba + (bb-ba)*t);
      d.style.cssText = 'position:fixed;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);transition:width .1s,height .1s;will-change:transform,opacity;';
      d.style.width  = size + 'px';
      d.style.height = size + 'px';
      d.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (1 - t * 0.85) + ')';
      d.style.boxShadow = '0 0 ' + (size*2) + 'px rgba(' + r + ',' + g + ',' + b + ',0.6)';
      d.style.left = '-200px';
      d.style.top  = '-200px';
      container.appendChild(d);
      dots.push({ el: d, x: -200, y: -200 });
    }
    document.addEventListener('pointermove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });
    (function animate() {
      var px = mouse.x, py = mouse.y;
      for (var i = 0; i < dots.length; i++) {
        var prev = i === 0 ? { x: px, y: py } : dots[i-1];
        var speed = i === 0 ? 0.35 : 0.22;
        dots[i].x += (prev.x - dots[i].x) * speed;
        dots[i].y += (prev.y - dots[i].y) * speed;
        dots[i].el.style.left = dots[i].x + 'px';
        dots[i].el.style.top  = dots[i].y + 'px';
      }
      requestAnimationFrame(animate);
    })();
  }

  global.PrismaticBurst = PrismaticBurst;
  global.initCursorTrail = initCursorTrail;

}(typeof window !== 'undefined' ? window : this));
