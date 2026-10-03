# PasoAPaso: prototipo pasivo (sin IA)

Extensión de Chrome/Edge que **no hay que abrir**. Cuando la página coincide con una tarea, aparece sola una tarjeta pequeña en una esquina con **un paso corto**, y se marca en la página lo que hay que pulsar. Las tareas están escritas a mano en [extension/tasks.js](extension/tasks.js). El plan completo está en [PLANNING.md](PLANNING.md).

## Qué hace

| Página de la intranet | Qué aparece solo |
|---|---|
| Pedidos | «Pulsa «Nuevo pedido»». Si empiezas a escribir en la búsqueda, pasa a guiar la búsqueda. |
| Nuevo pedido | 6 pasos: cliente, NIF, producto, cantidad, forma de pago y guardar. |
| Pedido guardado | «✔ Pedido guardado». Se quita sola. |
| Correo | «Abre un correo». Con un correo abierto: Responder → escribir → Enviar. |
| Correo sospechoso | Aviso rojo: «Posible engaño». No se puede minimizar. |

- La tarjeta se **aparta sola** si tapa el botón marcado.
- El botón **–** la reduce a una burbuja. Un clic en la burbuja la abre otra vez.
- Si te saltas un paso o la página da un error, la tarjeta **vuelve sola al primer paso que falta**.
- No tiene ajustes, ni voz, ni panel. No pide permisos al navegador: solo se ejecuta en las páginas indicadas en `manifest.json`.

## Cómo probarlo

Solo hace falta **Node.js**.

**1. Arrancar la intranet de ejemplo** (desde la carpeta `NBM`) y dejar la ventana abierta:

```bash
node demo-site/server.js
```

**2. Cargar la extensión en Chrome**

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y elige la carpeta `NBM\extension`.
4. Abre http://127.0.0.1:8080/ y navega por la intranet. No hay que pulsar nada más.

En Edge es igual, desde `edge://extensions`.

**3. Después de cambiar el código:** pulsa ↻ en la extensión y recarga la página (F5).

## Problemas frecuentes

| Problema | Solución |
|---|---|
| No aparece la tarjeta | Recarga la página (F5). Comprueba que la extensión está activada y que estás en `127.0.0.1` o `localhost`. |
| Quiero usar los HTML sin servidor | En `chrome://extensions` → PasoAPaso → Detalles, activa «Permitir el acceso a las URL de archivo». |
| El puerto 8080 está ocupado | En PowerShell: `$env:PORT=9000; node demo-site/server.js` y abre `http://127.0.0.1:9000/`. |

## Cómo añadir o cambiar una tarea

Edita [extension/tasks.js](extension/tasks.js). Cada tarea dice cuándo está activa (`when`) y sus pasos. Cada paso lleva una frase corta (`text`), el elemento a marcar (`target`) y cuándo está hecho (`done`). Al principio del archivo está explicado cada campo.

## Límites del prototipo

- Sin IA: solo funciona con la intranet de ejemplo.
- En «Pedidos» se supone que la persona quiere hacer un pedido nuevo, salvo que empiece a buscar. Con IA, la tarea se sacará del correo o de la lista de tareas.
- No funciona dentro de iframes ni en aplicaciones que dibujan la pantalla en un `canvas`.
- Para un piloto hay que limitar `matches` en `manifest.json` a los dominios de la empresa.

## Carpetas

- `extension/`: la extensión (3 archivos: `manifest.json`, `tasks.js`, `content.js`).
- `demo-site/`: la intranet ficticia.
- `archivo/extension-panel-v0/`: la primera versión, con panel lateral. Ya no se usa.
