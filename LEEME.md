# Portfolio por pestañas — Álvaro García-Aparicio Rey

Web estática: abre `index.html` con doble clic. Para publicarla, arrastra esta carpeta a https://app.netlify.com/drop o súbela a Vercel como proyecto estático.

Cada pestaña tiene su propio estilo e interacción:
- **Inicio**: nombre con tipografía cinética (reacciona al cursor) y tríptico de los tres oficios.
- **Sobre mí**: estilo editorial, rasgos desplegables y comparador «Campo / Código».
- **Experiencia**: papel milimetrado magnético (cursor y clic), diagrama de las tres áreas y ficha de cada puesto.
- **Motores**: coche en carretera que acelera contigo, cuentarrevoluciones (mantén pulsado o barra espaciadora) y diagnosis OBD.
- **Eólica**: plano técnico con viento interactivo, lecturas en vivo y curva de potencia.
- **Informática**: fondo de lluvia de código que reacciona al ratón y terminal con comandos (help, stack, automatizar, cd…).
- **Flotas**: mapa de seguimiento de vehículos, bandeja de presupuestos para autorizar y correo del equipo técnico.
- **Contacto**: carta para rellenar que prepara el correo.

Contacto con adjuntos: el formulario envía el mensaje y hasta 3 archivos (10 MB en total) a alvarog.fp13@gmail.com mediante FormSubmit (formsubmit.co, gratuito). La primera vez que alguien lo use, FormSubmit enviará a ese correo un email de activación: hay que pulsar el botón de confirmar una sola vez. Solo funciona con la web publicada (Netlify, Vercel…); abierta como archivo local usa el programa de correo.

Sonido: música ambiental relajada generada en el navegador (empieza con el primer clic y se apaga con el botón «Música» de la cabecera). En Motores, motor de gasolina deportivo con petardeos al cambiar de marcha y al soltar el acelerador; en Eólica, viento que sube con la velocidad; en Informática, ventiladores, teclados y pitidos de fondo. Todo el audio está sintetizado con Web Audio, sin archivos ni derechos de terceros.

Archivos: `index.html`, `styles.css`, `app.js`, `img/`.
