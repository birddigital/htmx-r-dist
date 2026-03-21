/**
 * htmx-r Story Engine
 * Scroll-driven narrative animation primitives for brand storytelling.
 *
 * Part of the htmx-r ecosystem (github.com/birddigital/htmx-r-dist).
 * Load after htmx-r.js core runtime.
 *
 * Primitives:
 *   HtmxRStory.ss(e0, e1, x)              — smoothstep interpolation
 *   HtmxRStory.lerp(a, b, t)              — linear interpolation
 *   HtmxRStory.lerpColor(hex1, hex2, t)   — hex color interpolation
 *   HtmxRStory.clamp(x, lo, hi)           — clamp value
 *   HtmxRStory.zone(el, opts)             — scroll progress tracker (0-1)
 *   HtmxRStory.sky(el, stops)             — multi-stop gradient blender
 *   HtmxRStory.particles(canvas, opts)    — canvas particle system
 *   HtmxRStory.character(el, opts)        — scroll-driven character animation
 *   HtmxRStory.caption(el, in, show, out) — scroll-driven text visibility
 *   HtmxRStory.parallax(el, speed)        — parallax layer
 *   HtmxRStory.progressBar(el)            — progress indicator
 *   HtmxRStory.orchestrate(config)        — wire everything into one rAF loop
 */

