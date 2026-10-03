// Partes comunes de la intranet ficticia: cabecera, menú y "base de datos" de pedidos (localStorage).
(function () {
  const page = location.pathname.split("/").pop() || "index.html";

  const NAV = [
    { href: "index.html", id: "menu-inicio", label: "Inicio" },
    { href: "pedidos.html", id: "menu-pedidos", label: "Pedidos", also: ["nuevo-pedido.html", "pedido-guardado.html"] },
    { href: "correo.html", id: "menu-correo", label: "Correo", badge: "2" },
    { href: "#", id: "menu-clientes", label: "Clientes" },
    { href: "#", id: "menu-almacen", label: "Almacén" },
    { href: "#", id: "menu-informes", label: "Informes" },
    { href: "#", id: "menu-ajustes", label: "Ajustes" },
    { href: "#", id: "menu-ayuda", label: "Ayuda" },
  ];

  const topbar = document.getElementById("topbar");
  if (topbar) {
    topbar.innerHTML = `
      <span class="logo">Intranet Ejemplo, S. L.</span>
      <input type="search" placeholder="Buscar en la intranet…" aria-label="Buscar en la intranet">
      <span class="user"><span>🔔 3</span><span>Laura García ▾</span></span>`;
  }

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    for (const item of NAV) {
      const a = document.createElement("a");
      a.href = item.href;
      a.id = item.id;
      a.textContent = item.label;
      if (item.badge) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = item.badge;
        a.append(badge);
      }
      if (item.href === page || (item.also || []).includes(page)) a.classList.add("active");
      if (item.href === "#") a.addEventListener("click", (e) => e.preventDefault());
      sidebar.append(a);
    }
  }

  // Pedidos de ejemplo + los que se guarden en este navegador.
  const SEED = [
    { num: "2026-0411", fecha: "28/09/2026", cliente: "Ferretería Martín", producto: "Guantes de trabajo (pack 12)", cantidad: 10, estado: "En camino: llega el jueves" },
    { num: "2026-0412", fecha: "29/09/2026", cliente: "Bar Los Arcos", producto: "Aceite de oliva 5 l", cantidad: 6, estado: "Entregado" },
    { num: "2026-0413", fecha: "30/09/2026", cliente: "Colegio San Juan", producto: "Cajas de cartón (pack 50)", cantidad: 3, estado: "Preparando" },
    { num: "2026-0414", fecha: "01/10/2026", cliente: "Frutas Ruiz", producto: "Azúcar 10 kg", cantidad: 8, estado: "Entregado" },
    { num: "2026-0415", fecha: "02/10/2026", cliente: "Hotel Mirador", producto: "Levadura 1 kg", cantidad: 12, estado: "Pendiente de pago" },
  ];

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem("intranet-pedidos") || "[]");
    } catch {
      return [];
    }
  }

  window.Intranet = {
    getPedidos() {
      return [...SEED, ...readSaved()];
    },
    savePedido(pedido) {
      const saved = readSaved();
      const num = `2026-${String(416 + saved.length).padStart(4, "0")}`;
      const record = { num, fecha: new Date().toLocaleDateString("es-ES"), estado: "Registrado", ...pedido };
      saved.push(record);
      localStorage.setItem("intranet-pedidos", JSON.stringify(saved));
      return record;
    },
    normalize(text) {
      return String(text).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    },
  };
})();
