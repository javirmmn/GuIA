// Servidor estático mínimo para la intranet de ejemplo. Sin dependencias.
// Uso: node demo-site/server.js   (puerto opcional: PORT=9000 node demo-site/server.js)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = "127.0.0.1"; // solo accesible desde este ordenador
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      return res.end("Petición no válida");
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      return res.end("Prohibido");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("No encontrado");
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`Intranet de ejemplo en http://${HOST}:${PORT}/  (Ctrl+C para parar)`);
  });
