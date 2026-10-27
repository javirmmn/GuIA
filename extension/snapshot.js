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

  const redact = (text, max = 50) =>
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
      .map((h) => redact(h.textContent, 50))
      .filter(Boolean)
      .slice(0, 4);
    const dialogs = deepQueryAll(document, '[role="dialog"], [role="alertdialog"], dialog[open]')
      .filter(visibleBox)
      .map((d) => redact(d.getAttribute("aria-label") || d.querySelector('h1, h2, h3, [role="heading"]')?.textContent || "ventana", 60))
      .slice(0, 4);
    const alerts = deepQueryAll(document, `[role="alert"], [role="status"], [aria-live="assertive"]`)
      .filter(visibleBox)
      .map((a) => redact(a.textContent, 80))
      .filter(Boolean)
      .slice(0, 4);
    return { title: redact(document.title, 60), host: location.hostname, path: location.pathname, headings, dialogs, alerts };
  }

  // ---------- Ahorro de tokens: solo se envía lo que más probablemente hace falta para el siguiente paso.

  const MAX_ITEMS = 70; // elementos como mucho
  const MAX_CHARS = 3200; // y como mucho estos caracteres de lista (≈ 900 tokens)
  const SAME_NAME = 2; // elementos repetidos con el mismo nombre (p. ej. «Responder» en cada fila): solo los primeros

  const STOP = new Set("para con por los las del una uno que mis tus sus esta este".split(" "));
  const words = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.slice(0, 5)); // raíz aproximada: «correo» y «correos» cuentan igual

  // Si hay una ventana modal abierta, solo vale lo que hay dentro: lo de detrás no se puede pulsar.
  function modalRoot() {
    const modals = deepQueryAll(document, 'dialog[open], [aria-modal="true"]').filter((d) => {
      if (!visibleBox(d)) return false;
      return d.tagName !== "DIALOG" || d.matches(":modal");
    });
    return modals.at(-1) || null;
  }

  // Cuánto interesa un elemento: dentro de la pantalla, campos y botones, y lo que se parece al objetivo.
  function score(item, goalWords) {
    const link = item.kind === "enlace";
    const related = goalWords.size > 0 && words(item.name).some((w) => goalWords.has(w));
    let points = item.onScreen ? 4 : 1;
    if (!link) points += 2;
    if (related) points += 3;
    if (item.kind === "campo de texto" || item.kind === "lista") points += 1;
    return points;
  }

  // Línea compacta: «e12 botón "Redactar" (obligatorio, vacío)».
  function lineOf(id, item) {
    const flags = flagsOf(item.el, item.kind);
    if (!item.onScreen) flags.push("fuera");
    return `${id} ${item.kind}${item.name ? ` "${item.name}"` : ""}${flags.length ? ` (${flags.join(", ")})` : ""}`;
  }

  // Devuelve { map: id → elemento, meta: id → { kind, name }, lines: ["e1 botón \"Redactar\"", …], page }
  // `hint`: texto del objetivo y los pasos hechos, para dar prioridad a lo relacionado.
  window.PP_snapshot = function snapshot(hint = "") {
    const root = modalRoot();
    const vh = innerHeight || Infinity; // sin tamaño de ventana (pestaña oculta) se da todo por visible
    const vw = innerWidth || Infinity;
    const all = [];
    const seen = new Map();
    for (const el of deepQueryAll(root || document, SELECTOR)) {
      if (el.closest?.("#pasoapaso-overlay")) continue;
      const box = visibleBox(el);
      if (!box) continue;
      const kind = kindOf(el);
      const name = nameOf(el);
      if (!name && kind !== "campo de texto" && kind !== "subir archivo") continue;
      const onScreen = box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw;
      if (!onScreen && kind === "enlace" && all.length > MAX_ITEMS) continue; // enlaces lejos en páginas grandes: no
      if (name) {
        const key = `${kind}|${name}`;
        const count = (seen.get(key) || 0) + 1;
        seen.set(key, count);
        if (count > SAME_NAME) continue;
      }
      all.push({ el, kind, name, onScreen, order: all.length });
    }

    // Se eligen los que más interesan hasta llenar el presupuesto y se devuelven en el orden de la página.
    const goalWords = new Set(words(hint));
    const ranked = all.map((item) => ({ ...item, points: score(item, goalWords) })).sort((a, b) => b.points - a.points || a.order - b.order);
    const chosen = [];
    let chars = 0;
    for (const item of ranked) {
      if (chosen.length >= MAX_ITEMS) break;
      const size = item.name.length + 30;
      if (chars + size > MAX_CHARS) continue;
      chars += size;
      chosen.push(item);
    }
    chosen.sort((a, b) => a.order - b.order);

    const map = new Map();
    const meta = new Map(); // para volver a encontrar el elemento si la página lo cambia por otro igual
    const lines = chosen.map((item, i) => {
      const id = `e${i + 1}`;
      map.set(id, item.el);
      meta.set(id, { kind: item.kind, name: item.name });
      return lineOf(id, item);
    });
    const page = pageInfo();
    if (root) page.dialogs = [redact(root.getAttribute("aria-label") || root.querySelector("h1, h2, h3")?.textContent || "ventana", 50) + " (solo se ve esta ventana)"];
    if (all.length > chosen.length) page.omitted = all.length - chosen.length;
    return { map, meta, lines, page };
  };
})();
