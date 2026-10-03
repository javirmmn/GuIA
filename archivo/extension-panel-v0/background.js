// Service worker: solo hace que el icono de la extensión abra el panel lateral.
// El resto de la lógica vive en el panel (sidepanel.js) y en la página (content.js).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
