// PasoAPaso: script que se ejecuta dentro de la página web.
// - Busca el elemento del paso actual (sin modificar la página).
// - Lo resalta: oscurece el resto, dibuja un borde y un bocadillo con el texto.
// - Detecta cuándo el paso está hecho y avisa al panel lateral.
// - Avisa al panel cuando la página muestra un mensaje de error (role="alert").
(() => {
  // Evita cargarse dos veces (por ejemplo, si el panel lo inyecta a mano).
  const previous = window.__pasoapaso;
  if (previous && previous.isAlive()) return;
  document.getElementById("pasoapaso-overlay")?.remove();
  window.__pasoapaso = {
    isAlive: () => {
      try {
        return Boolean(chrome.runtime?.id);
      } catch {
        return false;
      }
    },
  };

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INTERACTIVE =
    'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"]';
  const OVERLAY_CSS = `
    .spot {
      position: fixed; box-sizing: border-box;
      border: 4px solid #ffb000; border-radius: 10px;
      box-shadow: 0 0 0 3px #1b1b1b, 0 0 0 100vmax rgba(15, 23, 42, 0.42);
      transition: left .2s, top .2s, width .2s, height .2s;
    }
    .spot::after {
      content: ""; position: absolute; inset: -10px;
      border: 3px solid #ffb000; border-radius: 14px;
      animation: pp-ring 1.6s ease-out infinite;
    }
    @keyframes pp-ring { from { opacity: .9; transform: scale(.97); } to { opacity: 0; transform: scale(1.06); } }
    .bubble {
      position: fixed; box-sizing: border-box; width: max-content; max-width: min(340px, calc(100vw - 16px));
      display: flex; gap: 10px; align-items: flex-start;
      background: #fff; color: #111; border: 3px solid #ffb000; border-radius: 12px;
      padding: 12px 14px; box-shadow: 0 8px 28px rgba(0, 0, 0, .28);
      font: 600 18px/1.4 "Segoe UI", system-ui, sans-serif;
    }
    .num {
      flex: none; display: grid; place-items: center; min-width: 30px; height: 30px;
      border-radius: 999px; background: #1b1b1b; color: #fff; font-size: 16px;
    }
    .arrow { position: absolute; width: 0; height: 0; border: 11px solid transparent; left: var(--ax, 20px); }
    .bubble.below .arrow { top: -22px; border-bottom-color: #ffb000; }
    .bubble.above .arrow { bottom: -22px; border-top-color: #ffb000; }
    .spot.warn, .spot.warn::after, .bubble.warn { border-color: #d93025; }
    .bubble.warn.below .arrow { border-bottom-color: #d93025; }
    .bubble.warn.above .arrow { border-top-color: #d93025; }
    @media (prefers-reduced-motion: reduce) {
      .spot { transition: none; }
      .spot::after { animation: none; opacity: 0; }
    }
  `;

  let current = null; // { runId, step, text, el }
  let showToken = 0;
  let rafId = 0;
  let cleanups = [];
  let host = null;
  let spot = null;
  let bubble = null;
  let bubbleNum = null;
  let bubbleText = null;
  let lastAlert = "";

  // ---------- Utilidades

  const norm = (s) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  function send(message) {
    try {
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      // La extensión se ha recargado: este script ya no puede hablar con ella.
    }
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  }

  function accessibleName(el) {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ");
      if (text.trim()) return text;
    }
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

  function shortName(el) {
    return el ? accessibleName(el).replace(/\s+/g, " ").trim().replace(/[*:]\s*$/, "") : "";
  }

  // Primero por selector; si no está, por el texto visible o accesible del elemento.
  function findTarget(target = {}) {
    if (target.selector) {
      const el = document.querySelector(target.selector);
      if (isVisible(el)) return el;
    }
    if (target.text) {
      const wanted = norm(target.text);
      for (const el of document.querySelectorAll(INTERACTIVE)) {
        if (isVisible(el) && norm(accessibleName(el)).includes(wanted)) return el;
      }
    }
    return null;
  }

  function waitForTarget(target, timeoutMs, token) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (token !== showToken) return resolve(null);
        const el = findTarget(target);
        if (el) return resolve(el);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  }

  // ---------- Resaltado (dentro de un Shadow DOM para no mezclarse con los estilos de la página)

  function ensureOverlay() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.id = "pasoapaso-overlay";
    host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${OVERLAY_CSS}</style>
      <div class="spot"></div>
      <div class="bubble"><span class="num"></span><span class="txt"></span><span class="arrow"></span></div>`;
    spot = root.querySelector(".spot");
    bubble = root.querySelector(".bubble");
    bubbleNum = root.querySelector(".num");
    bubbleText = root.querySelector(".txt");
    document.documentElement.append(host);
  }

  function setVisible(visible) {
    if (!host) return;
    const value = visible ? "block" : "none";
    if (host.style.display !== value) host.style.display = value;
  }

  function place() {
    rafId = requestAnimationFrame(place);
    if (!current || !spot) return;
    let el = current.el;
    if (!el || !el.isConnected) {
      el = findTarget(current.step.target);
      if (!el) return setVisible(false);
      current.el = el;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    const gap = 18;
    Object.assign(spot.style, {
      left: `${Math.round(r.left - pad)}px`,
      top: `${Math.round(r.top - pad)}px`,
      width: `${Math.round(r.width + pad * 2)}px`,
      height: `${Math.round(r.height + pad * 2)}px`,
    });

    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    let top;
    let below = true;
    if (r.bottom + pad + gap + bh <= innerHeight - 8) {
      top = r.bottom + pad + gap;
    } else if (r.top - pad - gap - bh >= 8) {
      top = r.top - pad - gap - bh;
      below = false;
    } else {
      top = Math.min(innerHeight - bh - 8, Math.max(8, r.bottom + pad + gap));
    }
    const left = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), innerWidth - bw - 8);
    bubble.style.top = `${Math.round(top)}px`;
    bubble.style.left = `${Math.round(left)}px`;
    bubble.classList.toggle("below", below);
    bubble.classList.toggle("above", !below);
    const arrowX = Math.min(Math.max(r.left + r.width / 2 - left - 11, 12), bw - 34);
    bubble.style.setProperty("--ax", `${Math.round(arrowX)}px`);
    setVisible(true);
  }

  function clear() {
    showToken++;
    cancelAnimationFrame(rafId);
    rafId = 0;
    for (const fn of cleanups) fn();
    cleanups = [];
    current = null;
    setVisible(false);
  }

  // ---------- Pasos

  async function showStep({ runId, step, text }) {
    clear();
    const token = showToken;
    current = { runId, step, text, el: null };
    const el = await waitForTarget(step.target, 4000, token);
    if (token !== showToken) return;
    if (!el) {
      send({ type: "PP_TARGET_NOT_FOUND", runId });
      return;
    }
    current.el = el;
    ensureOverlay();
    bubbleNum.textContent = String(step.n);
    bubbleText.textContent = text;
    spot.classList.toggle("warn", Boolean(step.irreversible));
    bubble.classList.toggle("warn", Boolean(step.irreversible));
    if (!inViewport(el)) {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: REDUCED_MOTION ? "auto" : "smooth" });
    }
    place();
    watchCompletion(step, runId);
  }

  function completed(runId) {
    if (!current || current.runId !== runId) return;
    clear();
    send({ type: "PP_STEP_DONE", runId });
  }

  // ¿Está hecho el paso? Se usa al cambiar un campo y cuando la persona pulsa «Ya lo hice».
  function evaluate(step) {
    const done = step.done || {};
    const el = current?.el || findTarget(step.target);
    const name = shortName(el);
    switch (done.type) {
      case "filled": {
        const value = (el?.value || "").trim();
        if (!value) return { ok: false, hint: `Todavía no has escrito nada en «${name}».` };
        if (value.length < (done.minLength || 1)) return { ok: false, hint: `Parece que falta algo en «${name}».` };
        if (done.pattern && !new RegExp(done.pattern, "i").test(value.replace(/[\s.-]/g, ""))) {
          return { ok: false, hint: done.patternHint || `Revisa lo que has escrito en «${name}».` };
        }
        return { ok: true };
      }
      case "selected": {
        if (!el || !el.value) return { ok: false, hint: `Todavía no has elegido nada en «${name}».` };
        const chosen = el.selectedOptions?.[0]?.textContent?.trim() || el.value;
        if (done.expect && !norm(chosen).includes(norm(done.expect))) {
          return { ok: false, hint: `Has elegido «${chosen}». Tienes que elegir «${done.expect}».` };
        }
        return { ok: true };
      }
      case "visible":
        return isVisible(document.querySelector(done.selector))
          ? { ok: true }
          : { ok: false, hint: done.notYetHint || "Todavía no está hecho." };
      case "url":
        return location.href.includes(done.includes)
          ? { ok: true }
          : { ok: false, hint: done.notYetHint || "Todavía no está hecho." };
      default:
        return { ok: true };
    }
  }

  function watchCompletion(step, runId) {
    const done = step.done || { type: "manual" };
    const on = (target, type, handler, capture = false) => {
      target.addEventListener(type, handler, capture);
      cleanups.push(() => target.removeEventListener(type, handler, capture));
    };

    switch (done.type) {
      case "click":
        // Fase de captura: se detecta aunque la página navegue justo después.
        on(
          document,
          "click",
          (event) => {
            const el = current?.el;
            if (el && (el === event.target || el.contains(event.target))) completed(runId);
          },
          true,
        );
        break;
      case "filled":
      case "selected":
        on(current.el, "change", () => {
          const result = evaluate(step);
          if (result.ok) completed(runId);
          else send({ type: "PP_HINT", runId, text: result.hint });
        });
        break;
      case "visible": {
        const timer = setInterval(() => {
          if (isVisible(document.querySelector(done.selector))) completed(runId);
        }, 300);
        cleanups.push(() => clearInterval(timer));
        break;
      }
      // "url": lo comprueba el panel cuando carga la página nueva.
      // "manual": se espera a que la persona pulse «Ya lo hice».
    }
  }

  // ---------- Mensajes de error de la página

  function scanAlerts() {
    const text = [...document.querySelectorAll('[role="alert"]')]
      .filter(isVisible)
      .map((el) => el.innerText.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    if (text && text !== lastAlert) send({ type: "PP_PAGE_ALERT", text });
    lastAlert = text;
  }

  let alertTimer = 0;
  new MutationObserver(() => {
    clearTimeout(alertTimer);
    alertTimer = setTimeout(scanAlerts, 250);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });

  // ---------- Comunicación con el panel

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string" || !message.type.startsWith("PP_")) return;
    switch (message.type) {
      case "PP_PING":
        sendResponse({ ok: true });
        break;
      case "PP_SHOW_STEP":
        showStep(message);
        sendResponse({ ok: true });
        break;
      case "PP_CLEAR":
        clear();
        sendResponse({ ok: true });
        break;
      case "PP_CHECK":
        sendResponse(current && current.runId === message.runId ? evaluate(current.step) : { ok: true });
        break;
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) send({ type: "PP_PAGE_READY", url: location.href });
  });

  send({ type: "PP_PAGE_READY", url: location.href });
  scanAlerts();
})();
