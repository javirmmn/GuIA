// PasoAPaso: service worker.
// - Habla con Gemini (la clave vive aquí, en config.local.js, y nunca llega a las páginas).
// - Recuerda qué está haciendo la persona, para seguir si la página se recarga o si un paso abre otra pestaña.
//
// Una "guía" (objetivo + pasos hechos) puede pasar por varias pestañas, pero solo una la lleva: `owner`.
// Las demás pestañas de la guía muestran «Sigue en la otra pestaña» con un botón para traerla de vuelta.
try {
  importScripts("config.local.js");
} catch {
  // sin config.local.js: la IA avisará de que falta la clave
}
importScripts("gemini.js");

const SESSION_TTL_MS = 20 * 60 * 1000;
const CACHE_TTL_MS = 2 * 60 * 1000;
const STATE_KEY = "pp-state"; // { guides: { gid: guide }, tabs: { tabId: gid } }

// Las lecturas y escrituras van en fila: varios eventos (pestaña nueva + mensaje de la página) pueden llegar a la vez.
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(async () => {
    const state = (await chrome.storage.session.get(STATE_KEY))[STATE_KEY] || { guides: {}, tabs: {} };
    const now = Date.now();
    for (const [gid, guide] of Object.entries(state.guides)) {
      if (now - guide.ts > SESSION_TTL_MS) dropGuide(state, gid);
    }
    const result = await fn(state);
    await chrome.storage.session.set({ [STATE_KEY]: state });
    return result;
  });
  chain = run.catch(() => {});
  return run;
}

function dropGuide(state, gid) {
  const tabs = state.guides[gid]?.tabs || [];
  delete state.guides[gid];
  for (const tabId of tabs) if (state.tabs[tabId] === gid) delete state.tabs[tabId];
  return tabs;
}

const guideOf = (state, tabId) => {
  const gid = state.tabs[tabId];
  return gid && state.guides[gid] ? { gid, guide: state.guides[gid] } : {};
};

// Lo que recibe la página al volver a cargarse.
const forTab = (guide, tabId) => guide && { goal: guide.goal, history: guide.history, paused: guide.owner !== tabId };

function notify(tabId, message) {
  chrome.tabs.sendMessage(Number(tabId), message).catch(() => {}); // la pestaña puede estar cargando o no tener la extensión
}

// La guía pasa a `tabId`. El paso que se estaba haciendo se da por hecho (ha abierto esta pestaña o se ha elegido seguir aquí).
function moveTo(state, gid, tabId) {
  const guide = state.guides[gid];
  const previous = guide.owner;
  if (guide.current) {
    guide.history = [...guide.history, { text: guide.current }].slice(-8);
    guide.current = "";
  }
  guide.owner = tabId;
  guide.tabs = [...guide.tabs.filter((t) => t !== tabId), tabId];
  guide.ts = Date.now();
  state.tabs[tabId] = gid;
  if (previous !== tabId) {
    notify(previous, { type: "PP_MOVED" });
    notify(tabId, { type: "PP_OWNER" }); // si la página ya estaba cargada, empieza a guiar aquí
  }
}

// Una pestaña abierta desde la que lleva la guía (enlace que abre pestaña nueva, window.open…) se queda con la guía
// en cuanto la persona la mira. Si se abre en segundo plano, se apunta y se pasa al ir a ella.
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId == null) return;
  locked((state) => {
    if (state.tabs[tab.id]) return;
    const { gid, guide } = guideOf(state, tab.openerTabId);
    if (!guide || guide.owner !== tab.openerTabId) return;
    if (tab.active) moveTo(state, gid, tab.id);
    else guide.children = [...(guide.children || []), tab.id].slice(-10);
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) =>
  locked((state) => {
    if (state.tabs[tabId]) return;
    for (const [gid, guide] of Object.entries(state.guides)) {
      if (!guide.children?.includes(tabId)) continue;
      guide.children = guide.children.filter((t) => t !== tabId);
      return moveTo(state, gid, tabId);
    }
  }),
);

// Al cerrar la pestaña que llevaba la guía, vuelve a la pestaña anterior de la guía.
chrome.tabs.onRemoved.addListener((tabId) =>
  locked((state) => {
    const { gid, guide } = guideOf(state, tabId);
    delete state.tabs[tabId];
    if (!guide) return;
    guide.tabs = guide.tabs.filter((t) => t !== tabId);
    if (!guide.tabs.length) return dropGuide(state, gid);
    if (guide.owner === tabId) {
      guide.owner = guide.tabs[guide.tabs.length - 1];
      guide.current = "";
      guide.ts = Date.now();
      notify(guide.owner, { type: "PP_OWNER" });
    }
  }),
);

// Si se pregunta lo mismo (misma página, mismo objetivo y mismos pasos, p. ej. al recargar), se reutiliza la respuesta
// en vez de gastar otra llamada a la IA.
const cache = new Map();
async function askModel(payload, fresh) {
  const key = JSON.stringify(payload);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.res;
  const res = await self.PP_GEMINI.nextStep({ ...(self.PP_CONFIG || {}), ...payload });
  if (res.usage) console.debug(`[PasoAPaso] tokens: entrada ${res.usage.prompt}, salida ${res.usage.output}`);
  if (res.step) {
    cache.set(key, { res, ts: Date.now() });
    if (cache.size > 20) cache.delete(cache.keys().next().value);
  }
  return res;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  switch (message?.type) {
    case "PP_NEXT":
      locked((state) => {
        const { guide } = guideOf(state, tabId);
        return Boolean(guide) && guide.owner !== tabId;
      })
        .then((moved) => (moved ? { moved: true } : askModel(message.payload, message.fresh)))
        .then(sendResponse);
      return true;
    case "PP_START": // pregunta nueva: la guía anterior de esta pestaña (y sus otras pestañas) se termina
      locked((state) => {
        const { gid } = guideOf(state, tabId);
        if (gid) for (const t of dropGuide(state, gid)) if (t !== tabId) notify(t, { type: "PP_STOP" });
        const id = `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
        state.guides[id] = { goal: message.session.goal, history: [], current: "", owner: tabId, tabs: [tabId], ts: Date.now() };
        state.tabs[tabId] = id;
      }).then(() => sendResponse({ ok: true }));
      return true;
    case "PP_SESSION":
      locked((state) => {
        const { guide } = guideOf(state, tabId);
        if (!guide || guide.owner !== tabId) return;
        Object.assign(guide, { history: message.session.history || [], current: message.session.current || "", ts: Date.now() });
      }).then(() => sendResponse({ ok: true }));
      return true;
    case "PP_RESUME":
      locked((state) => forTab(guideOf(state, tabId).guide, tabId)).then(sendResponse);
      return true;
    case "PP_TAKEOVER": // «Seguir aquí» en una pestaña que había cedido la guía
      locked((state) => {
        const { gid, guide } = guideOf(state, tabId);
        if (!guide) return null;
        moveTo(state, gid, tabId);
        return forTab(guide, tabId);
      }).then(sendResponse);
      return true;
    case "PP_END":
      locked((state) => {
        const { gid } = guideOf(state, tabId);
        if (gid) for (const t of dropGuide(state, gid)) if (t !== tabId) notify(t, { type: "PP_STOP" });
      }).then(() => sendResponse({ ok: true }));
      return true;
  }
});
