// PasoAPaso: tareas del prototipo (sin IA).
//
// Cada tarea indica:
//   when     cuándo está activa en la página que se está viendo (gana la primera que coincida)
//   key      (opcional) texto que cambia cuando empieza una situación nueva (otro correo, otra búsqueda…)
//   steps    pasos cortos, en orden
//   finish   qué se muestra al terminar todos los pasos (o siempre, si no hay pasos)
//
// Cada paso:
//   text     una frase corta
//   target   elemento a marcar: '#selector' o { text: 'Texto del botón' }
//   done     cuándo está hecho. Se mira el ESTADO de la página, no los clics:
//              { filled: sel, minLength?, pattern?, strip? }   campo con texto válido
//              { selected: sel }                                lista con una opción elegida
//              { visible: sel }                                 algo aparece en la página
//              { any: [done, done] }                            cualquiera de ellos
//              { never: true }                                  se acaba al salir de la página
//   hint     ayuda corta si el campo tiene texto pero no es válido
//   warn     acción delicada: tarjeta roja con este aviso corto
//
// Como se mira el estado, si la persona se salta un paso o la página da un error,
// la tarjeta vuelve sola al primer paso que falta.

(() => {
  const $ = (selector) => document.querySelector(selector);
  const val = (selector) => ($(selector)?.value || "").trim();
  const text = (selector) => ($(selector)?.textContent || "").trim();
  const shown = (selector) => {
    const el = $(selector);
    return Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  };
  const page = () => location.pathname.split("/").pop() || "index.html";

  const openMail = () => $("#lectura[data-abierto]");
  const looksFake = () => {
    const all = `${text("#lectura h2")} ${text("#lectura .cuerpo")}`;
    return /https?:\/\//i.test(all) && /contrase|verifi|bloquead|urgente/i.test(all);
  };

  window.PP_TASKS = [
    {
      id: "pedido-guardado",
      icon: "📦",
      title: "Pedido",
      when: () => shown("#confirmacion"),
      steps: [],
      finish: () => ({ text: "✔ Pedido guardado", sub: `Nº ${text("#num-pedido")}`, kind: "ok", hideAfter: 6000 }),
    },

    {
      id: "pedido-nuevo",
      icon: "📦",
      title: "Pedido nuevo",
      when: () => Boolean($("#form-pedido")),
      steps: [
        { text: "Escribe el cliente", target: "#cliente", done: { filled: "#cliente", minLength: 2 } },
        {
          text: "Escribe el NIF",
          hint: "Ejemplo: B12345678",
          target: "#nif",
          done: { filled: "#nif", strip: "[\\s.-]", pattern: "^([A-Z]\\d{8}|\\d{8}[A-Z]|[A-Z]\\d{7}[A-Z0-9])$" },
        },
        { text: "Elige el producto", target: "#producto", done: { selected: "#producto" } },
        { text: "Escribe la cantidad", hint: "Un número, como 4", target: "#cantidad", done: { filled: "#cantidad", pattern: "^[1-9]\\d*$" } },
        { text: "Elige la forma de pago", target: "#pago", done: { selected: "#pago" } },
        { text: "Pulsa «Guardar pedido»", warn: "Revisa los datos antes", target: "#btn-guardar", done: { never: true } },
      ],
    },

    {
      id: "pedido-buscar",
      icon: "🔎",
      title: "Buscar pedido",
      // Se activa cuando la persona empieza a buscar.
      when: () =>
        page() === "pedidos.html" &&
        (document.activeElement?.id === "buscar" || val("#buscar") !== "" || shown("tr.fila-encontrada") || shown("#sin-resultados")),
      key: () => text("#resultado-busqueda") + text("#sin-resultados"),
      steps: [
        { text: "Escribe el cliente", target: "#buscar", done: { filled: "#buscar" } },
        { text: "Pulsa «Buscar»", target: "#btn-buscar", done: { any: [{ visible: "tr.fila-encontrada" }, { visible: "#sin-resultados" }] } },
      ],
      finish: () =>
        shown("#sin-resultados")
          ? { text: "No sale ningún pedido", sub: "Revisa el nombre", kind: "warn", hideAfter: 8000 }
          : { text: "Mira la fila amarilla", sub: "El estado está al final", kind: "ok", target: "tr.fila-encontrada", hideAfter: 8000 },
    },

    {
      id: "pedidos",
      icon: "📦",
      title: "Pedidos",
      when: () => page() === "pedidos.html",
      steps: [{ text: "Pulsa «Nuevo pedido»", target: "#btn-nuevo-pedido", done: { never: true } }],
    },

    {
      id: "correo-engano",
      icon: "⚠️",
      title: "Cuidado",
      when: () => Boolean(openMail()) && looksFake(),
      key: () => openMail()?.dataset.abierto,
      steps: [],
      finish: () => ({ text: "Posible engaño", sub: "No pulses el enlace ni escribas tu contraseña.", kind: "danger" }),
    },

    {
      id: "correo-responder",
      icon: "✉️",
      title: "Responder",
      when: () => Boolean(openMail()),
      key: () => openMail()?.dataset.abierto,
      steps: [
        { text: "Pulsa «Responder»", target: "#btn-responder", done: { any: [{ visible: "#respuesta" }, { visible: "#aviso-enviado" }] } },
        {
          text: "Escribe tu respuesta",
          target: "#respuesta",
          done: { any: [{ filled: "#respuesta", minLength: 5 }, { visible: "#aviso-enviado" }] },
        },
        { text: "Pulsa «Enviar»", warn: "Se envía y no se puede deshacer", target: "#btn-enviar", done: { visible: "#aviso-enviado" } },
      ],
      finish: () => ({ text: "✔ Correo enviado", kind: "ok", hideAfter: 5000 }),
    },

    {
      id: "correo",
      icon: "✉️",
      title: "Correo",
      when: () => page() === "correo.html",
      steps: [{ text: "Abre un correo", target: ".correo-item.unread", done: { never: true } }],
    },
  ];
})();
