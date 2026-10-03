// PasoAPaso: lee la página actual y hace una lista corta de lo que se puede usar.
// Solo envía nombres de botones, enlaces y campos. NUNCA el contenido de los campos
// (solo si están vacíos) ni contraseñas. Los correos y los números largos se tapan.
(() => {
  const SELECTOR = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "textarea",
    "select",
    "summary",
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="combobox"]',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    "[data-tooltip]",
  ].join(",");

  const MAX_IN_VIEW = 120;
  const MAX_OFFSCREEN = 40;

  const redact = (text, max = 70) =>
    String(text || "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]")
      .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/g, "[cuenta]")
      .replace(/\b(?:\d[ -]?){6,}\b/g, "[número]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);

  function deepQueryAll(root, selector, out = []) {
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot && el.id !== "pasoapaso-overlay") deepQueryAll(el.shadowRoot, selector, out);
    }
    return out;
  }

  function visibleBox(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return null;
    return r;
  }

  function nameOf(el) {
    let name = el.getAttribute("aria-label") || el.getAttribute("data-tooltip") || "";
    const labelledBy = el.getAttribute("aria-labelledby");
    if (!name && labelledBy) {
      name = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ");
    }
    if (!name && el.labels?.length) name = el.labels[0].textContent;
    if (!name) name = el.getAttribute("title") || el.getAttribute("placeholder") || "";
    if (!name && el.tagName === "INPUT" && ["button", "submit", "reset"].includes(el.type)) name = el.value;
    if (!name) name = (el.innerText || el.textContent || "").slice(0, 200);
    if (!name) name = el.querySelector("img[alt]")?.alt || "";
    return redact(name);
  }

  function kindOf(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    if (tag === "input") {
      const t = el.type;
      if (["button", "submit", "reset", "image"].includes(t)) return "botón";
      if (t === "checkbox") return "casilla";
      if (t === "radio") return "opción";
      if (t === "password") return "campo de contraseña";
      if (t === "file") return "subir archivo";
      return "campo de texto";
    }
    if (tag === "a" || role === "link") return "enlace";
    if (tag === "button" || role === "button") return "botón";
    if (tag === "select" || role === "combobox" || role === "listbox") return "lista";
    if (tag === "textarea" || role === "textbox" || role === "searchbox" || el.isContentEditable) return "campo de texto";
    if (role === "tab") return "pestaña";
    if (role?.startsWith("menuitem")) return "menú";
    if (role === "checkbox" || role === "switch") return "casilla";
    if (role === "radio" || role === "option") return "opción";
    return "elemento";
  }

  // ¿Es obligatorio? Atributo, aria-required o un asterisco en la etiqueta (también si lo pone el CSS).
  function isRequired(el) {
    if (el.required || el.getAttribute("aria-required") === "true") return true;
    const label = el.labels?.[0];
    if (!label) return false;
    return label.textContent.includes("*") || getComputedStyle(label, "::after").content.includes("*");
  }

  function flagsOf(el, kind) {
    const flags = [];
    if (isRequired(el)) flags.push("obligatorio");
    if (el.disabled || el.getAttribute("aria-disabled") === "true") flags.push("desactivado");
    if (kind === "campo de texto") {
      const filled = (el.value ?? "").toString().trim() || (el.isContentEditable && el.textContent.trim());
      flags.push(filled ? "con texto" : "vacío");
    }
    if (el.tagName === "SELECT") flags.push(el.value ? "ya elegida" : "sin elegir");
    if (el.checked || el.getAttribute("aria-checked") === "true") flags.push("marcada");
    return flags;
  }

  function pageInfo() {
    const headings = deepQueryAll(document, 'h1, h2, h3, [role="heading"]')
      .filter(visibleBox)
      .map((h) => redact(h.textContent, 60))
      .filter(Boolean)
      .slice(0, 6);
    const dialogs = deepQueryAll(document, '[role="dialog"], [role="alertdialog"], dialog[open]')
      .filter(visibleBox)
      .map((d) => redact(d.getAttribute("aria-label") || d.querySelector('h1, h2, h3, [role="heading"]')?.textContent || "ventana", 60))
      .slice(0, 4);
    const alerts = deepQueryAll(document, `[role="alert"], [role="status"], [aria-live="assertive"]`)
      .filter(visibleBox)
      .map((a) => redact(a.textContent, 100))
      .filter(Boolean)
      .slice(0, 4);
    return { title: redact(document.title, 80), host: location.hostname, path: location.pathname, headings, dialogs, alerts };
  }

  // Devuelve { map: id → elemento, lines: ["[e1] botón \"Redactar\"", …], page }
  window.PP_snapshot = function snapshot() {
    const inView = [];
    const offscreen = [];
    for (const el of deepQueryAll(document, SELECTOR)) {
      if (el.closest?.("#pasoapaso-overlay")) continue;
      const box = visibleBox(el);
      if (!box) continue;
      const kind = kindOf(el);
      const name = nameOf(el);
      if (!name && kind !== "campo de texto" && kind !== "subir archivo") continue;
      const vh = innerHeight || Infinity; // sin tamaño de ventana (pestaña oculta) se da todo por visible
      const vw = innerWidth || Infinity;
      const onScreen = box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw;
      (onScreen ? inView : offscreen).push({ el, kind, name, onScreen });
    }

    const map = new Map();
    const lines = [];
    let n = 0;
    // Si hay demasiados elementos, se prefieren campos y botones a enlaces; el orden de la página se conserva.
    const pick = (list, max) => {
      if (list.length <= max) return list;
      const controls = list.filter((i) => i.kind !== "enlace");
      const links = list.filter((i) => i.kind === "enlace").slice(0, Math.max(0, max - controls.length));
      return list.filter((i) => controls.includes(i) || links.includes(i)).slice(0, max);
    };
    for (const item of [...pick(inView, MAX_IN_VIEW), ...pick(offscreen, MAX_OFFSCREEN)]) {
      const id = `e${++n}`;
      map.set(id, item.el);
      const flags = flagsOf(item.el, item.kind);
      if (!item.onScreen) flags.push("fuera de pantalla");
      lines.push(`[${id}] ${item.kind}${item.name ? ` "${item.name}"` : ""}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    }
    return { map, lines, page: pageInfo() };
  };
})();
