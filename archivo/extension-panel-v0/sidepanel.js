// PasoAPaso: lógica del panel lateral.
// Guarda en qué tarea y paso está la persona, habla con content.js (la página) y lee en voz alta.
import { TASKS } from "./tasks.js";

const DEFAULT_SETTINGS = {
  textSize: "normal",
  highContrast: false,
  voice: true,
  rate: 1,
  helperName: "Marta",
  helperEmail: "",
  demoUrl: "http://127.0.0.1:8080/",
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  task: null,
  index: 0,
  tabId: null,
  runId: 0, // cambia en cada paso mostrado; descarta mensajes antiguos de la página
  simpler: false,
  confirmed: false,
  direction: "forward",
  returnTo: null, // tras corregir un error, volver al paso donde estaba la persona
  expectNavUntil: 0, // mientras carga una página nueva, no se dice «estás en otra página»
  lastSpoken: "",
  voiceName: undefined,
  voiceLang: "es-ES",
  viewBeforeSettings: "home",
};

const $ = (id) => document.getElementById(id);
const currentStep = () => state.task?.steps[state.index];
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

let showTimer = 0;
function scheduleShow(delay = 250) {
  clearTimeout(showTimer);
  showTimer = setTimeout(showStep, delay);
}

init().catch((error) => console.error(error));

async function init() {
  const { settings } = await chrome.storage.local.get("settings");
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  applySettings();
  fillSettingsForm();
  pickVoice();
  renderTaskList();
  bindEvents();
  await refreshActiveTab();

  chrome.tabs.onActivated.addListener(async () => {
    await refreshActiveTab();
    if (state.task) scheduleShow();
  });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId === state.tabId && info.status === "complete" && state.task) scheduleShow(400);
  });
  chrome.runtime.onMessage.addListener(onPageMessage);
  showView("home");
}

// ---------- Pestaña activa y comunicación con la página

async function refreshActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
}

async function getTab() {
  if (state.tabId == null) await refreshActiveTab();
  if (state.tabId == null) return null;
  return chrome.tabs.get(state.tabId).catch(() => null);
}

// Envía un mensaje a content.js. Si la página se abrió antes de instalar la extensión, lo inyecta.
async function sendToTab(message) {
  const tabId = state.tabId;
  if (tabId == null) return null;
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      return null; // página sin permiso (no es la intranet de ejemplo)
    }
  }
}

function pageMatches(url, page) {
  try {
    const path = new URL(url).pathname;
    return path.endsWith(`/${page}`) || (page === "index.html" && path.endsWith("/"));
  } catch {
    return false;
  }
}

function isDemoUrl(url) {
  return /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|file:\/\/)/i.test(url || "");
}

async function navigateTo(page) {
  const tab = await getTab();
  let base = isDemoUrl(tab?.url) ? tab.url : state.settings.demoUrl;
  if (!/\.html?$/i.test(base) && !base.endsWith("/")) base += "/";
  let url;
  try {
    url = new URL(page, base).href;
  } catch {
    showNotice("La dirección de la intranet no es correcta. Revísala en Ajustes (⚙).", "error");
    return;
  }
  state.expectNavUntil = Date.now() + 3000;
  if (tab) await chrome.tabs.update(tab.id, { url });
  else await chrome.tabs.create({ url });
}

// ---------- Mensajes que llegan desde la página

function onPageMessage(message, sender) {
  if (!message?.type?.startsWith("PP_") || !sender.tab || sender.tab.id !== state.tabId || !state.task) return;
  switch (message.type) {
    case "PP_PAGE_READY":
      progressByUrl(message.url);
      scheduleShow();
      break;
    case "PP_STEP_DONE":
      if (message.runId !== state.runId) return;
      if (currentStep()?.done?.leadsTo) state.expectNavUntil = Date.now() + 3000;
      next();
      break;
    case "PP_TARGET_NOT_FOUND": {
      if (message.runId !== state.runId) return;
      const label = currentStep()?.target?.label || "lo que buscamos";
      const text = `No encuentro ${quoteIfShort(label)} en la página. Puede que la página haya cambiado.`;
      showNotice(text, "hint", [
        { label: "Buscar otra vez", onClick: repeatStep },
        { label: "Pedir ayuda", onClick: openHelp },
      ]);
      speak(text);
      break;
    }
    case "PP_HINT":
      if (message.runId !== state.runId) return;
      showNotice(message.text, "hint");
      speak(message.text);
      break;
    case "PP_PAGE_ALERT":
      handlePageAlert(message.text);
      break;
  }
}

