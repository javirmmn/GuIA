// GuIA: service worker.
// - Habla con Gemini (la clave vive aquí, en config.local.js, y nunca llega a las páginas).
// - Recuerda qué está haciendo la persona en cada pestaña, para seguir si la página se recarga.
try {
  importScripts("config.local.js");
} catch {
  // sin config.local.js: la IA avisará de que falta la clave
}
importScripts("gemini.js");

const SESSION_TTL_MS = 20 * 60 * 1000;
const key = (tabId) => `session:${tabId}`;

async function loadSession(tabId) {
  const stored = (await chrome.storage.session.get(key(tabId)))[key(tabId)];
  if (!stored || Date.now() - stored.ts > SESSION_TTL_MS) return null;
  return stored;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  switch (message?.type) {
    case "PP_NEXT":
      self.PP_GEMINI.nextStep({ ...(self.PP_CONFIG || {}), ...message.payload }).then(sendResponse);
      return true;
    case "PP_SESSION":
      chrome.storage.session.set({ [key(tabId)]: { ...message.session, ts: Date.now() } }).then(() => sendResponse({ ok: true }));
      return true;
    case "PP_RESUME":
      loadSession(tabId).then(sendResponse);
      return true;
    case "PP_END":
      chrome.storage.session.remove(key(tabId)).then(() => sendResponse({ ok: true }));
      return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(key(tabId)));
