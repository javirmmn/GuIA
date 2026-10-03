// Tareas escritas a mano para el prototipo (sin IA).
// Más adelante, estas guías saldrán del «modo grabación» del preparador laboral o de la IA.
//
// Cada paso:
//   page       Página donde se hace el paso (null = en cualquier página de la intranet).
//   pageName   Nombre de la página para decírselo a la persona.
//   skipIf     Si la persona ya está en una de estas páginas, se salta el paso.
//   target     Elemento que hay que resaltar: { selector, text, label }.
//              Si el selector falla, se busca por el texto visible.
//   text       Instrucción en lectura fácil.
//   simpler    Explicación más sencilla («No lo entiendo»).
//   done       Cuándo está hecho el paso:
//                { type: "click", leadsTo? }           al pulsar el elemento
//                { type: "filled", minLength?, pattern?, patternHint? }
//                { type: "selected", expect? }
//                { type: "visible", selector, notYetHint? }
//                { type: "url", includes, notYetHint? }  al llegar a otra página
//                { type: "manual" }                      solo con «Ya lo hice»
//   irreversible + warning   Acción delicada: hay que confirmar antes de resaltar.
//   doneLabel  Texto del botón principal (por defecto «Ya lo hice»).
//
// errorHelp: traduce a lectura fácil los mensajes de error de la página y dice a qué paso volver.

