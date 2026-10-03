// PasoAPaso: extensión pasiva. No hay que abrir nada.
// Si la página coincide con una tarea (tasks.js), aparece una tarjeta pequeña en una esquina
// con UN paso, y se marca en la página el elemento que hay que usar.
// Todo se calcula mirando el estado de la página, así que no hace falta detectar clics.
(() => {
  window.__pasoapasoStop?.();

  const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="tab"]';
  const COLORS = { step: "#f5a300", warn: "#d93025", danger: "#d93025", ok: "#1e8e3e" };
  const CORNERS = ["br", "bl", "tr", "tl"];
  const MARGIN = 16;
  const EVENTS = ["input", "change", "click", "focusin", "focusout", "popstate", "hashchange"];

  const CSS = `
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .card, .pill, .ring { position: fixed; font-family: "Segoe UI", system-ui, sans-serif; }
    [data-pos="br"] { right: 16px; bottom: 16px; }
    [data-pos="bl"] { left: 16px; bottom: 16px; }
    [data-pos="tr"] { right: 16px; top: 16px; }
    [data-pos="tl"] { left: 16px; top: 16px; }

    .card {
      width: 290px; max-width: calc(100vw - 32px); padding: 10px 14px 14px;
      background: #fff; color: #14213d; border: 3px solid var(--c); border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .28); pointer-events: auto;
    }
    .card[data-kind="danger"] { background: #fff1f0; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #4b5565; font-size: 14px; font-weight: 600; }
    .min {
      width: 36px; height: 36px; flex: none; font-size: 20px; line-height: 1; color: #333;
      background: #fff; border: 1px solid #cfd5df; border-radius: 10px; cursor: pointer;
    }
    .dots { display: flex; gap: 6px; margin: 4px 0 8px; }
    .dots i { width: 10px; height: 10px; border-radius: 50%; background: #d9dee7; }
    .dots i.on { background: var(--c); }
    .dots i.cur { background: var(--c); outline: 2px solid var(--c); outline-offset: 2px; }
    .text { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 700; }
    .sub { margin: 6px 0 0; font-size: 16px; line-height: 1.3; color: #3b4252; }

    .pill {
      min-width: 48px; height: 48px; padding: 0 12px; font: 700 16px/1 "Segoe UI", system-ui, sans-serif;
      color: #14213d; background: #fff; border: 3px solid var(--c); border-radius: 999px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, .28); cursor: pointer; pointer-events: auto;
    }

    .ring {
      border: 4px solid var(--c); border-radius: 10px; pointer-events: none;
      box-shadow: 0 0 0 3px rgba(20, 20, 20, .85), 0 0 18px 4px color-mix(in srgb, var(--c) 55%, transparent);
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse { 50% { box-shadow: 0 0 0 3px rgba(20, 20, 20, .85), 0 0 4px 0 transparent; } }
    @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
    :focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }
  `;

  const st = {
    collapsed: false,
    corner: "br",
    targetEl: null,
    scrolledFor: "",
    dismissed: "", // clave de la situación ya terminada y ocultada
    timerKey: "",
    finishTimer: 0,
    queued: 0,
    raf: 0,
  };
  try {
    st.collapsed = sessionStorage.getItem("pasoapaso-min") === "1";
  } catch {
    // sin almacenamiento: la tarjeta empieza abierta
  }

  let host = null;
  let els = null;
  let dotsSignature = "";

  // ---------- Utilidades

  const $ = (selector) => document.querySelector(selector);
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  }

  function accessibleName(el) {
    return (
      el.getAttribute("aria-label") ||
      el.labels?.[0]?.textContent ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      el.textContent ||
      el.value ||
      ""
    );
  }

  function findTarget(target) {
    if (!target) return null;
    if (typeof target === "string") {
      const el = $(target);
      return isVisible(el) ? el : null;
    }
    const wanted = norm(target.text);
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      if (isVisible(el) && norm(accessibleName(el)).includes(wanted)) return el;
    }
    return null;
  }

  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  }

  function isDone(done) {
    if (!done || done.never) return false;
    if (done.any) return done.any.some(isDone);
    if (done.visible) return isVisible($(done.visible));
    const el = $(done.filled || done.selected || "");
    if (!el) return false;
    let value = (el.value || "").trim();
    if (!value) return false;
    if (done.strip) value = value.replace(new RegExp(done.strip, "g"), "");
    if (done.minLength && value.length < done.minLength) return false;
    if (done.pattern && !new RegExp(done.pattern, "i").test(value)) return false;
    return true;
  }

  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  // ---------- Qué tarea y qué paso toca ahora

  function compute() {
    const task = (window.PP_TASKS || []).find((t) => safe(t.when, false));
    if (!task) return null;
    const steps = task.steps || [];
    return {
      task,
      steps,
      index: steps.findIndex((s) => !isDone(s.done)),
      key: `${task.id}:${safe(() => task.key?.() ?? "", "")}`,
    };
  }

  function update() {
    st.queued = 0;
    const ctx = compute();
    if (!ctx) return hide();

    const { task, steps, index, key } = ctx;
    let view;
    if (index >= 0) {
      // Si vuelve a haber algo pendiente, la tarea terminada deja de estar "ocultada".
      st.dismissed = "";
      st.timerKey = "";
      clearTimeout(st.finishTimer);
      const step = steps[index];
      const typed = step.done?.filled && ($(step.done.filled)?.value || "").trim() !== "";
      view = {
        kind: step.warn ? "warn" : "step",
        text: step.text,
        sub: (typed && step.hint) || step.warn || "",
        n: index + 1,
        total: steps.length,
        target: step.target,
      };
    } else {
      if (key === st.dismissed) return hide();
      const end = safe(() => task.finish(), { text: "✔ Hecho", kind: "ok" });
      view = {
        kind: end.kind || "ok",
        text: end.text,
        sub: end.sub || "",
        n: steps.length,
        total: steps.length,
        target: end.target,
        done: true,
      };
      if (end.hideAfter && st.timerKey !== key) {
        st.timerKey = key;
        clearTimeout(st.finishTimer);
        st.finishTimer = setTimeout(() => {
          st.dismissed = key;
          queue();
        }, end.hideAfter);
      }
    }
    show(task, view);
  }

  const queue = () => {
    if (!st.queued) st.queued = setTimeout(update, 60);
  };

  // ---------- Tarjeta y marca en la página (dentro de un Shadow DOM para no mezclarse con la página)

  function ensureOverlay() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "pasoapaso-overlay";
    host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; display: none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <div class="ring" hidden></div>
      <div class="card" data-pos="br" role="status" aria-live="polite" hidden>
        <div class="top"><span class="title"></span><button class="min" type="button" aria-label="Minimizar" title="Minimizar">–</button></div>
        <div class="dots" role="img" hidden></div>
        <p class="text"></p>
        <p class="sub" hidden></p>
      </div>
      <button class="pill" data-pos="br" type="button" hidden></button>`;
    const q = (selector) => root.querySelector(selector);
    els = { ring: q(".ring"), card: q(".card"), title: q(".title"), min: q(".min"), dots: q(".dots"), text: q(".text"), sub: q(".sub"), pill: q(".pill") };
    els.min.addEventListener("click", () => setCollapsed(true));
    els.pill.addEventListener("click", () => setCollapsed(false));
    document.documentElement.append(host);
  }

  function setCollapsed(value) {
    st.collapsed = value;
    try {
      sessionStorage.setItem("pasoapaso-min", value ? "1" : "0");
    } catch {
      // sin almacenamiento: solo vale para esta página
    }
    update();
  }

  const setText = (el, value) => {
    if (el.textContent !== value) el.textContent = value;
  };

  function show(task, view) {
    ensureOverlay();
    const forced = view.kind === "danger"; // un aviso de engaño no se puede minimizar
    const collapsed = st.collapsed && !forced;

    host.style.display = "block";
    host.style.setProperty("--c", COLORS[view.kind] || COLORS.step);
    els.card.hidden = collapsed;
    els.pill.hidden = !collapsed;
    els.card.dataset.kind = view.kind;
    els.min.hidden = forced;

    setText(els.title, `${task.icon} ${task.title}`);
    setText(els.text, view.text);
    setText(els.sub, view.sub);
    els.sub.hidden = !view.sub;

    const total = view.total > 1 ? view.total : 0;
    const signature = `${view.n}/${total}/${view.done ? 1 : 0}`;
    els.dots.hidden = !total;
    if (total && signature !== dotsSignature) {
      els.dots.replaceChildren(
        ...Array.from({ length: total }, (_, i) => {
          const dot = document.createElement("i");
          dot.className = view.done || i < view.n - 1 ? "on" : i === view.n - 1 ? "cur" : "";
          return dot;
        }),
      );
      els.dots.setAttribute("aria-label", view.done ? "Terminado" : `Paso ${view.n} de ${total}`);
    }
    dotsSignature = signature;

    setText(els.pill, view.done ? `${task.icon} ✔` : total ? `${task.icon} ${view.n}/${total}` : task.icon);
    els.pill.setAttribute("aria-label", `Mostrar ayuda: ${view.text}`);

    st.targetEl = collapsed ? null : findTarget(view.target);
    const scrollKey = `${task.id}:${view.n}:${view.text}`;
    if (st.targetEl && st.scrolledFor !== scrollKey) {
      st.scrolledFor = scrollKey;
      if (!inView(st.targetEl)) {
        st.targetEl.scrollIntoView({ block: "center", inline: "nearest", behavior: REDUCED_MOTION ? "auto" : "smooth" });
      }
    }
  }

  function hide() {
    st.targetEl = null;
    if (host) host.style.display = "none";
  }

  // ---------- Se repite en cada fotograma: sigue al elemento marcado y aparta la tarjeta si lo tapa

  function loop() {
    st.raf = requestAnimationFrame(loop);
    if (!host || host.style.display === "none") return;

    let rect = null;
    const el = st.targetEl;
    if (el && isVisible(el)) rect = el.getBoundingClientRect();

    if (rect) {
      const pad = 5;
      const box = `left:${Math.round(rect.left - pad)}px;top:${Math.round(rect.top - pad)}px;width:${Math.round(rect.width + pad * 2)}px;height:${Math.round(rect.height + pad * 2)}px`;
      if (els.ring.dataset.box !== box) {
        els.ring.style.cssText = box;
        els.ring.dataset.box = box;
      }
    }
    els.ring.hidden = !rect;

    const shownBox = !els.card.hidden ? els.card : !els.pill.hidden ? els.pill : null;
    if (!shownBox) return;
    const w = shownBox.offsetWidth;
    const h = shownBox.offsetHeight;
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    const at = (corner) => {
      const left = corner[1] === "l" ? MARGIN : cw - MARGIN - w;
      const top = corner[0] === "t" ? MARGIN : ch - MARGIN - h;
      return { left, top, right: left + w, bottom: top + h };
    };
    const covers = (b) => rect && b.left < rect.right + 12 && b.right > rect.left - 12 && b.top < rect.bottom + 12 && b.bottom > rect.top - 12;
    if (covers(at(st.corner))) {
      const free = CORNERS.find((corner) => !covers(at(corner)));
      if (free) st.corner = free;
    }
    if (els.card.dataset.pos !== st.corner) els.card.dataset.pos = els.pill.dataset.pos = st.corner;
  }

  // ---------- Arranque y parada

  const observer = new MutationObserver(queue);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "disabled"],
  });
  for (const type of EVENTS) window.addEventListener(type, queue, true);
  const tick = setInterval(queue, 1000); // por si algo cambia sin avisar (valores puestos por código, rutas…)

  window.__pasoapasoStop = () => {
    clearTimeout(st.queued);
    clearTimeout(st.finishTimer);
    clearInterval(tick);
    cancelAnimationFrame(st.raf);
    observer.disconnect();
    for (const type of EVENTS) window.removeEventListener(type, queue, true);
    host?.remove();
    delete window.__pasoapasoStop;
  };

  update();
  loop();
})();
