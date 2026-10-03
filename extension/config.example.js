// Copia este archivo como `config.local.js` (está en .gitignore y no se sube a GitHub)
// y pon tu clave de la API de Gemini (https://aistudio.google.com/apikey).
self.PP_CONFIG = {
  apiKey: "PEGA_AQUI_TU_CLAVE",
  // Se prueban en este orden; si uno falla por cuota o no existe, se usa el siguiente.
  models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
};