function quoteIfShort(label) {
  return label.split(" ").length <= 3 ? `«${label}»` : label;
}

// Si la página nueva confirma que el paso actual está hecho (por ejemplo, «Pedido guardado»), avanza.
function progressByUrl(url) {
  const done = currentStep()?.done || {};
  const reached = (done.type === "url" && url.includes(done.includes)) || (done.leadsTo && pageMatches(url, done.leadsTo));
  if (reached && !advance()) finish();
}

function handlePageAlert(text) {
  const help = state.task.errorHelp?.find((h) => norm(text).includes(norm(h.match)));
  if (help) {
    const fixStep = () => {
      state.returnTo = state.index;
      goTo(help.step - 1);
    };
    const actions = help.step ? [{ label: `Ir al paso ${help.step}`, onClick: fixStep }] : [];
    showNotice(`La página dice que hay un problema. ${help.text}`, "error", actions);
    speak(`Hay un problema. ${help.text}`);
  } else {
    const message = `La página muestra un aviso: «${text}». Si no lo entiendes, pide ayuda.`;
    showNotice(message, "error", [{ label: "Pedir ayuda", onClick: openHelp }]);
    speak(message);
  }
}

// ---------- Navegación entre pasos

function startTask(id) {
  state.task = TASKS.find((t) => t.id === id);
  state.index = 0;
  state.simpler = false;
  state.confirmed = false;
  state.direction = "forward";
  state.returnTo = null;
  state.lastSpoken = "";
  renderDataBox();
  showView("step");
  showStep();
}

function advance() {
  state.index += 1;
  state.simpler = false;
  state.confirmed = false;
  state.direction = "forward";
  return state.index < state.task.steps.length;
}

function next() {
  if (state.returnTo != null && state.returnTo > state.index) {
    const target = state.returnTo;
    state.returnTo = null;
    goTo(target);
    return;
  }
  state.returnTo = null;
  if (advance()) showStep();
  else finish();
}

function goTo(index) {
  state.direction = index < state.index ? "back" : "forward";
  state.index = Math.max(0, Math.min(index, state.task.steps.length - 1));
  state.simpler = false;
  state.confirmed = false;
  showStep();
}

function repeatStep() {
  state.lastSpoken = "";
  showStep();
}

async function showStep() {
  const step = currentStep();
  if (!step) return;
  const runId = ++state.runId;
  renderStep();
  hideNotice();

  const tab = await getTab();
  if (runId !== state.runId) return;
  const url = tab?.url || "";
  const text = state.simpler && step.simpler ? step.simpler : step.text;
  const key = `${state.task.id}:${state.index}:${state.simpler ? "s" : "n"}`;

  // Si la persona ya está más adelante (por ejemplo, ya en «Nuevo pedido»), se salta el paso.
  if (state.direction === "forward" && step.skipIf?.some((page) => pageMatches(url, page))) {
    next();
    return;
  }

  if (step.page && !pageMatches(url, step.page)) {
    if (Date.now() < state.expectNavUntil) {
      showNotice("Un momento. La página se está cargando…");
      return;
    }
    await sendToTab({ type: "PP_CLEAR" });
    const message = `Este paso se hace en la página «${step.pageName || step.page}».`;
    showNotice(message, "info", [{ label: "Llévame allí", onClick: () => navigateTo(step.page) }]);
    speakOnce(`${key}:pagina`, message);
    return;
  }
  state.expectNavUntil = 0;

  // Acción delicada: primero se revisa y se confirma; después se resalta el botón.
  if (step.irreversible && !state.confirmed) {
    await sendToTab({ type: "PP_CLEAR" });
    speakOnce(key, `${text} ${step.warning}`);
    return;
  }

  const response = await sendToTab({
    type: "PP_SHOW_STEP",
    runId,
    text,
    step: { n: state.index + 1, target: step.target, done: step.done, irreversible: Boolean(step.irreversible) },
  });
  if (runId !== state.runId) return;
  if (!response) {
    showNotice("No puedo ver esta página. Abre la intranet de ejemplo para seguir.", "info", [
      { label: "Abrir la intranet", onClick: () => navigateTo(step.page || "index.html") },
    ]);
  }
  speakOnce(key, text);
}

async function finish() {
  const task = state.task;
  state.task = null;
  state.runId++;
  await sendToTab({ type: "PP_CLEAR" });
  $("done-text").textContent = `Has terminado la tarea: ${task.title}.`;
  showView("done");
  speak(`¡Muy bien! Has terminado la tarea: ${task.title}.`);
}