export const TASKS = [
  {
    id: "registrar-pedido",
    icon: "📦",
    title: "Registrar un pedido nuevo",
    summary: "Apuntar en la intranet el pedido de un cliente.",
    data: [
      { label: "Cliente", value: "Panadería López" },
      { label: "NIF", value: "B12345678" },
      { label: "Producto", value: "Harina de trigo 25 kg" },
      { label: "Cantidad", value: "4" },
      { label: "Forma de pago", value: "Transferencia" },
    ],
    steps: [
      {
        page: null,
        skipIf: ["pedidos.html", "nuevo-pedido.html"],
        target: { selector: "#menu-pedidos", text: "Pedidos", label: "Pedidos" },
        text: "Pulsa «Pedidos» en el menú de la izquierda.",
        simpler: "Mira el menú de la izquierda. Busca la palabra «Pedidos». Púlsala.",
        done: { type: "click", leadsTo: "pedidos.html" },
      },
      {
        page: "pedidos.html",
        pageName: "Pedidos",
        skipIf: ["nuevo-pedido.html"],
        target: { selector: "#btn-nuevo-pedido", text: "Nuevo pedido", label: "Nuevo pedido" },
        text: "Pulsa el botón verde «Nuevo pedido». Está arriba a la derecha.",
        simpler: "Busca el botón verde. Pone «Nuevo pedido». Púlsalo.",
        done: { type: "click", leadsTo: "nuevo-pedido.html" },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#cliente", label: "Cliente" },
        text: "Pulsa en la casilla «Cliente» y escribe: Panadería López.",
        simpler: "Haz clic en la casilla blanca que está al lado de «Cliente». Escribe el nombre: Panadería López.",
        done: { type: "filled", minLength: 3 },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#nif", label: "NIF" },
        text: "Escribe el NIF del cliente: B12345678.",
        simpler: "El NIF es un código. Tiene 1 letra y 8 números. Escribe: B12345678.",
        done: {
          type: "filled",
          pattern: "^([A-Z]\\d{8}|\\d{8}[A-Z])$",
          patternHint: "El NIF parece incompleto. Tiene 1 letra y 8 números. Mira los datos de la tarea: B12345678.",
        },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#producto", label: "Producto" },
        text: "Abre la lista «Producto» y elige «Harina de trigo 25 kg».",
        simpler: "Pulsa en la lista de «Producto». Se abre una lista. Elige la harina.",
        done: { type: "selected", expect: "Harina de trigo" },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#cantidad", label: "Cantidad" },
        text: "Escribe la cantidad: 4.",
        simpler: "Pulsa en la casilla «Cantidad». Escribe el número 4.",
        done: { type: "filled" },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#pago", label: "Forma de pago" },
        text: "Abre la lista «Forma de pago» y elige «Transferencia».",
        simpler: "Pulsa en la lista de «Forma de pago». Elige «Transferencia».",
        done: { type: "selected", expect: "Transferencia" },
      },
      {
        page: "nuevo-pedido.html",
        pageName: "Nuevo pedido",
        target: { selector: "#btn-guardar", text: "Guardar pedido", label: "Guardar pedido" },
        irreversible: true,
        warning: "Cuidado: cuando pulses «Guardar pedido», el pedido se envía al almacén. Antes, mira que todos los datos están bien.",
        text: "Pulsa el botón verde «Guardar pedido».",
        simpler: "Busca el botón verde de abajo. Pone «Guardar pedido». Púlsalo. No pulses «Guardar borrador».",
        done: {
          type: "url",
          includes: "pedido-guardado.html",
          notYetHint: "Todavía no se ha guardado el pedido. Pulsa el botón verde «Guardar pedido».",
        },
      },
      {
        page: "pedido-guardado.html",
        pageName: "Pedido guardado",
        target: { selector: "#confirmacion", label: "el recuadro verde" },
        text: "¡Ya está! El pedido está guardado. Aquí ves el número del pedido.",
        simpler: "Has terminado. El número del pedido está en el recuadro verde. Si alguien te lo pide, díselo.",
        done: { type: "manual" },
        doneLabel: "Terminar",
      },
    ],
    errorHelp: [
      { match: "VAL-101", text: "Falta el nombre del cliente. Escríbelo en la casilla «Cliente».", step: 3 },
      { match: "VAL-102", text: "Falta el NIF del cliente o está mal escrito. El NIF tiene 1 letra y 8 números: B12345678.", step: 4 },
      { match: "VAL-103", text: "Falta elegir el producto. Elige «Harina de trigo 25 kg».", step: 5 },
      { match: "VAL-104", text: "Falta la cantidad. Escribe el número 4.", step: 6 },
      { match: "VAL-105", text: "Falta elegir la forma de pago. Elige «Transferencia».", step: 7 },
    ],
  },

  {
    id: "buscar-pedido",
    icon: "🔎",
    title: "Saber cómo va un pedido",
    summary: "Buscar el pedido de un cliente y mirar su estado.",
    data: [{ label: "Cliente", value: "Ferretería Martín" }],
    steps: [
      {
        page: null,
        skipIf: ["pedidos.html"],
        target: { selector: "#menu-pedidos", text: "Pedidos", label: "Pedidos" },
        text: "Pulsa «Pedidos» en el menú de la izquierda.",
        simpler: "Mira el menú de la izquierda. Busca la palabra «Pedidos». Púlsala.",
        done: { type: "click", leadsTo: "pedidos.html" },
      },
      {
        page: "pedidos.html",
        pageName: "Pedidos",
        target: { selector: "#buscar", label: "la casilla de búsqueda" },
        text: "Pulsa en la casilla de búsqueda y escribe: Ferretería Martín.",
        simpler: "Arriba hay una casilla para buscar. Pulsa en ella. Escribe el nombre del cliente: Ferretería Martín.",
        done: { type: "filled", minLength: 3 },
      },
      {
        page: "pedidos.html",
        pageName: "Pedidos",
        target: { selector: "#btn-buscar", text: "Buscar", label: "Buscar" },
        text: "Pulsa el botón «Buscar».",
        simpler: "Al lado de la casilla hay un botón azul. Pone «Buscar». Púlsalo.",
        done: { type: "visible", selector: "tr.fila-encontrada", notYetHint: "Todavía no has buscado. Pulsa el botón «Buscar»." },
      },
      {
        page: "pedidos.html",
        pageName: "Pedidos",
        target: { selector: "tr.fila-encontrada", label: "la fila amarilla" },
        text: "Mira la fila amarilla. En la columna «Estado» ves cómo va el pedido.",
        simpler: "Mira la fila de color amarillo. Al final de la fila pone si el pedido ya ha llegado.",
        done: { type: "manual" },
        doneLabel: "Ya lo he visto",
      },
    ],
    errorHelp: [
      {
        match: "SRCH-404",
        text: "No sale ningún pedido. Puede que el nombre esté mal escrito. Escríbelo otra vez: Ferretería Martín.",
        step: 2,
      },
    ],
  },

  {
    id: "contestar-correo",
    icon: "✉️",
    title: "Contestar el correo de un cliente",
    summary: "Responder a Ferretería Martín.",
    data: [
      { label: "Para", value: "Ferretería Martín" },
      { label: "Respuesta", value: "Hola, Carmen. Su pedido llega el jueves. Un saludo. Laura." },
    ],
    steps: [
      {
        page: null,
        skipIf: ["correo.html"],
        target: { selector: "#menu-correo", text: "Correo", label: "Correo" },
        text: "Pulsa «Correo» en el menú de la izquierda.",
        simpler: "Mira el menú de la izquierda. Busca la palabra «Correo». Púlsala.",
        done: { type: "click", leadsTo: "correo.html" },
      },
      {
        page: "correo.html",
        pageName: "Correo",
        target: { selector: '[data-correo="ferreteria"]', text: "Ferretería Martín", label: "el correo de Ferretería Martín" },
        text: "Pulsa el correo de «Ferretería Martín».",
        simpler: "A la izquierda está la lista de correos. Busca el que pone «Ferretería Martín». Púlsalo.",
        done: { type: "click" },
      },
      {
        page: "correo.html",
        pageName: "Correo",
        // Solo si está abierto el correo correcto: así no se contesta a otra persona por error.
        target: { selector: '#lectura[data-abierto="ferreteria"]', label: "el correo de Ferretería Martín" },
        text: "Lee el correo. El cliente pregunta cuándo llega su pedido.",
        simpler: "Lee el texto del correo. El cliente quiere saber qué día llega su pedido. La respuesta es: el jueves.",
        done: { type: "manual" },
        doneLabel: "Ya lo he leído",
      },
      {
        page: "correo.html",
        pageName: "Correo",
        target: { selector: '#lectura[data-abierto="ferreteria"] #btn-responder', label: "el botón «Responder» del correo de Ferretería Martín" },
        text: "Pulsa el botón «Responder».",
        simpler: "Debajo del correo hay un botón azul. Pone «Responder». Púlsalo.",
        done: { type: "click" },
      },
      {
        page: "correo.html",
        pageName: "Correo",
        target: { selector: '#lectura[data-abierto="ferreteria"] #respuesta', label: "el recuadro de la respuesta" },
        text: "Escribe tu respuesta. Puedes copiar el texto de «Datos de la tarea».",
        simpler: "Pulsa en el recuadro blanco grande. Escribe: Hola, Carmen. Su pedido llega el jueves. Un saludo. Laura.",
        done: { type: "filled", minLength: 10 },
      },
      {
        page: "correo.html",
        pageName: "Correo",
        target: { selector: '#lectura[data-abierto="ferreteria"] #btn-enviar', label: "el botón «Enviar»" },
        irreversible: true,
        warning: "Cuidado: cuando pulses «Enviar», el correo se va y no se puede deshacer. Antes, lee tu respuesta otra vez.",
        text: "Pulsa el botón «Enviar».",
        simpler: "Debajo de tu respuesta hay un botón azul. Pone «Enviar». Púlsalo.",
        done: { type: "visible", selector: "#aviso-enviado", notYetHint: "Todavía no se ha enviado. Pulsa el botón «Enviar»." },
      },
      {
        page: "correo.html",
        pageName: "Correo",
        target: { selector: "#aviso-enviado", label: "el aviso verde" },
        text: "¡Ya está! El correo se ha enviado.",
        simpler: "Has terminado. Tu respuesta ya le ha llegado al cliente.",
        done: { type: "manual" },
        doneLabel: "Terminar",
      },
    ],
    errorHelp: [
      { match: "ERR_EMPTY_BODY", text: "No has escrito nada en la respuesta. Escribe el mensaje antes de enviarlo.", step: 5 },
    ],
  },
];
