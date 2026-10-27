// PasoAPaso: tarjeta pequeña en una esquina, con UN paso, y una marca en la página.
// Dos modos:
//   - Automático: en la intranet de ejemplo, tareas escritas a mano (tasks.js) que se detectan solas.
//   - IA: en cualquier página, la persona escribe qué quiere hacer y Gemini va dando los pasos de uno en uno.
(() => {
  window.__pasoapasoStop?.();

  const DEMO = /^(127\.0\.0\.1|localhost)?$/.test(location.hostname); // las tareas escritas a mano solo valen aquí
  const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="tab"]';
  const COLORS = { step: "#f5a300", warn: "#d93025", danger: "#d93025", ok: "#1e8e3e" }; // marca en la página
  const CARD = { step: "#2563eb", warn: "#d93025", danger: "#d93025", ok: "#1e8e3e" }; // color de la tarjeta
  const CORNERS = ["br", "bl", "tr", "tl"];
  const MARGIN = 16;
  const EVENTS = ["input", "change", "click", "focusin", "focusout", "popstate", "hashchange"];
  const FONT = '"Segoe UI", system-ui, sans-serif';

  const CSS = `
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .card, .pill, .fab, .ring { position: fixed; font-family: ${FONT}; }
    [data-pos="br"] { right: 16px; bottom: 16px; }
    [data-pos="bl"] { left: 16px; bottom: 16px; }
    [data-pos="tr"] { right: 16px; top: 16px; }
    [data-pos="tl"] { left: 16px; top: 16px; }

    .card {
      width: 340px; max-width: calc(100vw - 32px); padding: 14px 16px 16px;
      background: #fff; color: #14213d; border: 3px solid var(--c); border-radius: 18px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .28); pointer-events: auto;
    }
    .card[data-kind="danger"] { background: #fff1f0; }
    .top { display: flex; align-items: center; gap: 8px; }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 18px; font-weight: 700; color: #111827; }
    .counter { flex: none; font-size: 16px; font-weight: 700; color: var(--c); }
    .btns { display: flex; gap: 4px; flex: none; }
    .hb {
      width: 32px; height: 32px; font-size: 16px; line-height: 1; color: #4b5563;
      background: transparent; border: 1px solid #d1d5db; border-radius: 9px; cursor: pointer;
    }
    .bar { height: 10px; margin: 10px 0 2px; overflow: hidden; background: #e5e7eb; border-radius: 999px; }
    .fill { height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #10b981); transition: width .3s; }

    .row {
      display: flex; align-items: center; gap: 10px; min-height: 46px; margin-top: 10px; padding: 6px 8px 6px 12px;
      font-size: 16px; line-height: 1.25; color: #374151; background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 12px;
    }
    .mark { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: #ddd6fe; font-size: 14px; font-weight: 700; color: #fff; }
    .rt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .row.done { color: #166534; background: #dcfce7; border-color: #86efac; }
    .row.done .rt { text-decoration: line-through; }
    .row.done .mark, .row.ok .mark { background: #22c55e; }
    .row.done .mark::before, .row.ok .mark::before { content: "✓"; }
    .row.cur { font-size: 17px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-color: #60a5fa; }
    .row.cur .mark { width: auto; background: transparent; font-size: 22px; }
    .card[data-kind="warn"] .row.cur { color: #b3261e; background: #fff1f0; border-color: #f28b82; }
    .row.ok { font-weight: 700; color: #166534; background: #dcfce7; border-color: #22c55e; }
    .row.danger { font-weight: 700; color: #b3261e; background: #fee2e2; border-color: #d93025; }
    .row.danger .mark { background: transparent; font-size: 20px; }
    .spk { flex: none; width: 34px; height: 34px; font-size: 17px; line-height: 1; background: transparent; border: 0; border-radius: 8px; cursor: pointer; opacity: .65; }
    .spk:hover { opacity: 1; background: rgba(0, 0, 0, .06); }
    .sub { margin: 10px 2px 0; font-size: 15px; line-height: 1.3; color: #3b4252; }

    .ask { display: flex; gap: 8px; margin-top: 8px; }
    .ask input {
      flex: 1; min-width: 0; height: 48px; padding: 0 12px; font: 18px ${FONT}; color: #14213d;
      background: #fff; border: 2px solid #b9c1ce; border-radius: 12px;
    }
    .ask button { width: 48px; height: 48px; font-size: 20px; color: #fff; background: #1a56c4; border: 0; border-radius: 12px; cursor: pointer; }
    .actions { margin-top: 14px; }
    .next {
      width: 100%; height: 54px; font: 700 18px ${FONT}; color: #fff;
      background: var(--c); border: 0; border-radius: 14px; cursor: pointer;
    }

    .pill {
      min-width: 48px; height: 48px; padding: 0 12px; font: 700 16px/1 ${FONT};
      color: #14213d; background: #fff; border: 3px solid var(--c); border-radius: 999px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, .28); cursor: pointer; pointer-events: auto;
    }
    .fab {
      width: 52px; height: 52px; font-size: 24px; line-height: 1; color: #14213d;
      background: #fff; border: 3px solid #1a56c4; border-radius: 50%;
      box-shadow: 0 6px 18px rgba(0, 0, 0, .3); cursor: pointer; pointer-events: auto;
    }

    /* La marca oscurece el resto de la pantalla (la sombra enorme); los clics pasan a través. */
    .ring {
      border: 4px solid var(--ring); border-radius: 10px; pointer-events: none;
      box-shadow: 0 0 0 3px rgba(20, 20, 20, .85), 0 0 18px 4px color-mix(in srgb, var(--ring) 55%, transparent), 0 0 0 100vmax rgba(15, 23, 42, .5);
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse { 50% { box-shadow: 0 0 0 3px rgba(20, 20, 20, .85), 0 0 4px 0 transparent, 0 0 0 100vmax rgba(15, 23, 42, .5); } }
    @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
    /* Se pueden arrastrar: la cabecera de la tarjeta, la burbuja y el botón 💬. */
    .top { cursor: grab; touch-action: none; user-select: none; }
    .fab, .pill { cursor: grab; touch-action: none; }
    .hb { cursor: pointer; }
    :focus-visible { outline: 3px solid #1a73e8; outline-offset: 2px; }
  `;

  const st = {
    mode: "auto", // auto | ask | ai
    collapsed: false,
    corner: "br",
    targetEl: null,
    scrolledFor: "",
    dismissed: "", // clave de la tarea ya terminada y ocultada (modo automático)
    timerKey: "",
    finishTimer: 0,
    lastMutation: Date.now(),
    askFocus: false,
    listSignature: "",
    pos: null, // posición elegida arrastrando { left, top }; null = esquina automática
    justDragged: false,
    ai: null,
    queued: 0,
    raf: 0,
  };
  try {
    st.collapsed = sessionStorage.getItem("pasoapaso-min") === "1";
  } catch {
    // sin almacenamiento: la tarjeta empieza abierta
  }

  st.pos = loadPos();

  let host = null;
  let els = null;

  // ---------- Utilidades

  const $ = (selector) => document.querySelector(selector);
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Se crean los elementos uno a uno (sin innerHTML): hay páginas, como las de Google, que lo bloquean.
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (name === "text") el.textContent = value;
      else if (name === "class") el.className = value;
      else el.setAttribute(name, value === true ? "" : value);
    }
    el.append(...children);
    return el;
  }

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

  function scrollToOnce(el, key) {
    if (!el || st.scrolledFor === key) return;
    st.scrolledFor = key;
    if (!inView(el)) el.scrollIntoView({ block: "center", inline: "nearest", behavior: REDUCED_MOTION ? "auto" : "smooth" });
  }

  // ---------- MODO AUTOMÁTICO: tareas escritas a mano (solo en la intranet de ejemplo)

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

  function compute() {
    const tasks = DEMO ? window.PP_TASKS || [] : [];
    const task = tasks.find((t) => safe(t.when, false));
    if (!task) return null;
    const steps = task.steps || [];
    return {
      task,
      steps,
      index: steps.findIndex((s) => !isDone(s.done)),
      key: `${task.id}:${safe(() => task.key?.() ?? "", "")}`,
    };
  }

  function autoUpdate() {
    const ctx = compute();
    if (!ctx) return showIdle();

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
        items: steps.map((s, i) => ({ text: s.text, state: i === index ? "cur" : isDone(s.done) ? "done" : "todo" })),
      };
    } else {
      if (key === st.dismissed) return showIdle();
      const end = safe(() => task.finish(), { text: "✔ Hecho", kind: "ok" });
      view = {
        kind: end.kind || "ok",
        text: end.text,
        sub: end.sub || "",
        n: steps.length,
        total: steps.length,
        target: end.target,
        done: true,
        items: [
          ...steps.map((s) => ({ text: s.text, state: "done" })),
          { text: end.text, state: end.kind === "danger" ? "danger" : "ok" },
        ],
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
    showTask(task, view);
  }

  // ---------- Arrastrar la tarjeta, la burbuja y el botón 💬 (la posición se recuerda en esta pestaña)

  function loadPos() {
    try {
      const value = JSON.parse(sessionStorage.getItem("pasoapaso-pos") || "null");
      return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? value : null;
    } catch {
      return null;
    }
  }

  function savePos() {
    try {
      if (st.pos) sessionStorage.setItem("pasoapaso-pos", JSON.stringify(st.pos));
      else sessionStorage.removeItem("pasoapaso-pos");
    } catch {
      // sin almacenamiento: solo vale mientras la página esté abierta
    }
  }

  // Coloca el elemento en la posición elegida, sin salirse de la ventana.
  function clampPos(el, left, top) {
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    return {
      left: Math.min(Math.max(0, left), Math.max(0, cw - el.offsetWidth)),
      top: Math.min(Math.max(0, top), Math.max(0, ch - el.offsetHeight)),
    };
  }

  function placeManual(el) {
    const { left, top } = clampPos(el, st.pos.left, st.pos.top);
    const css = `left:${Math.round(left)}px;top:${Math.round(top)}px;right:auto;bottom:auto`;
    if (el.dataset.at !== css) {
      el.style.cssText = css;
      el.dataset.at = css;
    }
  }

  function resetPos() {
    st.pos = null;
    savePos();
    for (const el of [els.card, els.pill, els.fab]) {
      el.style.cssText = "";
      delete el.dataset.at;
    }
  }

  // `handle` es lo que se agarra; `box` lo que se mueve. Un clic sin mover sigue siendo un clic.
  function makeDraggable(handle, box, { ignoreButtons = false } = {}) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (ignoreButtons && event.target.closest("button"))) return;
      const start = box.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // sin captura: se arrastra mientras el puntero siga encima
      }
      const move = (e) => {
        if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
        dragging = true;
        st.pos = clampPos(box, start.left + e.clientX - startX, start.top + e.clientY - startY);
        placeManual(box);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        if (dragging) {
          st.justDragged = true; // el clic que llega justo después de arrastrar no cuenta
          setTimeout(() => (st.justDragged = false), 120);
          savePos();
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  // ---------- Tarjeta y marca en la página (dentro de un Shadow DOM para no mezclarse con la página)

  function ensureOverlay() {
    if (host?.isConnected) return;
    host = h("div", { id: "pasoapaso-overlay" });
    host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; display: none;";
    const root = host.attachShadow({ mode: "open" });

    els = {};
    els.ring = h("div", { class: "ring", hidden: true });
    els.title = h("span", { class: "title" });
    els.askbtn = h("button", { class: "hb", type: "button", "aria-label": "Preguntar a la IA", title: "Preguntar", text: "💬" });
    els.end = h("button", { class: "hb", type: "button", "aria-label": "Terminar", title: "Terminar", text: "✕" });
    els.min = h("button", { class: "hb", type: "button", "aria-label": "Minimizar", title: "Minimizar", text: "–" });
    els.counter = h("span", { class: "counter", hidden: true });
    els.fill = h("div", { class: "fill" });
    els.bar = h("div", { class: "bar", role: "progressbar", "aria-label": "Progreso", "aria-valuemin": "0", "aria-valuemax": "100", hidden: true }, els.fill);
    els.list = h("div", { class: "list", role: "list", "aria-live": "polite" });
    els.sub = h("p", { class: "sub", hidden: true });
    els.input = h("input", { type: "text", maxlength: "200", autocomplete: "off", placeholder: "¿Qué quieres hacer?", "aria-label": "¿Qué quieres hacer?" });
    els.send = h("button", { type: "submit", "aria-label": "Preguntar", title: "Preguntar", text: "➤" });
    els.form = h("form", { class: "ask", hidden: true }, els.input, els.send);
    els.next = h("button", { class: "next", type: "button", text: "Siguiente Paso →" });
    els.actions = h("div", { class: "actions", hidden: true }, els.next);
    els.card = h(
      "div",
      { class: "card", "data-pos": "br", role: "region", "aria-label": "PasoAPaso", hidden: true },
      (els.top = h("div", { class: "top", title: "Arrastra para mover" }, els.title, els.counter, h("span", { class: "btns" }, els.askbtn, els.end, els.min))),
      els.bar,
      els.list,
      els.sub,
      els.form,
      els.actions,
    );
    els.pill = h("button", { class: "pill", "data-pos": "br", type: "button", hidden: true });
    els.fab = h("button", { class: "fab", "data-pos": "br", type: "button", "aria-label": "Preguntar a la IA", title: "Preguntar a la IA", text: "💬", hidden: true });
    root.append(h("style", { text: CSS }), els.ring, els.card, els.pill, els.fab);
    // Pulsar un botón de la tarjeta no le quita el cursor al campo de la página (así se puede seguir escribiendo).
    // Solo la casilla de pregunta de la propia tarjeta puede coger el cursor.
    root.addEventListener("mousedown", (event) => {
      if (!event.target.closest?.("input, textarea")) event.preventDefault();
    });

    els.askbtn.addEventListener("click", enterAsk);
    els.fab.addEventListener("click", () => !st.justDragged && enterAsk());
    els.end.addEventListener("click", () => (st.mode === "ai" ? endAi() : leaveAsk()));
    els.min.addEventListener("click", () => setCollapsed(true));
    els.pill.addEventListener("click", () => !st.justDragged && setCollapsed(false));
    makeDraggable(els.top, els.card, { ignoreButtons: true });
    makeDraggable(els.pill, els.pill);
    makeDraggable(els.fab, els.fab);
    els.top.addEventListener("dblclick", (event) => !event.target.closest("button") && resetPos()); // doble clic: vuelve a la esquina automática
    els.next.addEventListener("click", onNext);
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const goal = els.input.value.trim();
      if (goal) startAi(goal);
    });
    // Que las teclas escritas aquí no activen los atajos de la página (Gmail, por ejemplo).
    for (const type of ["keydown", "keyup", "keypress"]) {
      els.input.addEventListener(type, (event) => {
        event.stopPropagation();
        if (type === "keydown" && event.key === "Escape") leaveAsk();
      });
    }
    document.documentElement.append(host);
  }

  const setText = (el, value) => {
    if (el.textContent !== value) el.textContent = value;
  };

  function ui({ ask = false, end = false, min = false, form = false, actions = false } = {}) {
    els.askbtn.hidden = !ask;
    els.end.hidden = !end;
    els.min.hidden = !min;
    els.form.hidden = !form;
    els.actions.hidden = !actions;
  }

  function open(kind) {
    ensureOverlay();
    host.style.display = "block";
    host.style.setProperty("--c", CARD[kind] || CARD.step);
    host.style.setProperty("--ring", COLORS[kind] || COLORS.step);
  }

  // Leer un paso en voz alta (voz del navegador, el texto no sale del ordenador).
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text).replace(/[«»]/g, "").replace(/^✔\s*/, ""));
      utterance.lang = "es-ES";
      utterance.rate = 0.95;
      speechSynthesis.speak(utterance);
    } catch {
      // sin voz disponible
    }
  }

  function row(item) {
    const speaker =
      item.speak === false || typeof speechSynthesis === "undefined"
        ? null
        : h("button", { class: "spk", type: "button", "aria-label": `Leer en voz alta: ${item.text}`, title: "Escuchar", text: "🔊" });
    speaker?.addEventListener("click", () => speak(item.text));
    const mark = h("span", { class: "mark", "aria-hidden": "true", text: item.state === "cur" ? "👉" : item.state === "danger" ? "⚠️" : "" });
    return h("div", { class: `row ${item.state}`, role: "listitem" }, ...[mark, h("span", { class: "rt", text: item.text }), speaker].filter(Boolean));
  }

  // Pinta contador, barra de progreso, lista de pasos y la línea de ayuda.
  function render(view) {
    const total = view.total > 1 ? view.total : 0;
    const counter = view.counter ?? (total ? `${view.n}/${total}` : "");
    setText(els.counter, counter);
    els.counter.hidden = !counter;

    const progress = view.progress !== undefined ? view.progress : total ? (view.done ? 1 : view.n / total) : null;
    els.bar.hidden = progress == null;
    if (progress != null) {
      els.fill.style.width = `${Math.round(progress * 100)}%`;
      els.bar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    }

    els.list.hidden = false;
    const signature = JSON.stringify(view.items);
    if (signature !== st.listSignature) {
      st.listSignature = signature;
      els.list.replaceChildren(...view.items.map(row));
    }

    setText(els.sub, view.sub || "");
    els.sub.hidden = !view.sub;
    return total;
  }

  function setTarget(el) {
    st.targetEl = el;
    if (!el && els) els.ring.hidden = true;
  }

  function showIdle() {
    setTarget(null);
    if (st.mode !== "auto") return;
    open("step");
    els.card.hidden = true;
    els.pill.hidden = true;
    els.fab.hidden = false;
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

  function showTask(task, view) {
    const forced = view.kind === "danger"; // un aviso de engaño no se puede minimizar
    const collapsed = st.collapsed && !forced;
    open(view.kind);
    els.fab.hidden = true;
    els.card.hidden = collapsed;
    els.pill.hidden = !collapsed;
    els.card.dataset.kind = view.kind;
    ui({ ask: true, min: !forced });

    setText(els.title, `${task.icon} ${task.title}`);
    const total = render(view);

    setText(els.pill, view.done ? `${task.icon} ✔` : total ? `${task.icon} ${view.n}/${total}` : task.icon);
    els.pill.setAttribute("aria-label", `Mostrar ayuda: ${view.text}`);

    setTarget(collapsed ? null : findTarget(view.target));
    scrollToOnce(st.targetEl, `${task.id}:${view.n}:${view.text}`);
  }

  // ---------- Pregunta a la IA

  function enterAsk() {
    st.mode = "ask";
    st.askFocus = true;
    els.input.value = "";
    update();
  }

  function leaveAsk() {
    st.mode = st.ai ? "ai" : "auto";
    update();
  }

  function showAsk() {
    open("step");
    els.fab.hidden = true;
    els.pill.hidden = true;
    els.card.hidden = false;
    els.card.dataset.kind = "step";
    ui({ end: true, form: true });
    els.list.hidden = true;
    els.bar.hidden = true;
    els.counter.hidden = true;
    els.sub.hidden = true;
    setText(els.title, "💬 Pregunta");
    setTarget(null);
    if (st.askFocus) {
      st.askFocus = false;
      setTimeout(() => els.input.focus(), 0);
    }
  }

  // Pasos que envían, borran, pagan o publican: se avisa aunque la IA no lo marque.
  const RISKY = /(enviar|send|guardar|pagar|comprar|borrar|eliminar|publicar|confirmar|submit|pedir ahora)/i;
  const looksRisky = (el) => Boolean(el) && RISKY.test(accessibleName(el).slice(0, 60)) && !/borrador|draft|cancel/i.test(accessibleName(el));

  function newAi(goal, history = []) {
    return { goal, history, seq: 0, thinking: true, step: null, el: null, target: null, error: "", completing: false, cleanup: null, url: location.href, doneTimer: 0, moved: false };
  }

  function dropAi() {
    st.ai?.cleanup?.();
    clearTimeout(st.ai?.doneTimer);
    st.ai = null;
  }

  function startAi(goal) {
    dropAi();
    st.ai = newAi(goal);
    st.mode = "ai";
    send({ type: "PP_START", session: { goal } });
    requestNext();
  }

  function endAi() {
    dropAi();
    st.mode = "auto";
    send({ type: "PP_END" });
    update();
  }

  function send(message) {
    try {
      return chrome.runtime.sendMessage(message).catch((e) => {
        st.sendError = String(e?.message || e);
        return null;
      });
    } catch (e) {
      st.sendError = String(e?.message || e); // la extensión se ha recargado: esta página ya no puede hablar con ella
      return Promise.resolve(null);
    }
  }

  // `current`: el paso que se está haciendo. Si abre otra pestaña, allí se da por hecho.
  const saveSession = (history = st.ai?.history) => {
    const ai = st.ai;
    if (!ai) return;
    const current = ai.step && !ai.step.done && !ai.step.stuck && !ai.stepDone && history === ai.history ? ai.step.text : "";
    send({ type: "PP_SESSION", session: { goal: ai.goal, history, current } });
  };

  // Espera a que la página termine de cambiar (después de pulsar algo) antes de volver a mirarla.
  function settle(maxMs = 1800, quietMs = 450) {
    const start = Date.now();
    st.lastMutation = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const now = Date.now();
        if (now - st.lastMutation >= quietMs || now - start >= maxMs) resolve();
        else setTimeout(tick, 100);
      };
      setTimeout(tick, quietMs);
    });
  }

  // `fresh`: la persona ha pedido probar otra vez, así que no vale la respuesta guardada.
  async function requestNext(fresh = false) {
    const ai = st.ai;
    if (!ai || ai.moved) return;
    const seq = ++ai.seq;
    ai.cleanup?.();
    Object.assign(ai, { cleanup: null, thinking: true, step: null, el: null, target: null, error: "", errorDetail: "", reload: false, completing: false, missing: false, stepDone: false });
    update();

    const snap = window.PP_snapshot(ai.goal);
    const snapUrl = location.href;
    st.sendError = "";
    const res = await send({ type: "PP_NEXT", payload: { goal: ai.goal, history: ai.history, page: snap.page, elements: snap.lines }, fresh });
    if (st.ai !== ai || ai.seq !== seq || ai.moved) return; // se ha cancelado, hay una petición más nueva o la guía está en otra pestaña

    if (res?.moved) return pause();
    // La página cambió de dirección mientras la IA pensaba: lo que vio ya no vale, se mira otra vez.
    if (location.href !== snapUrl && (ai.urlRetries = (ai.urlRetries || 0) + 1) <= 2) {
      await settle();
      return st.ai === ai && ai.seq === seq && requestNext();
    }
    ai.urlRetries = 0;
    ai.thinking = false;
    ai.url = location.href;
    if (!res) {
      // La página no ha podido hablar con la extensión. Lo más típico: se recargó la extensión y esta página es una copia vieja.
      const stale = !safe(() => chrome.runtime.id, "") || /context invalidated/i.test(st.sendError);
      ai.reload = stale;
      ai.error = stale ? "La extensión se ha actualizado. Recarga la página." : "La extensión no responde.";
      ai.errorDetail = stale ? "" : st.sendError.slice(0, 140);
    } else if (res.error || !res.step) {
      ai.error = res.error || "No he podido pensar. Inténtalo otra vez.";
    } else {
      ai.step = res.step;
      ai.el = res.step.targetId ? snap.map.get(res.step.targetId) || null : null;
      ai.target = ai.el ? snap.meta.get(res.step.targetId) : null;
      ai.missing = Boolean(res.step.targetId) && !ai.el; // la IA nombró un elemento que no existe: no se marca nada
      if (res.step.action === "click" && looksRisky(ai.el)) res.step.irreversible = true;
      if (res.step.done) {
        send({ type: "PP_END" });
        ai.doneTimer = setTimeout(endAi, 5000);
      } else {
        saveSession();
        armStep();
      }
    }
    update();
  }

  const hasText = (el) => Boolean(((el.value ?? el.textContent) || "").trim());
  const multiline = (el) => el.tagName === "TEXTAREA" || el.isContentEditable;

  // El paso se da por hecho cuando la persona usa el elemento marcado.
  // Pulsar, elegir o pulsar Enter al escribir pasan solos al siguiente paso.
  // Mientras se escribe solo se avisa de que está hecho: se pasa con Enter, al salir del campo o con «Siguiente Paso».
  function armStep() {
    const ai = st.ai;
    const { step, el } = ai;
    if (!step || step.done || !el) return;
    const off = [];
    const on = (target, type, handler, capture) => {
      target.addEventListener(type, handler, capture);
      off.push(() => target.removeEventListener(type, handler, capture));
    };
    const inside = (event) => event.composedPath().includes(el);
    const later = (fn, ms) => {
      const timer = setTimeout(fn, ms);
      off.push(() => clearTimeout(timer));
    };
    const nativeSelect = el.tagName === "SELECT";
    if (step.action === "click" || (step.action === "select" && !nativeSelect)) {
      // Las listas hechas a mano (no <select>) no avisan al elegir: basta con abrirlas.
      on(document, "click", (event) => inside(event) && markDone(true), true);
      on(document, "auxclick", (event) => inside(event) && markDone(), true); // botón central: abre en otra pestaña
    } else if (step.action === "select") {
      on(el, "change", () => markDone(true));
    } else if (step.action === "type") {
      let timer = 0;
      on(el, "input", () => {
        clearTimeout(timer);
        if (!hasText(el)) return unmarkDone(); // vaciado: ya no está hecho
        timer = setTimeout(markDone, 1500);
      });
      off.push(() => clearTimeout(timer));
      // Enter: en un campo de una línea es «ya está» (buscar, enviar…). En un texto largo es un salto de línea,
      // salvo que el campo se vacíe o desaparezca (un chat que envía con Enter).
      on(
        window,
        "keydown",
        (event) => {
          if (event.key !== "Enter" || event.shiftKey || event.isComposing || !inside(event) || !hasText(el)) return;
          if (!multiline(el)) return markDone(true);
          later(() => (!el.isConnected || !hasText(el)) && markDone(true), 400);
        },
        true,
      );
      on(document, "submit", (event) => event.target.contains?.(el) && markDone(true), true);
      // Salir del campo con texto (por ejemplo, pulsando el siguiente campo) también lo da por hecho.
      on(el, "focusout", () =>
        later(() => document.hasFocus() && !el.contains(document.activeElement) && el.isConnected && hasText(el) && markDone(true), 0),
      );
    }
    ai.cleanup = () => off.forEach((fn) => fn());
  }

  function markDone(advance = false) {
    const ai = st.ai;
    if (!ai || !ai.step || ai.completing || ai.moved) return;
    if (!ai.stepDone) {
      ai.stepDone = true;
      // Si la página cambia (o se abre otra pestaña), la guía sigue allí sabiendo que este paso se hizo.
      saveSession([...ai.history, { text: ai.step.text }].slice(-8));
    }
    if (advance) complete();
    else update();
  }

  function unmarkDone() {
    const ai = st.ai;
    if (!ai || !ai.stepDone || ai.completing) return;
    ai.stepDone = false;
    saveSession();
    update();
  }

  function complete() {
    const ai = st.ai;
    if (!ai || ai.completing || !ai.step || ai.moved) return;
    ai.completing = true;
    ai.cleanup?.();
    ai.history = [...ai.history, { text: ai.step.text }].slice(-8);
    Object.assign(ai, { thinking: true, step: null, el: null, target: null, stepDone: false });
    saveSession();
    update();
    settle().then(() => st.ai === ai && !ai.moved && requestNext());
  }

  // Comprobaciones en cada cambio de la página mientras hay un paso en pantalla.
  function watchAi() {
    const ai = st.ai;
    if (!ai || ai.thinking || ai.moved || ai.completing || ai.error || !ai.step || ai.step.done) return;

    // La página ha cambiado de dirección (webs que no recargan, como Gmail): el paso se ha hecho.
    if (location.href !== ai.url) {
      ai.url = location.href;
      const typing = ai.step.action === "type" && ai.el?.contains(document.activeElement); // hay webs que cambian la dirección al escribir
      if (ai.step.stuck || ai.missing) return requestNext();
      if (!typing) return complete();
    }

    // La página ha cambiado el elemento marcado por otro igual (pasa mucho en Gmail, React…): se busca de nuevo.
    if (ai.el && !ai.el.isConnected && ai.target && Date.now() - (ai.relocatedAt || 0) > 400) {
      ai.relocatedAt = Date.now();
      const snap = window.PP_snapshot(`${ai.goal} ${ai.target.name}`);
      const id = [...snap.meta].find(([, m]) => m.kind === ai.target.kind && m.name === ai.target.name)?.[0];
      if (id) {
        ai.cleanup?.();
        ai.el = snap.map.get(id);
        armStep();
      }
    }
  }

  // La guía se ha ido a otra pestaña (un paso la abrió): esta se queda en espera.
  function pause() {
    const ai = st.ai;
    if (!ai) return;
    ai.cleanup?.();
    clearTimeout(ai.doneTimer);
    ai.seq++; // lo que estuviera pidiendo ya no vale
    Object.assign(ai, { moved: true, thinking: false, completing: false, step: null, el: null, target: null, error: "", stepDone: false, cleanup: null });
    st.mode = "ai";
    update();
  }

  function onNext() {
    const ai = st.ai;
    if (!ai) return;
    if (ai.moved) send({ type: "PP_TAKEOVER" }).then(resume);
    else if (ai.reload) location.reload();
    else if (ai.error || ai.step?.stuck || ai.missing) requestNext(true);
    else complete();
  }

  function showAi() {
    const ai = st.ai;
    let kind = "step";
    let text = "Pensando…";
    let sub = "";
    let nextLabel = "";
    if (ai.moved) {
      text = "Sigue en la otra pestaña";
      sub = "Si quieres seguir en esta, pulsa «Seguir aquí».";
      nextLabel = "Seguir aquí";
    } else if (ai.thinking) {
      // esperando a la IA
    } else if (ai.error) {
      kind = "warn";
      text = ai.error;
      sub = ai.errorDetail || "";
      nextLabel = ai.reload ? "Recargar página" : "Reintentar";
    } else if (ai.step?.done) {
      kind = "ok";
      text = `✔ ${ai.step.text}`;
    } else if (ai.step) {
      const s = ai.step;
      kind = s.irreversible || s.stuck ? "warn" : "step";
      text = s.text;
      sub = s.note || (s.irreversible ? "Revisa antes" : "") || (ai.missing ? "No lo veo en pantalla" : "");
      nextLabel = s.stuck || ai.missing ? "Probar otra vez" : "Siguiente Paso →";
      if (ai.stepDone) sub = "✔ Hecho. Pulsa «Siguiente Paso →»";
    }

    open(kind);
    els.fab.hidden = true;
    els.pill.hidden = true;
    els.card.hidden = false;
    els.card.dataset.kind = kind;
    ui({ end: true, actions: Boolean(nextLabel) });
    setText(els.title, `💬 ${ai.goal}`);
    // Pasos ya hechos (tachados), el actual resaltado. Los siguientes no se conocen: la IA da uno cada vez.
    const finished = Boolean(ai.step?.done);
    render({
      kind,
      sub,
      done: finished,
      counter: finished || ai.moved ? "" : `Paso ${ai.history.length + 1}`,
      progress: null,
      items: [
        ...ai.history.slice(-3).map((h) => ({ text: h.text, state: "done" })),
        { text, state: finished || ai.stepDone ? "ok" : "cur", speak: !ai.thinking },
      ],
    });
    setText(els.next, nextLabel);

    setTarget(ai.thinking || ai.error || ai.moved ? null : ai.el);
    scrollToOnce(st.targetEl, `ai:${ai.seq}`);
  }

  // Al cargar la página (o cuando la guía llega a esta pestaña) se sigue donde se iba.
  function resume() {
    st.resuming ||= (async () => {
      const session = await send({ type: "PP_RESUME" });
      if (!session?.goal) return;
      if (st.ai && !st.ai.moved && !session.paused) return; // ya se está guiando aquí
      dropAi();
      st.ai = newAi(session.goal, session.history || []);
      st.mode = "ai";
      if (session.paused) return pause();
      update();
      await settle(2500, 600);
      if (st.mode === "ai" && st.ai && !st.ai.moved) requestNext();
    })().finally(() => (st.resuming = null));
    return st.resuming;
  }

  // Avisos del service worker sobre las pestañas.
  function onMessage(message) {
    if (message?.type === "PP_MOVED") pause();
    else if (message?.type === "PP_OWNER") resume();
    else if (message?.type === "PP_STOP" && st.ai) {
      dropAi();
      st.mode = "auto";
      update();
    }
  }

  function update() {
    st.queued = 0;
    if (st.mode === "ask") return showAsk();
    if (st.mode === "ai" && st.ai) {
      watchAi();
      return st.ai && showAi();
    }
    autoUpdate();
  }

  const queue = () => {
    if (!st.queued) st.queued = setTimeout(update, 60);
  };

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

    const shownBox = !els.card.hidden ? els.card : !els.pill.hidden ? els.pill : !els.fab.hidden ? els.fab : null;
    if (!shownBox) return;
    if (st.pos) return placeManual(shownBox); // colocado a mano: no se aparta solo
    const w = shownBox.offsetWidth;
    const h2 = shownBox.offsetHeight;
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    const at = (corner) => {
      const left = corner[1] === "l" ? MARGIN : cw - MARGIN - w;
      const top = corner[0] === "t" ? MARGIN : ch - MARGIN - h2;
      return { left, top, right: left + w, bottom: top + h2 };
    };
    const covers = (b) => rect && b.left < rect.right + 12 && b.right > rect.left - 12 && b.top < rect.bottom + 12 && b.bottom > rect.top - 12;
    if (covers(at(st.corner))) {
      const free = CORNERS.find((corner) => !covers(at(corner)));
      if (free) st.corner = free;
    }
    if (els.card.dataset.pos !== st.corner) els.card.dataset.pos = els.pill.dataset.pos = els.fab.dataset.pos = st.corner;
  }

  // ---------- Arranque y parada

  const observer = new MutationObserver(() => {
    st.lastMutation = Date.now();
    queue();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "disabled"],
  });
  for (const type of EVENTS) window.addEventListener(type, queue, true);
  const tick = setInterval(queue, 1000); // por si algo cambia sin avisar (valores puestos por código, rutas…)
  safe(() => chrome.runtime.onMessage.addListener(onMessage));

  window.__pasoapasoStop = () => {
    clearTimeout(st.queued);
    clearTimeout(st.finishTimer);
    clearInterval(tick);
    cancelAnimationFrame(st.raf);
    observer.disconnect();
    for (const type of EVENTS) window.removeEventListener(type, queue, true);
    safe(() => chrome.runtime.onMessage.removeListener(onMessage));
    dropAi();
    host?.remove();
    delete window.__pasoapasoStop;
  };

  update();
  loop();
  resume();
})();