async function exitTask() {
  state.task = null;
  state.runId++;
  chrome.tts.stop();
  await sendToTab({ type: "PP_CLEAR" });
  showView("home");
}

// ---------- Botones de la guía

async function onDone() {
  const step = currentStep();
  if (!step) return;
  if (step.irreversible && !state.confirmed) {
    const text = "Antes, revisa los datos y marca «Lo he revisado».";
    showNotice(text, "hint");
    speak(text);
    return;
  }
  const result = await sendToTab({ type: "PP_CHECK", runId: state.runId });
  if (result && result.ok === false) {
    // En acciones delicadas no se ofrece «Seguir igualmente».
    const actions = step.irreversible ? [] : [{ label: "Seguir igualmente", onClick: next }];
    showNotice(result.hint, "hint", actions);
    speak(result.hint);
    return;
  }
  next();
}

function onExplain() {
  const step = currentStep();
  if (!step) return;
  if (!state.simpler && step.simpler) {
    state.simpler = true;
    showStep();
    return;
  }
  const who = state.settings.helperName || "tu persona de apoyo";
  const text = `¿Sigues con dudas? No pasa nada. Puedes pedir ayuda a ${who}.`;
  showNotice(text, "info", [{ label: "Pedir ayuda", onClick: openHelp }]);
  speak(text);
}

function openHelp() {
  const { helperName, helperEmail } = state.settings;
  const step = currentStep();
  const who = helperName || "tu persona de apoyo";
  $("help-box").hidden = false;
  $("help-text").textContent = `Puedes pedir ayuda a ${who}. Le diremos en qué paso estás.`;
  const link = $("help-link");
  const email = helperEmail.trim();
  if (email) {
    const body = `Hola, ${helperName}. Necesito ayuda con la tarea «${state.task?.title ?? ""}». Estoy en el paso ${state.index + 1}: ${step?.text ?? ""}`;
    link.href = `mailto:${email}?subject=${encodeURIComponent("Necesito ayuda")}&body=${encodeURIComponent(body)}`;
    link.textContent = `Escribir a ${who}`;
    link.hidden = false;
    $("help-missing").hidden = true;
  } else {
    link.hidden = true;
    $("help-missing").hidden = false;
  }
  $("help-box").scrollIntoView({ block: "nearest" });
  speak(`Puedes pedir ayuda a ${who}.`);
}

// ---------- Pintar el panel

function showView(name) {
  for (const view of ["home", "step", "done", "settings"]) $(`view-${view}`).hidden = view !== name;
  state.view = name;
}

function renderTaskList() {
  const list = $("task-list");
  list.replaceChildren();
  for (const task of TASKS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-btn";
    const icon = Object.assign(document.createElement("span"), { className: "task-icon", textContent: task.icon });
    icon.setAttribute("aria-hidden", "true");
    const title = Object.assign(document.createElement("span"), { className: "task-title", textContent: task.title });
    const summary = Object.assign(document.createElement("span"), { className: "task-summary", textContent: task.summary });
    button.append(icon, title, summary);
    button.addEventListener("click", () => startTask(task.id));
    list.append(button);
  }
}

function renderDataBox() {
  const data = state.task.data || [];
  $("data-box").hidden = data.length === 0;
  const dl = $("data-list");
  dl.replaceChildren();
  for (const item of data) {
    const dt = Object.assign(document.createElement("dt"), { textContent: item.label });
    const dd = Object.assign(document.createElement("dd"), { textContent: item.value });
    const copy = Object.assign(document.createElement("button"), { type: "button", className: "copy-btn", textContent: "Copiar" });
    copy.setAttribute("aria-label", `Copiar ${item.label}`);
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.value);
        copy.textContent = "Copiado ✔";
      } catch {
        copy.textContent = "No se pudo";
      }
      setTimeout(() => (copy.textContent = "Copiar"), 1500);
    });
    dl.append(dt, dd, copy);
  }
}

