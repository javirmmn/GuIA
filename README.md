# PasoAPaso

Extensión de Chrome/Edge que guía paso a paso, con una tarjeta pequeña en una esquina y una marca sobre lo que hay que pulsar. El plan completo está en [PLANNING.md](PLANNING.md).

Tiene dos formas de funcionar:

1. **Pasiva (sin IA):** en la intranet de ejemplo detecta sola la tarea y da los pasos. Está escrita a mano en [extension/tasks.js](extension/tasks.js).
2. **Preguntando a la IA (Gemini), en cualquier página:** pulsas el botón 💬, escribes qué quieres hacer («enviar un correo a mi jefe») y te va dando **un paso cada vez**. Cuando haces el paso, pide el siguiente.

## Cómo funciona la IA

1. Lee la página: nombres de botones, enlaces y campos. **No envía lo que hay escrito en los campos** (solo si están vacíos), ni contraseñas. Tapa correos y números largos.
   Para gastar pocos tokens solo envía una lista corta (unos 70 elementos como mucho): primero lo que está en pantalla, campos y botones, y lo que se parece a tu objetivo; quita repetidos y, si hay una ventana abierta delante, solo lo que hay en ella. Si se pregunta lo mismo dos veces seguidas (por ejemplo al recargar), reutiliza la respuesta. El consumo real de cada paso sale en la consola del service worker.
2. Envía eso y tu objetivo a Gemini. Gemini devuelve **un solo paso** con el número del elemento.
3. La extensión comprueba que ese elemento existe y lo marca. Si la IA inventa uno, no marca nada.
4. Al usarlo (pulsar, elegir, o escribir y pulsar Enter) mira la página otra vez y pide el siguiente. Si la página cambia de dirección, sigue sola. Si el paso abre **otra pestaña**, la guía sigue en la pestaña nueva; al cerrarla vuelve a la anterior.
5. Los pasos que envían, guardan, borran o pagan salen en rojo con un aviso. Si hay que poner contraseñas, códigos o datos bancarios, **no guía**: dice que hace falta ayuda de una persona.

## Instalación

Hace falta **Node.js** solo para la intranet de ejemplo.

**1. Poner la clave de Gemini** (una vez):

1. Copia `extension/config.example.js` como `extension/config.local.js`.
2. Pega tu clave de https://aistudio.google.com/apikey en `apiKey`.

`config.local.js` está en `.gitignore`: **no se sube a GitHub**. No compartas esa carpeta con nadie, porque lleva la clave dentro.

**2. Cargar la extensión en Chrome**

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y elige la carpeta `NBM\extension`.
3. Si ya estaba cargada, pulsa ↻ y recarga las páginas abiertas (F5).

En Edge es igual, desde `edge://extensions`.

**3. (Opcional) Intranet de ejemplo**, desde la carpeta `NBM`:

```bash
node demo-site/server.js
```

Y abre http://127.0.0.1:8080/.

## Cómo se usa

- En **cualquier página** verás un botón redondo 💬 abajo a la derecha. Púlsalo, escribe qué quieres hacer y pulsa ➤.
- La tarjeta dice «Pensando…» un par de segundos y muestra el primer paso, con la marca en la página.
- Haz el paso. Al pulsar o elegir lo marcado, o al escribir y pulsar **Enter** (o pasar a otro campo), avanza solo al siguiente paso. Mientras escribes lo marca en verde con «✔ Hecho»; también puedes pulsar **Siguiente Paso →** en cualquier momento.
- Si un paso abre otra pestaña, la guía se va con ella. La pestaña anterior dice «Sigue en la otra pestaña» y tiene un botón **Seguir aquí** para traerla de vuelta.
- La tarjeta muestra los pasos como lista: los hechos van **tachados en verde**, el actual resaltado con 👉. El resto de la pantalla se oscurece para destacar lo que hay que pulsar. **🔊** lee un paso en voz alta.
- **Se puede mover:** arrastra la tarjeta por su cabecera (el título), o la burbuja y el botón 💬. Se queda donde la sueltes, también al cambiar de página en esa pestaña. **Doble clic en el título** la devuelve a la esquina automática.
- **✕** termina la guía. **Esc** cierra la casilla de pregunta.
- En la intranet de ejemplo, además, la tarjeta aparece sola con las tareas escritas a mano.

Prueba rápida: abre la intranet, pulsa 💬 y escribe «registrar un pedido nuevo».

## Límites y avisos

- **Datos y privacidad.** Lo que se lee de la página sale hacia Google cuando preguntas. Con el **nivel gratuito**, Google puede usarlo para mejorar sus productos, y sus condiciones no permiten usarlo con usuarios del Espacio Económico Europeo, Suiza o Reino Unido. **Para la demo, usa solo datos ficticios.** Para uso real hace falta activar la facturación o usar Azure OpenAI (ver PLANNING.md).
- **La clave está dentro de la extensión** (en tu carpeta). Vale para una demo en tu ordenador. Para repartirla hace falta un servidor intermedio que guarde la clave.
- **Cuota gratuita:** unas 10 preguntas por minuto. Si sale «Hay muchas preguntas», espera un momento y pulsa «Probar otra vez».
- **Permisos:** la extensión se activa en **todas las páginas** (`<all_urls>`) y muestra el aviso de Chrome «leer y cambiar sus datos en todos los sitios». Solo habla con Google cuando preguntas. Para un piloto en empresa conviene limitarla a sus dominios.
- **Qué no ve:** páginas internas de Chrome (`chrome://`), la tienda de extensiones, PDF, y webs que dibujan todo en un `canvas` (Google Docs, por ejemplo). Tampoco entra en `iframe`. Para abrir archivos locales hay que activar «Permitir el acceso a las URL de archivo» en la extensión.
- **La IA puede equivocarse.** Si dice algo que no cuadra, pulsa ✕ y pide ayuda a una persona.
- **Gmail y Outlook** tienen páginas complejas. Está probado con una página que imita a Gmail y con la intranet; en el correo real hay que probarlo y ajustarlo.

## Archivos

| Archivo | Para qué |
|---|---|
| `extension/manifest.json` | Permisos y archivos de la extensión |
| `extension/content.js` | Tarjeta, marca en la página y bucle de pasos |
| `extension/snapshot.js` | Lee la página (qué botones y campos hay) |
| `extension/background.js` | Habla con Gemini y recuerda la guía si la página se recarga |
| `extension/gemini.js` | Instrucciones y llamada a Gemini |
| `extension/tasks.js` | Tareas escritas a mano (solo intranet de ejemplo) |
| `extension/config.local.js` | **Tu clave. No se sube a GitHub** |
| `demo-site/` | Intranet ficticia |
| `archivo/extension-panel-v0/` | Primera versión con panel lateral (ya no se usa) |
