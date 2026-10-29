/* Portfolio de Álvaro García-Aparicio Rey
   Router por pestañas (#hash) + un módulo interactivo por pestaña.
   Cada módulo tiene enter()/leave() para que solo se anime la vista activa. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = (d) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2);
  const body = document.body;
  const toastEl = $("#toast");
  let toastT;
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200); };

  const BG = { inicio: "#15171c", "sobre-mi": "#e7ebe4", experiencia: "#f4f5f7", motores: "#141517", eolica: "#0c1a2c", informatica: "#171828", flotas: "#e9eff3", contacto: "#f6cf3e" };
  const mods = {};
  let current = null;
  let pendingSubject = null;

  /* ====================== SONIDO (todo sintetizado con Web Audio) ======================
     Música ambiental generativa (acordes suaves + campanas) y motor deportivo ligado a las rpm.
     Los navegadores solo permiten audio tras una interacción: arranca con el primer clic o tecla. */
  const sound = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const btn = $("#sound");
    let on = true, ctx = null, master, bus, lp, timer = 0, bellT = 0, next = 0, ci = 0, eng = null, dipUntil = 0;
    try { on = localStorage.getItem("aga-sound") !== "off"; } catch {}
    const midi = (n) => 440 * 2 ** ((n - 69) / 12);
    const CHORDS = [[50, 57, 61, 64, 66], [47, 54, 57, 62, 64], [43, 50, 54, 57, 62], [45, 52, 57, 59, 64]];
    const ui = () => {
      btn.setAttribute("aria-pressed", on);
      btn.classList.toggle("playing", on && !!ctx && ctx.state === "running");
      $(".snd-lbl", btn).textContent = on ? "Música" : "Sin sonido";
    };
    function noise(sec) {
      const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function init() {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const rev = ctx.createConvolver(), len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
      rev.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.7; rev.connect(wet).connect(master);
      lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500;
      bus = ctx.createGain(); bus.gain.value = 0;
      lp.connect(bus); bus.connect(master); bus.connect(rev);
      ctx.onstatechange = ui;
    }
    function pad(t) {
      const ch = CHORDS[ci++ % CHORDS.length], dur = 8;
      [ch[0] - 12, ...ch].forEach((n, k) => {
        const g = ctx.createGain(), lvl = k ? 0.032 : 0.05;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 2.5);
        g.gain.setValueAtTime(lvl, t + dur - 0.5); g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
        g.connect(lp);
        [-5, 5].forEach((det) => { const o = ctx.createOscillator(); o.type = k ? "triangle" : "sine"; o.frequency.value = midi(n); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 2.6); });
      });
    }
    function bell() {
      const t = ctx.currentTime, n = [74, 76, 78, 81, 83, 86][(Math.random() * 6) | 0];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      g.connect(lp);
      [[1, 1], [2.01, 0.3]].forEach(([m, a]) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.frequency.value = midi(n) * m; gg.gain.value = a; o.connect(gg).connect(g); o.start(t); o.stop(t + 3.1); });
      bellT = setTimeout(bell, 1800 + Math.random() * 3400);
    }
    const tick = () => { while (next < ctx.currentTime + 1.5) { pad(next); next += 8; } };
    function start() {
      if (!AC) return;
      if (!ctx) init();
      ctx.resume().then(ui);
      bus.gain.setTargetAtTime(eng ? 0.3 : 1, ctx.currentTime, 1.2);
      if (!timer) { next = ctx.currentTime + 0.1; tick(); timer = setInterval(tick, 500); bell(); }
      if (current === "motores") engineOn();
      else if (current === "eolica" || current === "informatica") ambOn(current);
    }
    function stop() {
      if (!ctx) return;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      clearInterval(timer); clearTimeout(bellT); timer = 0;
      engineOff(); ambOff();
      setTimeout(() => { if (!on) ctx.suspend().then(ui); }, 1500);
    }
    // Motor de gasolina deportivo: modelo de explosiones por cilindro (4 cilindros, 2 explosiones por vuelta)
    // con variación aleatoria en cada explosión, distorsión, resonancias de escape y compresor para que suene fuerte.
    function engineOn() {
      if (!ctx || !on || eng) return;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.12;
      const out = ctx.createGain(); out.gain.value = 0;
      out.connect(comp).connect(master);
      const st = { rpm: 800, tr: 800, load: 0, tl: 0, ph: 0, env: 0, half: 0, cyl: 0 };
      const sp = ctx.createScriptProcessor(2048, 0, 1);
      sp.onaudioprocess = (ev) => {
        const o = ev.outputBuffer.getChannelData(0), sr = ctx.sampleRate;
        for (let i = 0; i < o.length; i++) {
          st.rpm += (st.tr - st.rpm) * 0.0012;
          st.load += (st.tl - st.load) * 0.0008;
          st.ph += st.rpm / 30 / sr;
          if (st.ph >= 1) {
            st.ph -= 1; st.cyl = (st.cyl + 1) % 4;
            const a = (0.28 + 0.72 * st.load) * (0.82 + Math.random() * 0.36) * (st.cyl === 0 ? 1.15 : 1);
            st.env = a; st.half = a;
          }
          st.env *= Math.exp(-1 / (sr * (0.0022 + 0.0045 * (1 - st.rpm / 8000))));
          st.half *= 0.9993;
          const n = Math.random() * 2 - 1;
          o[i] = st.env * (0.6 * n + Math.sin(st.ph * 6.2832)) + st.half * 0.3 * Math.sin(st.ph * 3.1416);
        }
      };
      const sh = ctx.createWaveShaper(), cv = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; cv[i] = Math.tanh(x * 4.5); }
      sh.curve = cv; sh.oversample = "2x";
      const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 110; body.Q.value = 1.1; body.gain.value = 9;
      const pipe = ctx.createBiquadFilter(); pipe.type = "peaking"; pipe.frequency.value = 420; pipe.Q.value = 1.4; pipe.gain.value = 6;
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.Q.value = 1.2; tone.frequency.value = 900;
      sp.connect(sh).connect(body).connect(pipe).connect(tone).connect(out);
      // admisión: zumbido que crece con el acelerador
      const intake = ctx.createOscillator(); intake.type = "sawtooth";
      const ilp = ctx.createBiquadFilter(); ilp.type = "lowpass"; ilp.frequency.value = 700;
      const ig = ctx.createGain(); ig.gain.value = 0;
      intake.connect(ilp).connect(ig).connect(out); intake.start();
      // petardeos: salida propia con saturación dura para el "crack"
      const popOut = ctx.createGain(); popOut.gain.value = 1.1;
      const psh = ctx.createWaveShaper(), pc = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; pc[i] = Math.max(-0.9, Math.min(0.9, x * 2.2)); }
      psh.curve = pc; popOut.connect(psh).connect(comp);
      eng = { st, sp, out, tone, intake, ilp, ig, popOut, popBuf: noise(0.15) };
      bus.gain.setTargetAtTime(0.18, ctx.currentTime, 0.5);
    }
    function engineOff() {
      if (!eng) return;
      const e = eng, t = ctx.currentTime;
      eng = null;
      e.out.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => { e.sp.disconnect(); e.sp.onaudioprocess = null; e.intake.stop(); e.out.disconnect(); }, 900);
      if (on && timer) bus.gain.setTargetAtTime(1, t, 1);
    }
    function engine(rpm, thr) {
      if (!eng) return;
      const t = ctx.currentTime, load = performance.now() < dipUntil ? 0 : thr;
      eng.st.tr = rpm; eng.st.tl = load;
      eng.out.gain.setTargetAtTime(0.5 + load * 0.5, t, 0.08);
      eng.tone.frequency.setTargetAtTime(700 + rpm * 0.55 + load * 2600, t, 0.05);
      eng.intake.frequency.setTargetAtTime(rpm / 30, t, 0.03);
      eng.ilp.frequency.setTargetAtTime(500 + rpm * 0.3, t, 0.05);
      eng.ig.gain.setTargetAtTime(load * 0.1, t, 0.06);
    }
    function shift() { dipUntil = performance.now() + 130; }
    // Explosiones en el escape ("bang bang"): ráfaga seca + golpe grave, en los instantes indicados (ms)
    function pops(delays) {
      if (!eng) return;
      const t0 = ctx.currentTime;
      for (const d of delays) {
        const t = t0 + d / 1000, a = 0.55 + Math.random() * 0.45;
        const src = ctx.createBufferSource(); src.buffer = eng.popBuf;
        const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1600 + Math.random() * 2600; f.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * 1.6, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045 + Math.random() * 0.06);
        src.connect(f).connect(g).connect(eng.popOut); src.start(t); src.stop(t + 0.15);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle";
        o.frequency.setValueAtTime(150 + Math.random() * 70, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(a * 1.2, t + 0.003); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(og).connect(eng.popOut); o.start(t); o.stop(t + 0.12);
      }
    }
    // Ambientes por pestaña: viento en Eólica, sala de ordenadores en Informática
    let amb = null, clickBuf = null;
    function ambOn(kind) {
      if (!ctx || !on || (amb && amb.kind === kind)) return;
      ambOff();
      amb = kind === "eolica" ? windAmb() : kind === "informatica" ? techAmb() : null;
      if (amb) bus.gain.setTargetAtTime(0.45, ctx.currentTime, 0.6);
    }
    function ambOff() {
      if (!amb) return;
      amb.stop(); amb = null;
      if (on && timer && !eng) bus.gain.setTargetAtTime(1, ctx.currentTime, 1);
    }
    function windAmb() {
      const src = ctx.createBufferSource(); src.buffer = noise(4); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 300; bp.Q.value = 0.6;
      const lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 800;
      const blade = ctx.createGain(), g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(lp2).connect(blade).connect(g).connect(master);
      const src2 = ctx.createBufferSource(); src2.buffer = noise(3); src2.loop = true;
      const wh = ctx.createBiquadFilter(); wh.type = "bandpass"; wh.frequency.value = 1500; wh.Q.value = 7;
      const g2 = ctx.createGain(); g2.gain.value = 0;
      src2.connect(wh).connect(g2).connect(master);
      src.start(); src2.start();
      let ph = 0, lastT = ctx.currentTime;
      return {
        kind: "eolica",
        update(v, rpm) {
          const t = ctx.currentTime, k = Math.min(1, v / 25);
          bp.frequency.setTargetAtTime(220 + k * 950, t, 0.2);
          lp2.frequency.setTargetAtTime(550 + k * 2800, t, 0.2);
          g.gain.setTargetAtTime(0.06 + k * 0.8, t, 0.25);
          wh.frequency.setTargetAtTime(1100 + k * 2000 + Math.sin(t * 0.7) * 300, t, 0.3);
          g2.gain.setTargetAtTime(Math.max(0, k - 0.3) * 0.14, t, 0.3);
          ph += (rpm / 20) * (t - lastT); lastT = t;
          blade.gain.setTargetAtTime(0.72 + 0.28 * Math.sin(ph * 6.2832), t, 0.03);
        },
        stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.2); g2.gain.setTargetAtTime(0, t, 0.2); setTimeout(() => { src.stop(); src2.stop(); }, 1200); },
      };
    }
    function click(t, a, freq) {
      const src = ctx.createBufferSource(); src.buffer = clickBuf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.05);
    }
    function techAmb() {
      clickBuf = clickBuf || noise(0.05);
      const t0 = ctx.currentTime;
      const fan = ctx.createBufferSource(); fan.buffer = noise(3); fan.loop = true;
      const flp = ctx.createBiquadFilter(); flp.type = "lowpass"; flp.frequency.value = 480;
      const fg = ctx.createGain(); fg.gain.value = 0; fg.gain.setTargetAtTime(0.16, t0, 0.8);
      fan.connect(flp).connect(fg).connect(master); fan.start();
      const hum = ctx.createOscillator(); hum.frequency.value = 100;
      const hg = ctx.createGain(); hg.gain.value = 0; hg.gain.setTargetAtTime(0.012, t0, 0.8);
      hum.connect(hg).connect(master); hum.start();
      const typing = () => { let t = ctx.currentTime + 0.02; const n = (3 + Math.random() * 9) | 0; for (let k = 0; k < n; k++) { t += 0.06 + Math.random() * 0.11; click(t, 0.1 + Math.random() * 0.1, 2400 + Math.random() * 1600); } };
      const disk = () => { let t = ctx.currentTime + 0.02; const n = (4 + Math.random() * 6) | 0; for (let k = 0; k < n; k++) { t += 0.02 + Math.random() * 0.05; click(t, 0.06, 800 + Math.random() * 600); } };
      const chirp = () => {
        const t = ctx.currentTime + 0.02, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "square"; f.frequency.value = 2500;
        for (let k = 0; k < 3; k++) o.frequency.setValueAtTime([880, 1175, 1320, 1760][(Math.random() * 4) | 0], t + k * 0.06);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 0.01); g.gain.setValueAtTime(0.022, t + 0.17); g.gain.linearRampToValueAtTime(0, t + 0.2);
        o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.22);
      };
      let alive = true, tk = 0;
      const loop = () => { if (!alive) return; const r = Math.random(); r < 0.55 ? typing() : r < 0.8 ? disk() : chirp(); tk = setTimeout(loop, 600 + Math.random() * 1800); };
      tk = setTimeout(loop, 400);
      return {
        kind: "informatica",
        stop() { alive = false; clearTimeout(tk); const t = ctx.currentTime; fg.gain.setTargetAtTime(0, t, 0.2); hg.gain.setTargetAtTime(0, t, 0.2); setTimeout(() => { fan.stop(); hum.stop(); }, 1000); },
      };
    }
    const wind = (v, rpm) => amb?.kind === "eolica" && amb.update(v, rpm);
    const key = () => amb?.kind === "informatica" && click(ctx.currentTime, 0.2, 2600 + Math.random() * 1400);

    const first = (e) => {
      if (e.target.closest && e.target.closest("#sound")) return;
      removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true);
      if (on) start();
    };
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);
    btn.addEventListener("click", () => {
      on = !on;
      try { localStorage.setItem("aga-sound", on ? "on" : "off"); } catch {}
      removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true);
      on ? start() : stop();
      ui();
    });
    document.addEventListener("visibilitychange", () => { if (!ctx || !on) return; document.hidden ? ctx.suspend() : ctx.resume(); });
    ui();
    return { engineOn, engineOff, engine, shift, pops, ambOn, ambOff, wind, key };
  })();

  /* ====================== Router ====================== */
  const ink = $(".tab-ink");
  function placeInk() {
    const a = $(`.tabs a[aria-current="page"]`);
    if (!a) return;
    ink.style.width = a.offsetWidth + "px";
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  function show(id, animate) {
    if (id === "gracias") id = "contacto";
    if (!BG[id]) id = "inicio";
    if (id === current) { if (location.hash === "#gracias") mods[id]?.enter?.(); return; }
    const swap = () => {
      if (current && mods[current]?.leave) mods[current].leave();
      $$(".view").forEach((v) => {
        const on = v.dataset.view === id;
        v.hidden = !on;
        v.classList.toggle("enter", on && !reduce);
      });
      $$(".tabs a").forEach((a) => (a.dataset.tab === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
      body.dataset.page = id;
      current = id;
      scrollTo(0, 0);
      placeInk();
      $(`.tabs a[data-tab="${id}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
      mods[id]?.enter?.();
      document.title = id === "inicio" ? "Álvaro García-Aparicio Rey" : `${$(`.tabs a[data-tab="${id}"]`).textContent.trim()} · Álvaro García-Aparicio Rey`;
    };
    if (animate && !reduce) {
      const w = $(".wipe");
      w.style.setProperty("--wipe", BG[id]);
      w.classList.remove("run");
      void w.offsetWidth;
      w.classList.add("run");
      setTimeout(swap, 320);
    } else swap();
  }
  addEventListener("hashchange", () => show(location.hash.slice(1), true));
  addEventListener("resize", placeInk);
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-subject]");
    if (s) pendingSubject = s.dataset.subject;
  });
  const go = (id) => (location.hash = id);

  /* ====================== INICIO ====================== */
  mods.inicio = (() => {
    const h = $(".kinetic");
    $$(".k-line", h).forEach((line) => {
      const txt = line.textContent;
      line.textContent = "";
      line.setAttribute("aria-hidden", "true");
      txt.split(/(?<=[\s-])/).forEach((word) => {
        const w = document.createElement("span");
        w.className = "word";
        for (const c of word.trimEnd()) {
          const s = document.createElement("span");
          s.className = "ch";
          s.textContent = c;
          w.append(s);
        }
        line.append(w, word.endsWith(" ") ? " " : "");
      });
    });
    const chars = $$(".ch", h);
    function field(x, y) {
      for (const c of chars) {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        const t = Math.max(0, 1 - d / 240);
        c.style.setProperty("--w", (62 + 63 * t).toFixed(0));
        c.style.setProperty("--g", (300 + 600 * t).toFixed(0));
      }
    }
    const rest = () => chars.forEach((c) => { c.style.removeProperty("--w"); c.style.removeProperty("--g"); });
    h.addEventListener("pointermove", (e) => field(e.clientX, e.clientY));
    h.addEventListener("pointerleave", rest);

    // Rotador de especialidades
    const ty = $(".typer");
    const words = ty.dataset.words.split("|");
    let wi = 0, ti = 0;
    function cycle() {
      if (current !== "inicio" || reduce) return (ti = 0);
      const w = words[wi];
      let i = w.length;
      const del = setInterval(() => {
        ty.textContent = w.slice(0, --i);
        if (i <= 0) {
          clearInterval(del);
          wi = (wi + 1) % words.length;
          const n = words[wi];
          let j = 0;
          const add = setInterval(() => {
            ty.textContent = n.slice(0, ++j);
            if (j >= n.length) { clearInterval(add); ti = setTimeout(cycle, 2200); }
          }, 55);
        }
      }, 28);
    }
    return {
      enter() {
        clearTimeout(ti);
        ti = setTimeout(cycle, 2400);
        if (reduce) return;
        // Barrido inicial: una "ola" recorre el nombre
        const r = h.getBoundingClientRect();
        const t0 = performance.now();
        const sweep = (now) => {
          const k = Math.min(1, (now - t0) / 1400);
          field(r.left - 200 + (r.width + 400) * k, r.top + r.height / 2);
          if (k < 1) requestAnimationFrame(sweep); else rest();
        };
        setTimeout(() => requestAnimationFrame(sweep), 300);
      },
      leave() { clearTimeout(ti); },
    };
  })();

  /* ====================== SOBRE MÍ ====================== */
  $$(".traits button").forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-expanded", b.getAttribute("aria-expanded") !== "true")));
  const cmp = $("#cmp");
  cmp.addEventListener("input", () => $(".compare").style.setProperty("--pos", cmp.value + "%"));
  mods["sobre-mi"] = {
    enter() {
      const b = $(".traits button");
      if (b.getAttribute("aria-expanded") === "false") setTimeout(() => b.setAttribute("aria-expanded", "true"), 500);
    },
  };

  /* ====================== EXPERIENCIA ====================== */
  const ROLES = {
    motores: {
      area: "Taller", title: "Electromecánico de automóviles y automatización", tab: "#motores", subject: "Electromecánica / Automoción",
      detail: "Diagnosis, reparación, mantenimiento y adaptaciones técnicas sobre el vehículo. Cuando un paso se repite, lo automatizo para que el taller o el negocio gane fiabilidad y tiempo.",
      points: ["Reparaciones y mantenimiento", "Adaptaciones técnicas", "Automatización de vehículos y procesos de negocio"],
    },
    eolica: {
      area: "Campo", title: "Técnico de montaje de turbinas eólicas (electricista)", tab: "#eolica", subject: "Montaje eólico / Electricidad",
      detail: "Montaje de turbinas en campo con el oficio de electricista: estructuras, cableado industrial, trabajo en altura con PRL y verificaciones eléctricas antes de dejar la máquina en servicio.",
      points: ["Montaje de estructuras", "Cableado industrial especializado", "Trabajos en altura (PRL)", "Verificaciones eléctricas"],
    },
    informatica: {
      area: "Código", title: "Informática, desarrollo e inteligencia artificial", tab: "#informatica", subject: "Software / Automatización / IA",
      detail: "Desarrollo web, Python y JavaScript, automatización de recursos e integración de inteligencia artificial aplicada a un problema concreto.",
      points: ["Desarrollo web, frontend y backend", "Python y JavaScript", "Automatización de recursos", "Integración de IA"],
    },
    flotas: {
      area: "Oficina", title: "Administrativo y gestor de flotas", tab: "#flotas", subject: "Administración / Gestión de flotas",
      detail: "Hago de puente entre técnicos, talleres y clientes: autorizo presupuestos de reparación, llevo los trámites administrativos y respondo los correos que llegan al equipo técnico.",
      points: ["Autorización de presupuestos de reparación", "Gestión de trámites administrativos", "Ofimática", "Portavoz del equipo técnico ante talleres y clientes"],
    },
  };
  const ficha = $(".ficha");
  function pickRole(id) {
    const r = ROLES[id];
    $$(".venn-c").forEach((g) => g.classList.toggle("on", g.dataset.role === id));
    $("#f-area").textContent = r.area;
    $("#f-title").textContent = r.title;
    $("#f-detail").textContent = r.detail;
    $("#f-points").innerHTML = r.points.map((p, i) => `<li style="animation-delay:${i * 70}ms">${p}</li>`).join("");
    $("#f-tab").href = r.tab;
    $("#f-ask").dataset.subject = r.subject;
    ficha.classList.remove("swap"); void ficha.offsetWidth; ficha.classList.add("swap");
  }
  $$(".venn-c").forEach((g) => {
    g.addEventListener("click", () => pickRole(g.dataset.role));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickRole(g.dataset.role); } });
  });
  pickRole("motores");

  // Fondo: papel milimetrado "magnético" que se deforma con el cursor; clic = onda
  mods.experiencia = (() => {
    const sec = $(".v-exp"), cv = $("#exp-bg"), c = cv.getContext("2d"), S = 28, R = 150;
    let W = 0, H = 0, dots = [], raf = 0, waves = [];
    const m = { x: -999, y: -999 };
    const pos = (e) => { const r = sec.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    sec.addEventListener("pointermove", (e) => ([m.x, m.y] = pos(e)), { passive: true });
    sec.addEventListener("pointerleave", () => (m.x = m.y = -999));
    sec.addEventListener("pointerdown", (e) => { const [x, y] = pos(e); waves.push({ x, y, r: 0 }); });
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = sec.clientWidth; H = sec.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = S - 1; y < H; y += S) for (let x = S - 1; x < W; x += S) dots.push({ x, y, ox: 0, oy: 0, k: 0 });
    }
    function frame() {
      c.clearRect(0, 0, W, H);
      waves = waves.filter((w) => (w.r += 9) < 700);
      const cool = new Path2D(), hot = new Path2D();
      for (const d of dots) {
        let tx = 0, ty = 0, k = 0;
        const dx = d.x - m.x, dy = d.y - m.y, dist = Math.hypot(dx, dy) || 1;
        if (dist < R) { k = (1 - dist / R) ** 2; tx = (dx / dist) * k * 22; ty = (dy / dist) * k * 22; }
        for (const w of waves) {
          const wx = d.x - w.x, wy = d.y - w.y, wd = Math.hypot(wx, wy) || 1, g = 1 - Math.abs(wd - w.r) / 34;
          if (g > 0) { const f = g * (1 - w.r / 700); tx += (wx / wd) * f * 14; ty += (wy / wd) * f * 14; k = Math.max(k, f); }
        }
        d.ox += (tx - d.ox) * 0.18; d.oy += (ty - d.oy) * 0.18; d.k += (k - d.k) * 0.2;
        const s = 1.6 + d.k * 3.4;
        (d.k > 0.06 ? hot : cool).rect(d.x + d.ox - s / 2, d.y + d.oy - s / 2, s, s);
      }
      c.fillStyle = "#b9c1cd"; c.fill(cool);
      c.fillStyle = "#f05a28"; c.fill(hot);
      raf = requestAnimationFrame(frame);
    }
    return {
      enter() { size(); cancelAnimationFrame(raf); if (reduce) return frame(), cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
      leave() { cancelAnimationFrame(raf); },
    };
  })();

  /* ====================== MOTORES ====================== */
  mods.motores = (() => {
    const CX = 150, CY = 150, MAX = 8000, RED = 6500;
    const ang = (rpm) => -135 + (rpm / MAX) * 270;
    const pol = (a, r) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
    let ticks = "";
    for (let v = 0; v <= MAX; v += 500) {
      const major = v % 1000 === 0;
      const [x1, y1] = pol(ang(v), major ? 98 : 106);
      const [x2, y2] = pol(ang(v), 116);
      ticks += `<line class="tk${major ? " major" : ""}${v >= RED ? " red" : ""}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      if (major) { const [tx, ty] = pol(ang(v), 82); ticks += `<text class="tn" x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle">${v / 1000}</text>`; }
    }
    $("#tach-ticks").innerHTML = ticks;
    const arc = $("#tach-arc"), needle = $("#needle"), num = $("#rpm-num"), gearEl = $("#gear"), kmhEl = $("#kmh"), tempEl = $("#temp");
    const RATIO = [0, 7, 12, 17, 22, 27, 32];
    const s = { rpm: 800, gear: 0, temp: 72, on: false };

    // Escenario de fondo: coche en carretera que reacciona al acelerar
    const rc = $("#road"), rx = rc.getContext("2d"), stage = $(".motor-stage");
    let RW = 0, RH = 0, streaks = [], city = [], dist = 0, push = 0, puffs = [];
    function sizeRoad() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      RW = stage.clientWidth; RH = stage.clientHeight;
      rc.width = RW * dpr; rc.height = RH * dpr; rx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streaks = Array.from({ length: 70 }, () => ({ x: Math.random() * RW, y: Math.random() * (RH - 140), l: 20 + Math.random() * 90 }));
      city = [0.1, 0.28].map((sp, k) => {
        const b = []; let x = 0;
        while (x < RW + 160) { const w = 26 + Math.random() * 70; b.push({ x, w, h: (k ? 30 : 60) + Math.random() * (k ? 60 : 120) }); x += w + 5; }
        return { sp, b, k, span: x };
      });
    }
    let flame = 0, pitch = 0, wasOn = false;
    function bangs(n) {
      const ds = []; let t = 15;
      for (let k = 0; k < n; k++) { t += 40 + Math.random() * (k ? 140 : 25); ds.push(t); }
      sound.pops(ds);
      ds.forEach((d) => setTimeout(() => (flame = 0.7 + Math.random() * 0.5), d));
    }
    const COUPE = new Image();
    COUPE.src = "img/coupe.png";
    function wheel(x, y, rot, v) {
      rx.save(); rx.translate(x, y);
      rx.beginPath(); rx.arc(0, 0, 26, 0, 7); rx.fillStyle = "#0a0a0b"; rx.fill();
      rx.lineWidth = 1.2; rx.strokeStyle = "#2c2d31"; rx.beginPath(); rx.arc(0, 0, 22.5, 0, 7); rx.stroke();
      rx.beginPath(); rx.arc(0, 0, 18.5, 0, 7); rx.fillStyle = "#141518"; rx.fill();
      rx.beginPath(); rx.arc(0, 0, 14, 0, 7); rx.fillStyle = "#3b3d42"; rx.fill();
      rx.fillStyle = "#e02a1f"; rx.beginPath(); rx.arc(0, 0, 15.8, -2.5, -1.3); rx.arc(0, 0, 10, -1.3, -2.5, true); rx.closePath(); rx.fill();
      const rg = rx.createRadialGradient(-5, -6, 2, 0, 0, 19); rg.addColorStop(0, "#fff1c4"); rg.addColorStop(0.55, "#d9ad4a"); rg.addColorStop(1, "#7a5a14");
      const blur = Math.min(1, v / 12);
      rx.rotate(rot);
      rx.globalAlpha = 1 - blur * 0.7; rx.strokeStyle = rg; rx.lineCap = "round"; rx.lineWidth = 2.6;
      for (let k = 0; k < 10; k++) { rx.rotate(Math.PI / 5); rx.beginPath(); rx.moveTo(0, 4.5); rx.lineTo(2, 18); rx.stroke(); }
      rx.globalAlpha = 1;
      if (blur > 0.1) { rx.strokeStyle = `rgba(205,207,212,${blur * 0.38})`; rx.lineWidth = 10; rx.beginPath(); rx.arc(0, 0, 12.5, 0, 7); rx.stroke(); }
      rx.lineWidth = 1.6; rx.strokeStyle = rg; rx.beginPath(); rx.arc(0, 0, 18.5, 0, 7); rx.stroke();
      rx.beginPath(); rx.arc(0, 0, 4, 0, 7); rx.fillStyle = "#d3d5da"; rx.fill();
      rx.restore();
    }
    function body() {
      if (flame > 0) {
        const fl = rx.createLinearGradient(10, 0, 10 - 64 * flame, 0);
        fl.addColorStop(0, "rgba(140,180,255,.95)"); fl.addColorStop(0.3, "rgba(255,186,60,.92)"); fl.addColorStop(1, "rgba(255,70,20,0)");
        rx.fillStyle = fl;
        for (const ey of [93]) { rx.beginPath(); rx.moveTo(12, ey - 4); rx.quadraticCurveTo(12 - 32 * flame, ey - 7, 12 - 66 * flame, ey); rx.quadraticCurveTo(12 - 32 * flame, ey + 7, 12, ey + 4); rx.fill(); }
      }
      if (COUPE.complete && COUPE.naturalWidth) rx.drawImage(COUPE, -12, 0, 424, 112);
      rx.save();
      rx.shadowBlur = 16; rx.shadowColor = "#ff2a1f"; rx.fillStyle = s.on ? "rgba(255,60,40,.55)" : "rgba(255,40,30,.25)";
      rx.fillRect(6, 61, 14, 9);
      rx.restore();
    }
    function car(now, v, f) {
      const sc = Math.min(RW * (RW < 700 ? 0.82 : 0.36), 470) / 400;
      const gy = RH - 46;
      push += (Math.min(110, v * 4.5) - push) * 0.04 * f;
      pitch += ((s.on ? -0.024 : 0) - pitch) * 0.08 * f;
      flame = Math.max(0, flame - 0.11 * f);
      const x0 = RW * 0.05 + push, y0 = gy - 111 * sc;
      const bounce = Math.sin(now / (s.gear ? 34 : 60)) * (s.gear ? 0.35 + v / 40 : 0.3);
      if (s.on && Math.random() < 0.5) puffs.push({ x: x0 + 14 * sc, y: y0 + 90 * sc, r: 3, a: 0.5 });
      puffs = puffs.filter((p) => (p.a -= 0.012 * f) > 0);
      for (const p of puffs) { p.x -= (1.5 + v * 0.6) * f; p.y -= 0.3 * f; p.r += 0.45 * f; rx.fillStyle = `rgba(190,190,195,${p.a * 0.3})`; rx.beginPath(); rx.arc(p.x, p.y, p.r, 0, 7); rx.fill(); }
      rx.save();
      rx.translate(x0, y0); rx.scale(sc, sc);
      rx.fillStyle = "rgba(0,0,0,.6)"; rx.beginPath(); rx.ellipse(205, 111, 196, 7, 0, 0, 7); rx.fill();
      const beam = rx.createLinearGradient(396, 0, 720, 0); beam.addColorStop(0, "rgba(255,236,180,.3)"); beam.addColorStop(1, "rgba(255,236,180,0)");
      rx.fillStyle = beam; rx.beginPath(); rx.moveTo(392, 55); rx.lineTo(720, 28); rx.lineTo(720, 112); rx.lineTo(392, 62); rx.fill();
      rx.save(); rx.translate(88, 86 + bounce); rx.rotate(pitch); rx.translate(-88, -86);
      body();
      rx.restore();
      const rot = dist / (25 * sc);
      wheel(88, 86, rot, v); wheel(318, 86, rot, v);
      rx.restore();
    }
    function road(dt, now) {
      const f = dt * 60;
      const v = (s.gear ? (s.rpm / 1000) * RATIO[s.gear] : 0) * 0.14;
      const gy = RH - 46;
      rx.clearRect(0, 0, RW, RH);
      for (const L of city) {
        rx.fillStyle = L.k ? "#ffffff0c" : "#ffffff06";
        for (const b of L.b) { b.x -= v * L.sp * f; if (b.x + b.w < 0) b.x += L.span; rx.fillRect(b.x, gy - 62 - b.h, b.w, b.h); }
      }
      rx.lineWidth = 1.5;
      rx.strokeStyle = `rgba(255,176,32,${Math.min(0.38, 0.05 + v / 50)})`;
      rx.beginPath();
      for (const st of streaks) {
        st.x -= (v * 1.7 + 0.15) * f;
        if (st.x + st.l < 0) { st.x = RW + Math.random() * 120; st.y = Math.random() * (gy - 100); }
        rx.moveTo(st.x, st.y); rx.lineTo(st.x + st.l * (0.15 + v / 10), st.y);
      }
      rx.stroke();
      const ag = rx.createLinearGradient(0, gy - 56, 0, RH); ag.addColorStop(0, "#1c1d20"); ag.addColorStop(1, "#08090a");
      rx.fillStyle = ag; rx.fillRect(0, gy - 56, RW, RH - gy + 56);
      dist += v * f;
      const kw = 44;
      for (let x = -(dist % (kw * 2)); x < RW; x += kw * 2) { rx.fillStyle = "#c9241b"; rx.fillRect(x, gy - 62, kw, 7); rx.fillStyle = "#e6e6e2"; rx.fillRect(x + kw, gy - 62, kw, 7); }
      rx.fillStyle = "#ffb02090";
      for (let x = -((dist * 1.15) % 150); x < RW; x += 150) rx.fillRect(x, gy + 24, 74, 3);
      if (v > 1) {
        rx.strokeStyle = `rgba(255,255,255,${Math.min(0.12, v / 150)})`; rx.lineWidth = 1; rx.beginPath();
        for (let k = 0; k < 14; k++) { const yy = gy - 48 + ((k * 37) % 90); const xx = RW - ((dist * 1.3 + k * 211) % (RW + 240)); rx.moveTo(xx, yy); rx.lineTo(xx + 40 + v * 6, yy); }
        rx.stroke();
      }
      car(now, v, f);
    }
    let raf = 0, prev = 0, last = 0;
    function draw() {
      const a = ang(s.rpm);
      const [sx, sy] = pol(-135, 128), [ex, ey] = pol(a, 128);
      arc.setAttribute("d", `M${sx.toFixed(1)} ${sy.toFixed(1)} A128 128 0 ${a + 135 > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      arc.classList.toggle("hot", s.rpm >= RED);
      needle.setAttribute("transform", `rotate(${a.toFixed(1)} ${CX} ${CY})`);
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
      prev = now;
      if (wasOn && !s.on && s.rpm > 2800) bangs(5 + ((Math.random() * 5) | 0));
      wasOn = s.on;
      if (s.on) {
        if (s.gear === 0) s.gear = 1;
        s.rpm += (7600 - s.rpm) * dt * (2.6 - s.gear * 0.3);
        if (s.rpm > 6900 && s.gear < 6) { s.rpm *= RATIO[s.gear] / RATIO[s.gear + 1]; s.gear++; sound.shift(); bangs(2 + ((Math.random() * 2) | 0)); }
      } else {
        s.rpm += (800 - s.rpm) * dt * 0.9;
        if (s.gear > 1 && s.rpm < 1700) { s.rpm = Math.min(5200, (s.rpm * RATIO[s.gear]) / RATIO[s.gear - 1]); s.gear--; }
        if (s.gear === 1 && s.rpm < 1000) s.gear = 0;
      }
      s.temp += (72 + (s.rpm / MAX) * 26 - s.temp) * dt * 0.15;
      draw();
      road(dt, now);
      sound.engine(s.rpm, s.on ? 1 : 0);
      if (now - last > 80) {
        last = now;
        num.textContent = nf0.format(Math.round(s.rpm / 10) * 10);
        gearEl.textContent = s.gear ? s.gear : "N";
        kmhEl.textContent = s.gear ? Math.round((s.rpm / 1000) * RATIO[s.gear]) : 0;
        tempEl.textContent = Math.round(s.temp);
      }
      raf = requestAnimationFrame(frame);
    }
    const thr = $("#throttle");
    const press = (v) => { s.on = v; thr.classList.toggle("on", v); };
    thr.addEventListener("pointerdown", (e) => { e.preventDefault(); thr.setPointerCapture?.(e.pointerId); press(true); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => thr.addEventListener(ev, () => press(false)));
    thr.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("keydown", (e) => { if (current === "motores" && e.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); press(true); } });
    addEventListener("keyup", (e) => { if (e.code === "Space") press(false); });

    // Diagnosis OBD: revisa cada sistema en secuencia
    const out = $("#obd-out");
    let scanning = false;
    $("#scan").addEventListener("click", async () => {
      if (scanning) return;
      scanning = true;
      const items = $$("#obd-list li");
      items.forEach((li) => { li.classList.remove("ok", "run"); $(".st", li).textContent = "—"; });
      for (const li of items) {
        li.classList.add("run");
        $(".st", li).textContent = "…";
        out.textContent = `Comprobando ${$(".name", li).textContent.toLowerCase()}…`;
        await new Promise((r) => setTimeout(r, reduce ? 50 : 750));
        li.classList.replace("run", "ok");
        $(".st", li).textContent = "OK";
        out.textContent = li.dataset.d;
        await new Promise((r) => setTimeout(r, reduce ? 50 : 650));
      }
      out.textContent = "Diagnosis completa: 5 sistemas revisados, 0 averías pendientes. Pasa el cursor por cada línea para ver el detalle.";
      scanning = false;
    });
    $$("#obd-list li").forEach((li) => li.addEventListener("pointerenter", () => { if (!scanning && li.classList.contains("ok")) out.textContent = li.dataset.d; }));

    draw();
    return {
      enter() { sizeRoad(); sound.engineOn(); prev = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
      leave() { cancelAnimationFrame(raf); press(false); sound.engineOff(); },
    };
  })();

  /* ====================== EÓLICA ====================== */
  mods.eolica = (() => {
    const CUT_IN = 3, RATED = 12, CUT_OUT = 25, RATED_MW = 3;
    const sec = $(".v-eolica");
    const wind = { v: 4, ps: 0, sv: 0, cut: false };
    const ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, active: false };
    const rotor = { rpm: 0, angle: 0 };
    let energy = 0, lastScroll = scrollY;
    sec.addEventListener("pointermove", (e) => {
      const r = sec.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const now = performance.now();
      const dt = Math.max(8, now - ptr.t);
      if (ptr.t && dt < 200) {
        ptr.vx = (x - ptr.x) / dt;
        ptr.vy = (y - ptr.y) / dt;
        wind.ps += (Math.min(6, Math.hypot(ptr.vx, ptr.vy)) - wind.ps) * 0.35;
      }
      ptr.x = x; ptr.y = y; ptr.t = now; ptr.active = true;
    }, { passive: true });
    sec.addEventListener("pointerleave", () => (ptr.active = false));
    const powerAt = (v) => (wind.cut || v < CUT_IN ? 0 : v >= RATED ? RATED_MW : (RATED_MW * (v ** 3 - CUT_IN ** 3)) / (RATED ** 3 - CUT_IN ** 3));

    // Curva de potencia (misma escala que las etiquetas: 0–25 m/s → x 34–310; 0–3 MW → y 104–14)
    const X = (v) => 34 + (v / 25) * 276, Y = (mw) => 104 - (mw / RATED_MW) * 90;
    let d = `M${X(0)} ${Y(0)} L${X(CUT_IN)} ${Y(0)}`;
    for (let v = CUT_IN; v <= RATED; v += 0.25) d += ` L${X(v).toFixed(1)} ${Y(powerAt(v)).toFixed(1)}`;
    d += ` L${X(25)} ${Y(3)}`;
    $("#c-path").setAttribute("d", d);
    const dot = $("#c-dot");

    // Líneas de corriente
    const cv = $("#wind"), cx = cv.getContext("2d");
    let W = 0, H = 0, parts = [];
    const spawn = (p, anywhere) => {
      p.x = anywhere ? Math.random() * W : -10 - Math.random() * 40;
      p.y = Math.random() * H; p.px = p.x; p.py = p.y;
      p.life = 90 + Math.random() * 180; p.age = anywhere ? Math.random() * p.life : 0;
      return p;
    };
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = sec.clientWidth; H = sec.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: Math.round(Math.min(900, Math.max(220, (W * H) / 2300))) }, () => spawn({}, true));
    }
    const flow = (x, y, t) => {
      const a = Math.sin(x * 0.0022 + t * 0.35) + Math.cos(y * 0.0031 - t * 0.27) + Math.sin((x - y) * 0.0012 + t * 0.15);
      return [Math.cos(a * 0.9), Math.sin(a * 0.9) * 0.9];
    };
    function step(t, shift) {
      const base = 0.35 + wind.v * 0.16, turb = 0.5 + wind.v * 0.05, R = 170;
      const cool = new Path2D(), hot = new Path2D();
      for (const p of parts) {
        const [fx, fy] = flow(p.x, p.y, t);
        let vx = base + fx * 0.7 * turb, vy = fy * 0.7 * turb, isHot = false;
        if (ptr.active) {
          const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const dd = Math.sqrt(d2) || 1, k = 1 - dd / R;
            vx += (-dy / dd) * k * 2.2 + ptr.vx * k * 14;
            vy += (dx / dd) * k * 2.2 + ptr.vy * k * 14;
            isHot = k > 0.22;
          }
        }
        p.px = p.x; p.py = p.y - shift;
        p.x += vx; p.y += vy - shift; p.age++;
        if (p.x > W + 20 || p.x < -60 || p.y < -20 || p.y > H + 20 || p.age > p.life) { spawn(p, !(p.x > W + 20)); continue; }
        (isHot ? hot : cool).moveTo(p.px, p.py);
        (isHot ? hot : cool).lineTo(p.x, p.y);
      }
      cx.lineWidth = 1; cx.strokeStyle = "rgba(214,230,250,0.30)"; cx.stroke(cool);
      cx.lineWidth = 1.4; cx.strokeStyle = "rgba(255,210,63,0.85)"; cx.stroke(hot);
    }

    // Piezas ↔ anotaciones
    const hotPart = (part, on) => $$(`[data-part="${part}"]`).forEach((el) => el.classList.toggle("hot", on));
    $$(".turbine [data-part]").forEach((el) => {
      ["pointerenter", "focus"].forEach((ev) => el.addEventListener(ev, () => hotPart(el.dataset.part, true)));
      ["pointerleave", "blur"].forEach((ev) => el.addEventListener(ev, () => hotPart(el.dataset.part, false)));
    });
    $(".turbine").addEventListener("pointerdown", () => (wind.ps = Math.min(6, wind.ps + 2.2)));

    const rotorEl = $("#rotor"), root = document.documentElement;
    const o = { wind: $("#r-wind"), rpm: $("#r-rpm"), power: $("#r-power"), energy: $("#r-energy"), status: $("#r-status") };
    const status = (v, mw) => wind.cut ? ["Parada de seguridad: viento por encima de 25 m/s. Las palas se ponen en bandera.", true]
      : v < CUT_IN ? ["Brisa ligera. La turbina arranca a partir de 3 m/s.", false]
      : mw >= RATED_MW ? ["Potencia nominal alcanzada.", false] : ["Generando. Más viento, más potencia.", false];
    let raf = 0, prev = 0, lastUi = 0, lastStatus = "";
    function frame(now) {
      const dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
      prev = now;
      const dy = scrollY - lastScroll; lastScroll = scrollY;
      wind.sv += (Math.abs(dy) - wind.sv) * 0.2;
      wind.ps *= 0.955; ptr.vx *= 0.9; ptr.vy *= 0.9;
      const target = 4 + Math.min(28, wind.ps * 7 + wind.sv * 0.15);
      wind.v += (target - wind.v) * (target > wind.v ? 0.05 : 0.015);
      if (wind.v > CUT_OUT) wind.cut = true; else if (wind.cut && wind.v < 18) wind.cut = false;
      const tr = wind.cut ? 0 : wind.v < CUT_IN ? 1.2 : Math.min(15.5, 1.5 + (wind.v - CUT_IN) * 1.4);
      rotor.rpm += (tr - rotor.rpm) * (wind.cut ? 0.035 : 0.02);
      rotor.angle = (rotor.angle + rotor.rpm * 9 * dt) % 360;
      rotorEl.setAttribute("transform", `rotate(${rotor.angle.toFixed(2)} 200 220)`);
      sound.wind(wind.v, rotor.rpm);
      const mw = powerAt(wind.v);
      energy += (mw * 1000 * dt) / 3600;
      cx.globalCompositeOperation = "destination-out";
      cx.fillStyle = "rgba(0,0,0,0.075)"; cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = "source-over";
      step(now / 1000, dy * 0.5);
      if (now - lastUi > 100) {
        lastUi = now;
        root.style.setProperty("--power", (mw / RATED_MW).toFixed(3));
        o.wind.textContent = nf1.format(wind.v); o.rpm.textContent = nf1.format(rotor.rpm);
        o.power.textContent = nf2.format(mw); o.energy.textContent = nf1.format(energy);
        const vv = Math.min(wind.v, 25);
        dot.setAttribute("cx", X(vv).toFixed(1)); dot.setAttribute("cy", Y(mw).toFixed(1));
        const [t, alert] = status(wind.v, mw);
        if (t !== lastStatus) { lastStatus = t; o.status.textContent = t; o.status.classList.toggle("alert", alert); }
      }
      raf = requestAnimationFrame(frame);
    }
    let ro;
    return {
      enter() {
        size();
        sound.ambOn("eolica");
        ro = ro || new ResizeObserver(() => current === "eolica" && size());
        ro.observe(sec);
        if (reduce) { for (let i = 0; i < 40; i++) step(i * 0.05, 0); return; }
        prev = performance.now(); lastScroll = scrollY;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      },
      leave() { cancelAnimationFrame(raf); ro?.unobserve(sec); sound.ambOff(); },
    };
  })();

  /* ====================== INFORMÁTICA ====================== */
  const matrix = (() => {
    const sec = $(".v-info"), cv = $("#matrix"), c = cv.getContext("2d"), FS = 16;
    const CH = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ{}<>/=;$#*+".split("");
    let W = 0, H = 0, cols = [], raf = 0, last = 0, boost = 0;
    const m = { x: -999, y: -999 };
    sec.addEventListener("pointermove", (e) => { const r = sec.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; }, { passive: true });
    sec.addEventListener("pointerleave", () => (m.x = m.y = -999));
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = sec.clientWidth; H = sec.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Array.from({ length: Math.ceil(W / FS) }, () => ({ y: Math.random() * H, sp: 0.35 + Math.random() * 0.7 }));
      c.fillStyle = "#171828"; c.fillRect(0, 0, W, H);
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;
      last = now;
      boost *= 0.94;
      c.fillStyle = "rgba(23,24,40,0.13)"; c.fillRect(0, 0, W, H);
      c.font = `${FS}px "JetBrains Mono", Consolas, monospace`;
      cols.forEach((col, i) => {
        const x = i * FS, dx = x - m.x, dy = col.y - m.y, d = Math.hypot(dx, dy) || 1;
        const near = Math.max(0, 1 - Math.abs(dx) / 150), lens = Math.max(0, 1 - d / 130);
        c.fillStyle = lens > 0 ? `rgba(94,224,214,${0.65 + lens * 0.35})` : near > 0 ? `rgba(164,139,255,${0.45 + near * 0.55})` : "rgba(164,139,255,0.38)";
        c.fillText(CH[(Math.random() * CH.length) | 0], x + (dx / d) * lens * 20, col.y + (dy / d) * lens * 20);
        col.y += FS * col.sp * (1 + near * 2.2 + boost * 3);
        if (col.y > H && Math.random() > 0.97) col.y = -FS * Math.random() * 10;
      });
    }
    return {
      start() { size(); if (reduce) { for (let k = 0; k < 30; k++) frame(k * 40); cancelAnimationFrame(raf); return; } cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
      stop() { cancelAnimationFrame(raf); },
      kick() { boost = 1; },
    };
  })();

  mods.informatica = (() => {
    const outEl = $("#term-out"), input = $("#term-cmd");
    const line = (txt, cls = "o") => { const d = document.createElement("div"); d.className = cls; d.textContent = txt; outEl.append(d); outEl.scrollTop = outEl.scrollHeight; };
    const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
    let busy = false, booted = false;
    const TABS = ["motores", "eolica", "informatica", "experiencia", "sobre-mi", "contacto", "inicio"];
    const CMDS = {
      help: () => ["Comandos disponibles:", "  whoami        quién soy", "  stack         tecnologías con las que trabajo", "  automatizar   ejemplo de una tarea automatizada", "  ia            cómo integro inteligencia artificial", "  ls / cd <x>   moverte por las pestañas", "  contacto      escribirme", "  clear         limpiar la pantalla"],
      whoami: () => [["Álvaro García-Aparicio Rey", "a"], "Mecánica, electrónica e informática. Del taller al código."],
      stack: () => [["web         frontend · backend", "g"], ["lenguajes   Python · JavaScript", "g"], ["también     automatización de recursos · integración de IA · soporte técnico", "g"]],
      ia: () => ["Integro inteligencia artificial en herramientas y procesos", "para resolver un problema concreto: menos tarea manual,", "más criterio técnico."],
      ls: () => [[TABS.map((t) => t + "/").join("  "), "g"]],
      async automatizar() {
        const steps = ["detectando tarea repetida (informe semanal)", "escribiendo script en Python", "conectando con la hoja de datos", "programando ejecución automática"];
        for (const s of steps) { line(`› ${s}…`); await wait(520); outEl.lastChild.textContent += " ok"; outEl.lastChild.className = "g"; }
        return [["✓ 2 h de trabajo manual a la semana → 0. (Ejemplo ilustrativo)", "a"]];
      },
      contacto: () => { setTimeout(() => go("contacto"), 600); pendingSubject = "Software / Automatización / IA"; return [["Abriendo contacto…", "a"]]; },
      clear: () => { outEl.textContent = ""; return []; },
    };
    async function run(raw) {
      const cmd = raw.trim();
      if (!cmd || busy) return;
      busy = true;
      line(cmd, "c");
      matrix.kick();
      const [name, arg] = cmd.toLowerCase().split(/\s+/);
      let res;
      if (name === "cd") {
        const t = (arg || "").replace(/\/$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (TABS.includes(t)) { res = [[`Entrando en ${t}/…`, "a"]]; setTimeout(() => go(t), 600); }
        else res = [[`cd: no existe la carpeta: ${arg || ""}. Prueba ls`, "w"]];
      } else if (name.startsWith("sudo")) res = [["Permiso denegado. Para pedir acceso, prueba «contacto».", "w"]];
      else if (CMDS[name]) res = await CMDS[name]();
      else res = [[`comando no encontrado: ${name}. Escribe help.`, "w"]];
      for (const r of res) Array.isArray(r) ? line(r[0], r[1]) : line(r);
      busy = false;
    }
    $("#term-form").addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
    input.addEventListener("keydown", () => sound.key());
    $$(".term-chips button").forEach((b) => b.addEventListener("click", () => run(b.dataset.cmd)));
    $("#term").addEventListener("click", (e) => { if (!e.target.closest("button")) input.focus({ preventScroll: true }); });
    return {
      leave() { matrix.stop(); sound.ambOff(); },
      async enter() {
        matrix.start();
        sound.ambOn("informatica");
        if (booted) return;
        booted = true;
        line("Portfolio v2026 · escribe help o pulsa un comando.", "o");
        await wait(500);
        run("whoami");
      },
    };
  })();

  /* ====================== FLOTAS ====================== */
  mods.flotas = (() => {
    // Mapa de seguimiento: vehículos que circulan por una retícula de calles
    const sec = $(".v-flota"), cv = $("#fleet"), c = cv.getContext("2d"), S = 96;
    let W = 0, H = 0, nx = 0, ny = 0, cars = [], raf = 0, prev = 0;
    const m = { x: -999, y: -999 };
    sec.addEventListener("pointermove", (e) => { const r = sec.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; }, { passive: true });
    sec.addEventListener("pointerleave", () => (m.x = m.y = -999));
    const TYPE = ["Camión", "Furgoneta", "Turismo"];
    function nextNode(v) {
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => {
        const i = v.ti + a, j = v.tj + b;
        return i >= 0 && j >= 0 && i < nx && j < ny && !(i === v.i && j === v.j);
      });
      const [a, b] = opts[(Math.random() * opts.length) | 0];
      v.i = v.ti; v.j = v.tj; v.ti += a; v.tj += b; v.t = 0;
    }
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = sec.clientWidth; H = sec.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      nx = Math.ceil(W / S) + 1; ny = Math.ceil(H / S) + 1;
      const n = Math.max(10, Math.min(32, Math.round((W * H) / 45000)));
      cars = Array.from({ length: n }, (_, k) => {
        const v = { id: `${TYPE[k % 3]} ${String(k + 1).padStart(2, "0")}`, ti: (Math.random() * nx) | 0, tj: (Math.random() * ny) | 0, i: -1, j: -1, t: 0, sp: 0.006 + Math.random() * 0.008, shop: k % 7 === 3 };
        nextNode(v); v.t = Math.random();
        return v;
      });
    }
    function frame(now) {
      const f = Math.min(3, (now - prev) / 16.7 || 1);
      prev = now;
      c.clearRect(0, 0, W, H);
      for (let i = 0; i < nx; i++) { c.fillStyle = i % 3 ? "#d3dde5" : "#c3cfd9"; c.fillRect(i * S - (i % 3 ? 1 : 3), 0, i % 3 ? 2 : 6, H); }
      for (let j = 0; j < ny; j++) { c.fillStyle = j % 3 ? "#d3dde5" : "#c3cfd9"; c.fillRect(0, j * S - (j % 3 ? 1 : 3), W, j % 3 ? 2 : 6); }
      const labels = [];
      for (const v of cars) {
        if (!v.shop) { v.t += v.sp * f; if (v.t >= 1) nextNode(v); }
        const x = (v.i + (v.ti - v.i) * v.t) * S, y = (v.j + (v.tj - v.j) * v.t) * S;
        const near = Math.hypot(x - m.x, y - m.y) < 110;
        if (v.shop) {
          const p = (Math.sin(now / 300) + 1) / 2;
          c.fillStyle = `rgba(224,112,42,${0.15 + p * 0.25})`; c.beginPath(); c.arc(x, y, 10 + p * 6, 0, 7); c.fill();
          c.fillStyle = "#e0702a"; c.fillRect(x - 5, y - 5, 10, 10);
        } else {
          c.strokeStyle = "rgba(10,127,122,.28)"; c.lineWidth = 3; c.beginPath();
          c.moveTo(x, y); c.lineTo(x - (v.ti - v.i) * 18, y - (v.tj - v.j) * 18); c.stroke();
          c.fillStyle = "#0a7f7a"; c.beginPath(); c.arc(x, y, near ? 7 : 4.5, 0, 7); c.fill();
        }
        if (near) labels.push([x, y, `${v.id} · ${v.shop ? "en taller" : "en ruta"}`, v.shop]);
      }
      c.font = '600 11px "JetBrains Mono", Consolas, monospace';
      for (const [x, y, t, shop] of labels) {
        const w = c.measureText(t).width + 16;
        c.fillStyle = "#fff"; c.strokeStyle = shop ? "#e0702a" : "#0a7f7a"; c.lineWidth = 1.5;
        c.beginPath(); c.roundRect ? c.roundRect(x + 12, y - 26, w, 22, 6) : c.rect(x + 12, y - 26, w, 22); c.fill(); c.stroke();
        c.fillStyle = "#10202c"; c.fillText(t, x + 20, y - 11);
      }
      raf = requestAnimationFrame(frame);
    }

    // Bandeja de presupuestos (ejemplo)
    const QUOTES = [
      { t: "Taller Norte", v: "Furgoneta 07", c: "Sustitución de embrague", a: 1240 },
      { t: "Taller Centro", v: "Turismo 03", c: "Pastillas y discos delanteros", a: 386 },
      { t: "Neumáticos Sur", v: "Furgoneta 12", c: "Cuatro neumáticos", a: 520 },
      { t: "Taller Norte", v: "Camión 02", c: "Revisión de 60.000 km", a: 690 },
    ];
    const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
    const qs = QUOTES.map(() => null);
    function renderQ() {
      $("#quotes").innerHTML = QUOTES.map((q, k) => `<li class="q${qs[k] ? " done-" + qs[k] : ""}"><div class="q-main"><b>${q.c}</b><span>${q.v} · ${q.t}</span></div><span class="q-amt">${eur.format(q.a)}</span><div class="q-act">${qs[k] ? `<span class="q-state">${qs[k] === "ok" ? "✓ Autorizado" : "Revisión pedida al taller"}</span>` : `<button type="button" class="ok" data-k="${k}" data-a="ok">Autorizar</button><button type="button" data-k="${k}" data-a="rev">Pedir revisión</button>`}</div></li>`).join("");
      $("#q-ok").textContent = eur.format(QUOTES.reduce((sum, q, k) => sum + (qs[k] === "ok" ? q.a : 0), 0));
      $("#q-rev").textContent = qs.filter((x) => x === "rev").length;
      $("#q-pend").textContent = qs.filter((x) => !x).length;
    }
    $("#quotes").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]");
      if (!b) return;
      qs[b.dataset.k] = b.dataset.a;
      renderQ();
      toast(b.dataset.a === "ok" ? "Presupuesto autorizado" : "Revisión pedida al taller");
    });
    $("#q-reset").addEventListener("click", () => { qs.fill(null); renderQ(); });

    // Correo del equipo técnico (ejemplo)
    const MAIL = [
      { from: "Taller Norte", time: "09:12", subj: "Furgoneta 07: autorización del embrague", body: "Buenos días. Para seguir con la furgoneta 07 necesitamos autorización para sustituir el embrague según el presupuesto enviado.", rep: "Buenos días. Revisado el presupuesto, queda autorizado el cambio de embrague de la furgoneta 07. Avisadnos cuando esté lista para recogerla.\nUn saludo, Álvaro" },
      { from: "Cliente · Logística", time: "10:47", subj: "¿Cuándo vuelve el camión 02?", body: "Hola, ¿sabéis cuándo tendremos de vuelta el camión 02? Lo necesitamos para la ruta del jueves.", rep: "Hola. El camión 02 está terminando la revisión de 60.000 km y el taller confirma que estará listo el miércoles por la tarde, a tiempo para la ruta del jueves.\nUn saludo, Álvaro" },
      { from: "Taller Centro", time: "12:05", subj: "Turismo 03: ¿cambiamos también discos?", body: "Las pastillas del turismo 03 están al límite y los discos tienen desgaste. ¿Cambiamos las dos cosas?", rep: "Sí, adelante con pastillas y discos delanteros según el presupuesto. Gracias por avisar.\nUn saludo, Álvaro" },
    ];
    const replied = new Set();
    let typing = 0, sel = -1;
    const renderInbox = () => ($("#inbox").innerHTML = MAIL.map((mm, k) => `<li class="${replied.has(k) ? "replied" : ""}"><button type="button" data-m="${k}" aria-pressed="${k === sel}"><span class="from">${mm.from}<i></i></span><span class="subj">${mm.subj}</span></button></li>`).join(""));
    function openMail(k) {
      sel = k;
      renderInbox();
      const mm = MAIL[k], r = $("#reader");
      r.innerHTML = `<p class="meta">De: ${mm.from} · ${mm.time}</p><p class="msg">${mm.body}</p><p class="meta">Respuesta del equipo técnico</p><p class="rep"></p>`;
      const rep = $(".rep", r);
      clearInterval(typing);
      const done = () => { replied.add(k); renderInbox(); };
      if (reduce) { rep.textContent = mm.rep; return done(); }
      let i = 0;
      typing = setInterval(() => { rep.textContent = mm.rep.slice(0, (i += 2)); if (i >= mm.rep.length) { clearInterval(typing); done(); } }, 18);
    }
    $("#inbox").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (b) openMail(+b.dataset.m); });
    renderQ();
    renderInbox();

    return {
      enter() {
        size();
        if (sel < 0) openMail(0);
        cancelAnimationFrame(raf);
        if (reduce) return frame(0), cancelAnimationFrame(raf);
        prev = performance.now(); raf = requestAnimationFrame(frame);
      },
      leave() { cancelAnimationFrame(raf); clearInterval(typing); },
    };
  })();

  /* ====================== CONTACTO ====================== */
  const EMAIL = "alvarog.fp13@gmail.com";
  $("#copy-mail").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(EMAIL); toast("Email copiado"); }
    catch { const r = document.createRange(); r.selectNodeContents($("#copy-mail .val")); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Selecciona y copia el email"); }
    $("#copy-txt").textContent = "Copiado";
    setTimeout(() => ($("#copy-txt").textContent = "Copiar"), 1800);
  });
  const form = $("#letter"), err = $("#form-err");
  // Adjuntos: hasta 3 archivos y 10 MB en total; se copian a los campos de archivo del formulario al enviar
  const MAX_FILES = 3, MAX_BYTES = 10 * 1024 * 1024;
  let files = [];
  const kb = (b) => (b > 1048576 ? nf1.format(b / 1048576) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  function renderFiles() {
    $("#files").innerHTML = files.map((f, i) => `<li><span class="fn" title="${f.name.replace(/"/g, "&quot;")}"></span><span class="fs">${kb(f.size)}</span><button type="button" data-i="${i}" aria-label="Quitar archivo">×</button></li>`).join("");
    $$("#files .fn").forEach((el, i) => (el.textContent = files[i].name));
  }
  function addFiles(list) {
    for (const f of list) {
      if (files.length >= MAX_FILES) { toast(`Máximo ${MAX_FILES} archivos`); break; }
      if (files.reduce((s, x) => s + x.size, 0) + f.size > MAX_BYTES) { toast(`«${f.name}» supera el límite de 10 MB en total`); continue; }
      files.push(f);
    }
    renderFiles();
  }
  $("#f-pick").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  $("#files").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) { files.splice(+b.dataset.i, 1); renderFiles(); } });
  const zone = $("#attach");
  ["dragenter", "dragover"].forEach((ev) => form.addEventListener(ev, (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); zone.classList.add("drag"); } }));
  ["dragleave", "drop"].forEach((ev) => form.addEventListener(ev, () => zone.classList.remove("drag")));
  form.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#f-name"), mail = $("#f-mail"), msg = $("#f-msg"), sub = $("#f-subject");
    const bad = [];
    if (!name.value.trim()) bad.push([name, "tu nombre"]);
    if (!msg.value.trim()) bad.push([msg, "el mensaje"]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) bad.push([mail, "un email válido (nombre@empresa.com)"]);
    [name, mail, msg].forEach((f) => f.classList.remove("bad"));
    if (bad.length) {
      bad.forEach(([f]) => f.classList.add("bad"));
      err.textContent = "Falta " + bad.map((b) => b[1]).join(", ") + ".";
      bad[0][0].focus();
      return;
    }
    err.textContent = "";
    $("#f-subj-hidden").value = `[Web] ${sub.value} · ${name.value.trim()}`;
    if (!/^https?:$/.test(location.protocol)) {
      // Abierta como archivo local: no hay servidor al que enviar, se usa el programa de correo (sin adjuntos)
      const bodyTxt = `Hola Álvaro,\n\nme llamo ${name.value.trim()} y te escribo por: ${sub.value}.\n\n${msg.value.trim()}\n\nPuedes responderme en ${mail.value.trim()}.`;
      if (files.length) toast("Abierta en local: adjunta los archivos en tu programa de correo");
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent($("#f-subj-hidden").value)}&body=${encodeURIComponent(bodyTxt)}`;
      return;
    }
    $("#f-next").value = location.href.split("#")[0] + "#gracias";
    const slots = $$('input[type="file"][name^="attachment"]', form);
    try {
      slots.forEach((inp, i) => { const dt = new DataTransfer(); if (files[i]) dt.items.add(files[i]); inp.files = dt.files; });
    } catch { if (files.length) toast("Tu navegador no permite adjuntar así; envía los archivos por email"); }
    $("#send").disabled = true;
    $("#send").textContent = "Enviando…";
    form.classList.add("sent");
    setTimeout(() => form.submit(), reduce ? 0 : 700);
  });
  addEventListener("pageshow", () => { form.classList.remove("sent"); $("#send").disabled = false; $("#send").textContent = "Enviar mensaje"; });
  const showThanks = () => { $("#contact-main").hidden = true; $("#thanks").hidden = false; };
  $("#again").addEventListener("click", () => { form.reset(); files = []; renderFiles(); $("#send").disabled = false; $("#send").textContent = "Enviar mensaje"; form.classList.remove("sent"); $("#thanks").hidden = true; $("#contact-main").hidden = false; history.replaceState(null, "", "#contacto"); });
  mods.contacto = {
    enter() {
      if (location.hash === "#gracias") showThanks();
      if (pendingSubject) { $("#f-subject").value = pendingSubject; pendingSubject = null; }
    },
  };

  show(location.hash.slice(1) || "inicio", false);
  document.fonts?.ready.then(placeInk);
})();