function renderStep() {
  const { task, index } = state;
  const step = currentStep();
  const total = task.steps.length;
  $("task-title").textContent = task.title;
  $("step-count").textContent = `Paso ${index + 1} de ${total}`;
  const progress = $("progress");
  progress.setAttribute("aria-valuemax", String(total));
  progress.setAttribute("aria-valuenow", String(index + 1));
  $("progress-fill").style.width = `${Math.round(((index + 1) / total) * 100)}%`;

  $("step-text").textContent = step.text;
  $("step-simpler").textContent = step.simpler || "";
  $("step-simpler").hidden = !(state.simpler && step.simpler);

  $("warning").hidden = !step.irreversible;
  $("warning-text").textContent = step.warning || "";
  $("warning-check").checked = state.confirmed;

  $("btn-done").textContent = `✔ ${step.doneLabel || "Ya lo hice"}`;
  $("btn-back").disabled = index === 0;
  $("help-box").hidden = true;
}

function showNotice(text, kind = "info", actions = []) {
  const box = $("notice");
  box.hidden = false;
  box.className = `notice notice-${kind}`;
  $("notice-text").textContent = text;
  const wrap = $("notice-actions");
  wrap.replaceChildren();
  for (const action of actions) {
    const button = Object.assign(document.createElement("button"), {
      type: "button",
      className: "btn btn-small",
      textContent: action.label,
    });
    button.addEventListener("click", action.onClick);
    wrap.append(button);
  }
}

function hideNotice() {
  $("notice").hidden = true;
}

// ---------- Voz (se prefieren voces locales: el texto no sale del ordenador)

function pickVoice() {
  chrome.tts.getVoices((voices) => {
    const spanish = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("es"));
    const pick =
      spanish.find((v) => !v.remote && /^es-es$/i.test(v.lang)) || spanish.find((v) => !v.remote) || spanish[0];
    if (pick) {
      state.voiceName = pick.voiceName;
      state.voiceLang = pick.lang || "es-ES";
    }
  });
}

function speak(text) {
  if (!state.settings.voice || !text) return;
  const options = { lang: state.voiceLang, rate: Number(state.settings.rate) || 1, enqueue: false };
  if (state.voiceName) options.voiceName = state.voiceName;
  chrome.tts.stop();
  chrome.tts.speak(text.replace(/[«»"]/g, ""), options);
}

function speakOnce(key, text) {
  if (state.lastSpoken === key) return;
  state.lastSpoken = key;
  speak(text);
}

// ---------- Ajustes

function applySettings() {
  document.body.dataset.textSize = state.settings.textSize;
  document.body.classList.toggle("high-contrast", Boolean(state.settings.highContrast));
}

function fillSettingsForm() {
  const form = $("settings-form");
  for (const [name, value] of Object.entries(state.settings)) {
    const field = form.elements[name];
    if (!field) continue;
    if (field instanceof RadioNodeList) field.value = value;
    else if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value;
  }
}

async function saveSettingsFromForm() {
  const form = $("settings-form");
  const settings = {
    textSize: form.elements.textSize.value || "normal",
    highContrast: form.elements.highContrast.checked,
    voice: form.elements.voice.checked,
    rate: Number(form.elements.rate.value) || 1,
    helperName: form.elements.helperName.value.trim(),
    helperEmail: form.elements.helperEmail.value.trim(),
    demoUrl: form.elements.demoUrl.value.trim() || DEFAULT_SETTINGS.demoUrl,
  };
  state.settings = settings;
  applySettings();
  await chrome.storage.local.set({ settings });
}

// ---------- Eventos

function bindEvents() {
  $("btn-done").addEventListener("click", onDone);
  $("btn-repeat").addEventListener("click", repeatStep);
  $("btn-explain").addEventListener("click", onExplain);
  $("btn-back").addEventListener("click", () => goTo(state.index - 1));
  $("btn-help").addEventListener("click", openHelp);
  $("btn-exit").addEventListener("click", exitTask);
  $("btn-home").addEventListener("click", () => showView("home"));

  $("warning-check").addEventListener("change", (event) => {
    state.confirmed = event.target.checked;
    if (state.confirmed) showStep();
    else sendToTab({ type: "PP_CLEAR" });
  });

  $("btn-settings").addEventListener("click", () => {
    if (state.view === "settings") return;
    state.viewBeforeSettings = state.view;
    showView("settings");
  });
  $("btn-settings-back").addEventListener("click", () => showView(state.viewBeforeSettings || "home"));
  $("settings-form").addEventListener("input", saveSettingsFromForm);
  $("settings-form").addEventListener("submit", (event) => event.preventDefault());
  $("btn-test-voice").addEventListener("click", () => {
    const previous = state.settings.voice;
    state.settings.voice = true;
    speak("Hola. Así suena mi voz.");
    state.settings.voice = previous;
  });
}