const HtmxRStory = {

  /* ── Math ─────────────────────────────────────────────────────── */

  /** Smoothstep: 0 below e0, 1 above e1, hermite curve between. */
  ss(e0, e1, x) {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  },

  /** Linear interpolation: lerp(0, 100, 0.5) === 50 */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Clamp x to [lo, hi]. */
  clamp(x, lo, hi) {
    return Math.min(Math.max(x, lo), hi);
  },

  /**
   * Hex color interpolation.
   * lerpColor('#ff0000', '#0000ff', 0.5) => '#800080'
   */
  lerpColor(h1, h2, t) {
    const p = s => parseInt(s, 16);
    const [r1, g1, b1] = [h1.slice(1, 3), h1.slice(3, 5), h1.slice(5, 7)].map(p);
    const [r2, g2, b2] = [h2.slice(1, 3), h2.slice(3, 5), h2.slice(5, 7)].map(p);
    const f = n => Math.round(n).toString(16).padStart(2, '0');
    return '#' + f(r1 + (r2 - r1) * t) + f(g1 + (g2 - g1) * t) + f(b1 + (b2 - b1) * t);
  },

  /* ── Zone ─────────────────────────────────────────────────────── */

  /**
   * Scroll progress tracker for a tall container element.
   * Returns an object whose .progress property is always 0-1 reflecting
   * how far through the element the viewport has scrolled.
   *
   * @param {HTMLElement} el  — container (height > 100vh for meaningful range)
   * @param {Object}      [opts]
   * @param {Function}    [opts.onProgress] — callback(progress, zone) each scroll
   * @param {boolean}     [opts.clampEdges] — clamp to [0,1], default true
   * @returns {{ progress: number, el: HTMLElement, destroy: Function }}
   */
  zone(el, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress;
    var clampEdges = opts.clampEdges !== false;
    var state = { progress: 0, el: el, _raf: 0 };

    function calc() {
      var scrollable = el.offsetHeight - window.innerHeight;
      if (scrollable <= 0) { state.progress = 0; return; }
      var raw = (window.scrollY - el.offsetTop) / scrollable;
      state.progress = clampEdges ? HtmxRStory.clamp(raw, 0, 1) : raw;
      if (onProgress) onProgress(state.progress, state);
    }

    function onScroll() {
      if (!state._raf) {
        state._raf = requestAnimationFrame(function () {
          calc();
          state._raf = 0;
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', calc);
    calc();

    state.destroy = function () {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', calc);
      cancelAnimationFrame(state._raf);
    };

    return state;
  },

  /* ── Sky ──────────────────────────────────────────────────────── */

  /**
   * Multi-stop gradient blender driven by scroll progress.
   *
   * Stops format: [{ p: 0.0, top: '#hex', bot: '#hex', gnd: '#hex', ... }, ...]
   * All keys except `p` are treated as color channels and interpolated.
   * If `top` and `bot` channels exist, a linear-gradient is applied to el.
   * All channels are also set as CSS custom properties: --sky-{channel}.
   *
   * @param {HTMLElement} el    — the sky element
   * @param {Array}       stops — color stop array sorted by .p ascending
   * @returns {{ update: Function, colorsAt: Function }}
   */
  sky(el, stops) {
    stops = stops.slice().sort(function (a, b) { return a.p - b.p; });
    var channels = Object.keys(stops[0]).filter(function (k) { return k !== 'p'; });

    function colorsAt(progress) {
      var i = 0;
      while (i < stops.length - 2 && progress > stops[i + 1].p) i++;
      var s0 = stops[i], s1 = stops[i + 1];
      var t = s1.p === s0.p ? 0 : (progress - s0.p) / (s1.p - s0.p);
      var colors = {};
      for (var c = 0; c < channels.length; c++) {
        var ch = channels[c];
        colors[ch] = HtmxRStory.lerpColor(s0[ch], s1[ch], t);
      }
      return colors;
    }

    return {
      /** Compute interpolated colors and apply to element. Returns colors object. */
      update: function (progress) {
        var colors = colorsAt(progress);
        for (var c = 0; c < channels.length; c++) {
          el.style.setProperty('--sky-' + channels[c], colors[channels[c]]);
        }
        if (colors.top && colors.bot) {
          el.style.background = 'linear-gradient(to bottom, ' + colors.top + ' 0%, ' + colors.bot + ' 100%)';
        }
        return colors;
      },

      /** Get interpolated colors without applying to DOM. */
      colorsAt: colorsAt
    };
  },

  /* ── Particles ────────────────────────────────────────────────── */

  /**
   * Canvas particle system with built-in presets.
   *
   * Presets: 'blossoms', 'fireflies', 'leaves', 'snow', 'rain', 'sparks', 'stars'
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object}  [opts]
   * @param {string}  [opts.preset]     — preset name (default 'rain')
   * @param {number}  [opts.count]      — override preset particle count
   * @param {boolean} [opts.autoResize] — auto-resize canvas (default true)
   * @returns {{ update: Function, burst: Function, setPreset: Function, resize: Function, destroy: Function }}
   */
  particles(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var preset = opts.preset || 'rain';
    var userCount = opts.count;
    var autoResize = opts.autoResize !== false;
    var w = 0, h = 0, items = [], destroyed = false;

    function resize() {
      var parent = canvas.parentElement;
      w = canvas.width = parent ? parent.clientWidth : window.innerWidth;
      h = canvas.height = parent ? parent.clientHeight : window.innerHeight;
    }

    /* ── Particle factories ──────────────────────────────────── */

    function blossomNew(spread) {
      return {
        x: Math.random() * w, y: spread ? Math.random() * h : -20,
        r: Math.random() * 4 + 2, vx: (Math.random() - 0.5) * 1.4,
        vy: Math.random() * 1.1 + 0.4, wb: Math.random() * Math.PI * 2,
        ws: Math.random() * 0.038 + 0.01, an: 0, sp: (Math.random() - 0.5) * 0.07,
        cr: 215 + (Math.random() * 40 | 0), cg: 120 + (Math.random() * 50 | 0),
        cb: 145 + (Math.random() * 40 | 0), op: Math.random() * 0.65 + 0.2
      };
    }

    function fireflyNew() {
      return {
        x: Math.random() * w, y: Math.random() * h * 0.65 + h * 0.2,
        r: Math.random() * 2.2 + 1, gp: Math.random() * Math.PI * 2,
        gs: Math.random() * 0.04 + 0.018, vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.3, op: 0.5,
        cr: 180 + (Math.random() * 60 | 0), cg: 210 + (Math.random() * 45 | 0),
        cb: 75 + (Math.random() * 40 | 0)
      };
    }

    function leafNew(spread) {
      var pal = [[200,72,32],[232,160,48],[200,40,40],[208,188,24],[180,88,20]];
      var c = pal[Math.floor(Math.random() * pal.length)];
      return {
        x: Math.random() * w, y: spread ? Math.random() * h : -20,
        r: Math.random() * 5.5 + 3, vx: (Math.random() - 0.5) * 2.2,
        vy: Math.random() * 1.4 + 0.7, wb: Math.random() * Math.PI * 2,
        ws: Math.random() * 0.045 + 0.018, an: Math.random() * Math.PI * 2,
        sp: (Math.random() - 0.5) * 0.11, cr: c[0], cg: c[1], cb: c[2],
        op: Math.random() * 0.65 + 0.2
      };
    }

    function snowNew(spread) {
      var v = 200 + (Math.random() * 55 | 0);
      return {
        x: Math.random() * w, y: spread ? Math.random() * h : -20,
        r: Math.random() * 2.8 + 0.8, vx: (Math.random() - 0.5) * 0.7,
        vy: Math.random() * 1.3 + 0.3, wb: Math.random() * Math.PI * 2,
        ws: Math.random() * 0.018 + 0.005, cr: v, cg: v + 8, cb: v + 20,
        op: (Math.random() * 0.65 + 0.2) * 0.75
      };
    }

    function rainNew() {
      return {
        nx: Math.random(), ny: Math.random(),
        len: Math.random() * 16 + 8, spd: Math.random() * 5 + 3,
        op: Math.random() * 0.3 + 0.1
      };
    }

    function sparkNew() {
      return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1 };
    }

    function starNew() {
      return {
        nx: Math.random(), ny: Math.random() * 0.62,
        r: Math.random() * 1.2 + 0.3, op: Math.random() * 0.55 + 0.2,
        tw: Math.random() * Math.PI * 2, ts: Math.random() * 0.03 + 0.008
      };
    }

    /* ── Update + draw per preset ────────────────────────────── */

    function driftTick(p) {
      p.wb += p.ws;
      p.x += p.vx + Math.sin(p.wb) * 0.4;
      p.y += p.vy;
      if (p.sp) p.an += p.sp;
      if (p.y > h + 30 || p.x < -40 || p.x > w + 40) {
        p.x = Math.random() * w; p.y = -20;
      }
    }

    function blossomDraw(p) {
      ctx.save();
      ctx.globalAlpha = p.op;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.an || p.wb);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.7, p.r, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + p.op + ')';
      ctx.fill();
      ctx.restore();
    }

    function fireflyTick(p) {
      p.gp += p.gs;
      p.x += p.vx + Math.sin(p.gp * 0.65) * 0.28;
      p.y += p.vy + Math.sin(p.gp * 0.5) * 0.18;
      p.op = (Math.sin(p.gp) + 1) / 2 * 0.55 + 0.08;
      if (p.y > h + 30 || p.x < -30 || p.x > w + 30) {
        p.x = Math.random() * w;
        p.y = Math.random() * h * 0.65 + h * 0.2;
      }
    }

    function fireflyDraw(p) {
      ctx.save();
      ctx.globalAlpha = p.op;
      var col = 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',';
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.5);
      g.addColorStop(0, col + p.op + ')');
      g.addColorStop(1, col + '0)');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4.5, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = col + p.op + ')'; ctx.fill();
      ctx.restore();
    }

    function leafDraw(p) {
      ctx.save();
      ctx.globalAlpha = p.op;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.an);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.35, p.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + p.op + ')';
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(-p.r * 1.2, 0); ctx.lineTo(p.r * 1.2, 0);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }

    function snowDraw(p) {
      ctx.save();
      ctx.globalAlpha = p.op;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + p.op + ')';
      ctx.fill();
      if (p.r > 1.8) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      }
      ctx.restore();
    }

    function rainTick(p) {
      p.ny += p.spd / 60;
      if (p.ny > 1) { p.ny = -0.02; p.nx = Math.random(); }
    }

    function rainDrawOne(p, alpha) {
      ctx.save();
      ctx.globalAlpha = p.op * alpha;
      ctx.strokeStyle = '#7aa8cc';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(p.nx * w, p.ny * h);
      ctx.lineTo(p.nx * w - 4, p.ny * h + p.len);
      ctx.stroke();
      ctx.restore();
    }

    function sparkTick(p) {
      if (p.life <= 0) return;
      p.life -= 1 / 60 / p.maxLife;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
    }

    function sparkDrawOne(p) {
      if (p.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle = 'hsl(' + (28 + Math.random() * 22) + ',100%,62%)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function starTick(p) {
      p.tw += p.ts;
    }

    function starDrawOne(p, alpha) {
      var twinkle = (Math.sin(p.tw) + 1) * 0.5;
      var finalOp = alpha * (p.op * 0.6 + twinkle * p.op * 0.4);
      ctx.save();
      ctx.globalAlpha = finalOp;
      ctx.fillStyle = '#e8eeff';
      ctx.beginPath(); ctx.arc(p.nx * w, p.ny * h, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ── Preset configs ──────────────────────────────────────── */

    var PRESETS = {
      blossoms:  { n: 28, make: blossomNew,  tick: driftTick,    draw: blossomDraw },
      fireflies: { n: 14, make: fireflyNew,  tick: fireflyTick,  draw: fireflyDraw },
      leaves:    { n: 40, make: leafNew,      tick: driftTick,    draw: leafDraw },
      snow:      { n: 65, make: snowNew,      tick: driftTick,    draw: snowDraw },
      rain:      { n: 80, make: rainNew,      tick: rainTick,     draw: rainDrawOne },
      sparks:    { n: 36, make: sparkNew,     tick: sparkTick,    draw: sparkDrawOne },
      stars:     { n: 100, make: starNew,     tick: starTick,     draw: starDrawOne }
    };

    /* ── Init ────────────────────────────────────────────────── */

    resize();
    if (autoResize) window.addEventListener('resize', resize);

    function initPreset(name, spread) {
      var cfg = PRESETS[name];
      if (!cfg) return;
      preset = name;
      var n = userCount || cfg.n;
      items = [];
      for (var i = 0; i < n; i++) items.push(cfg.make(spread !== false));
    }

    initPreset(preset);

    /* ── Public API ──────────────────────────────────────────── */

    return {
      /**
       * Tick + draw all particles. Call once per frame.
       * @param {number} [opacity=1] — master opacity multiplier (0-1)
       */
      update: function (opacity) {
        if (destroyed) return;
        var alpha = typeof opacity === 'number' ? opacity : 1;
        ctx.clearRect(0, 0, w, h);
        if (alpha < 0.01) return;
        var cfg = PRESETS[preset];
        if (!cfg) return;
        for (var i = 0; i < items.length; i++) {
          cfg.tick(items[i]);
          cfg.draw(items[i], alpha);
        }
      },

      /**
       * Fire a spark burst at screen coordinates (cx, cy).
       * Only meaningful when preset is 'sparks'.
       */
      burst: function (cx, cy) {
        for (var i = 0; i < items.length; i++) {
          var p = items[i];
          p.x = cx; p.y = cy;
          var a = Math.random() * Math.PI * 2;
          var speed = Math.random() * 5 + 2;
          p.vx = Math.cos(a) * speed;
          p.vy = Math.sin(a) * speed - 2.5;
          p.life = 1;
          p.maxLife = Math.random() * 0.55 + 0.35;
        }
      },

      /** Switch to a different preset. */
      setPreset: function (name, spread) { initPreset(name, spread); },

      /** Force resize. */
      resize: resize,

      /** Clean up. */
      destroy: function () {
        destroyed = true;
        if (autoResize) window.removeEventListener('resize', resize);
        items = [];
      }
    };
  },

  /* ── Character ────────────────────────────────────────────────── */

  /**
   * Scroll-driven character with position keyframes, pose states,
   * and one-shot event triggers.
   *
   * @param {HTMLElement} el — character root element
   * @param {Object}      opts
   * @param {Array}  [opts.path]   — [{p, x, y, opacity}] position keyframes (x in vw, y in px)
   * @param {Array}  [opts.poses]  — [{p, pose}] sets data-pose attribute on el
   * @param {Array}  [opts.events] — [{p, fn, id}] one-shot callbacks; re-arms on scroll-back
   * @returns {{ update: Function, destroy: Function }}
   */
  character(el, opts) {
    opts = opts || {};
    var path = (opts.path || []).slice().sort(function (a, b) { return a.p - b.p; });
    var poses = (opts.poses || []).slice().sort(function (a, b) { return a.p - b.p; });
    var events = opts.events || [];
    var fired = {};

    return {
      update: function (progress) {
        /* Position interpolation */
        if (path.length >= 2) {
          var i = 0;
          while (i < path.length - 2 && progress > path[i + 1].p) i++;
          var k0 = path[i], k1 = path[i + 1];
          var t = k1.p === k0.p ? 0 : HtmxRStory.clamp((progress - k0.p) / (k1.p - k0.p), 0, 1);
          var st = t * t * (3 - 2 * t); // smoothstep

          if (k0.x !== undefined && k1.x !== undefined) {
            var x = HtmxRStory.lerp(k0.x, k1.x, st);
            var y = HtmxRStory.lerp(k0.y || 0, k1.y || 0, st);
            el.style.transform = 'translateX(' + x + 'vw) translateY(' + y + 'px)';
          }
          if (k0.opacity !== undefined && k1.opacity !== undefined) {
            el.style.opacity = HtmxRStory.lerp(k0.opacity, k1.opacity, st);
          }
        }

        /* Pose — find the latest pose whose p <= progress */
        if (poses.length > 0) {
          var activePose = poses[0].pose;
          for (var j = 0; j < poses.length; j++) {
            if (progress >= poses[j].p) activePose = poses[j].pose;
          }
          el.setAttribute('data-pose', activePose);
        }

        /* One-shot events */
        for (var e = 0; e < events.length; e++) {
          var evt = events[e];
          var id = evt.id || String(evt.p);
          if (progress >= evt.p && !fired[id]) {
            fired[id] = true;
            evt.fn(progress);
          }
          if (progress < evt.p - 0.02 && fired[id]) {
            delete fired[id];
          }
        }
      },

      destroy: function () { fired = {}; }
    };
  },

  /* ── Caption ──────────────────────────────────────────────────── */

  /**
   * Scroll-driven caption with smoothstep fade in/out.
   *
   * @param {HTMLElement} el
   * @param {number} fadeIn  — progress where fade-in begins
   * @param {number} showAt  — progress where fully visible
   * @param {number} fadeOut — progress where fade-out begins
   * @param {number} hideAt  — progress where fully hidden
   * @returns {{ update: Function }}
   */
  caption: function (el, fadeIn, showAt, fadeOut, hideAt) {
    return {
      update: function (progress) {
        var opIn = HtmxRStory.ss(fadeIn, showAt, progress);
        var opOut = HtmxRStory.ss(fadeOut, hideAt, progress);
        el.style.opacity = opIn * (1 - opOut);
      }
    };
  },

  /* ── Parallax ─────────────────────────────────────────────────── */

  /**
   * Simple scroll-driven parallax.
   *
   * @param {HTMLElement} el
   * @param {number} speed — parallax factor (0.1-0.3 typical for backgrounds)
   * @returns {{ update: Function }}
   */
  parallax: function (el, speed) {
    return {
      update: function (scrollY) {
        el.style.transform = 'translateY(' + (scrollY * speed) + 'px)';
      }
    };
  },

  /* ── Progress bar ─────────────────────────────────────────────── */

  /**
   * Thin progress bar driven by a 0-1 fraction.
   *
   * @param {HTMLElement} el
   * @returns {{ update: Function }}
   */
  progressBar: function (el) {
    return {
      update: function (fraction) {
        el.style.width = (fraction * 100) + '%';
      }
    };
  },

  /* ── Orchestrate ──────────────────────────────────────────────── */

  /**
   * Wire a zone + layers into a single requestAnimationFrame loop.
   * Each layer must have an .update(progress) method.
   *
   * @param {Object}   config
   * @param {Object}   config.zone    — zone instance from HtmxRStory.zone()
   * @param {Array}    config.layers  — objects with .update(progress)
   * @param {Function} [config.onFrame] — called with (progress, scrollY) each frame
   * @param {boolean}  [config.respectReducedMotion] — skip animation if prefers-reduced-motion (default true)
   * @returns {{ start: Function, stop: Function, destroy: Function }}
   */
  orchestrate: function (config) {
    var zone = config.zone;
    var layers = config.layers || [];
    var onFrame = config.onFrame;
    var respectMotion = config.respectReducedMotion !== false;
    var running = false, animId = 0;
    var reducedMotion = respectMotion && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function tick() {
      if (!running) return;
      var p = zone.progress;
      var scrollY = window.scrollY;

      for (var i = 0; i < layers.length; i++) {
        if (layers[i].update) layers[i].update(p);
      }

      if (onFrame) onFrame(p, scrollY);

      if (!reducedMotion) {
        animId = requestAnimationFrame(tick);
      }
    }

    return {
      start: function () {
        running = true;
        if (reducedMotion) {
          // Run once to set initial state, then rely on scroll events
          tick();
          running = false;
        } else {
          tick();
        }
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(animId);
      },
      destroy: function () {
        this.stop();
        if (zone.destroy) zone.destroy();
        for (var i = 0; i < layers.length; i++) {
          if (layers[i].destroy) layers[i].destroy();
        }
      }
    };
  }
};

/* Global access */
window.HtmxRStory = HtmxRStory;
