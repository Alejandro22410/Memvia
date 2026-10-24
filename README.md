<div align="center">

<img src="icons/icon192.png" alt="Logo de Memvia" width="120">

# Memvia · Tu gente, siempre cerca

**Una app para ayudar a las personas que olvidan cosas a reconocer a su familia, saber dónde vive y recordar su día.**

[**▶ Probar la app**](https://alejandro22410.github.io/prueba/)

Proyecto para **Coolest Projects** · Alejandro Narvaez Jaime · Codelearn Gava

</div>

---

## 🧠 ¿Qué problema resuelve?

Una persona con alzheimer, demencia o pérdida de memoria puede olvidar quién es cada familiar, dónde vive o si ya se tomó la pastilla.

Memvia lo pone todo en una pantalla grande y sencilla. Un familiar o cuidador la prepara una vez, y la persona solo tiene que tocar.

## ✨ ¿Qué hace?

- 👨‍👩‍👧 **Familia:** la cara y el nombre de cada familiar. Al tocarlo, la app dice en voz alta quién es. Se puede llamar o escribir por WhatsApp con un botón.
- 🗺️ **Mapa:** muestra dónde vive cada familiar y cuánto se tarda **andando** desde casa, con los pasos del camino.
- 📅 **Mi día:** tareas con hora y avisos que suenan y salen en el móvil.
- 💊 **Medicación:** a qué hora toca cada pastilla y si ya se ha tomado.
- ❤️ **Recuerdos:** pequeñas historias de la familia.
- 🎮 **Juego «¿Quién es?»:** para ejercitar la memoria con las caras de la familia.
- 🆘 **Botón SOS:** llama a un familiar.
- 🔠 **Fácil de usar:** letra grande, botones grandes, modo simple y modo oscuro.

## 📸 Así se ve

<table>
<tr>
<td align="center"><img src="capturas/familia.png" width="200"><br><b>Familia</b><br>Caras y nombres</td>
<td align="center"><img src="capturas/mapa.png" width="200"><br><b>Mapa</b><br>Camino a pie</td>
<td align="center"><img src="capturas/medicacion.png" width="200"><br><b>Medicación</b><br>Pastillas y horas</td>
<td align="center"><img src="capturas/avisos-oscuro.png" width="200"><br><b>Avisos</b><br>En modo oscuro</td>
</tr>
</table>

## 🚀 Pruébala

1. Abre <https://alejandro22410.github.io/prueba/>
2. Pulsa **«Probar sin cuenta (demostración)»**. Son datos inventados, no hace falta registrarse.

**Instalarla en el móvil:**
- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.

## ☁️ ¿Qué es Firebase y para qué lo uso?

Firebase es un servicio de Google que uso en Memvia para guardar las **cuentas** y los **datos**. Gracias a eso, un familiar puede preparar todo desde su móvil y la persona lo ve en el suyo.

Yo me lo imagino como **una caja fuerte con llave para cada persona**: dentro están sus familiares, su medicación y sus recuerdos, y solo el dueño de la cuenta puede abrirla.

- **Quién ve los datos:** solo el dueño de la cuenta. Esa norma la puse en la propia base de datos.
- **Dónde se guardan:** en servidores de Google en Europa.
- **Control:** cada persona puede descargar sus datos o borrar su cuenta desde Ajustes.
- **Sin cuenta:** la demostración no usa Firebase, así que no se guarda nada fuera del aparato.
- **Lo que me falta:** los datos no están cifrados de extremo a extremo. Si se usara con pacientes de verdad, tendría que revisarlo con un adulto responsable.

## 🛠️ ¿Con qué lo he hecho?

Lo he hecho con **HTML** (la estructura), **CSS** (el diseño) y **JavaScript** (para que funcione). No uso ningún programa para compilarlo.

| Archivo | Lenguaje | Qué hace |
|---|---|---|
| `index.html` | HTML | Estructura: botones, pestañas y formularios |
| `privacidad.html` | HTML | La política de privacidad |
| `css/styles.css` | CSS | Diseño: colores, tamaños, modo oscuro |
| `js/app.js` | JavaScript | Lógica principal: familia, medicación, cuentas, demo |
| `js/mapa.js` | JavaScript | El mapa y los marcadores |
| `js/buscador.js` | JavaScript | El buscador de direcciones |
| `js/geo.js` | JavaScript | Busca direcciones y calcula las rutas a pie |
| `js/avisos.js` | JavaScript | Qué aviso toca, cuáles se perdieron y el calendario |
| `js/demo.js` | JavaScript | Los datos de ejemplo inventados |
| `js/config.js` | JavaScript | Datos de conexión con Firebase |
| `sw.js` | JavaScript | Que funcione sin internet y las notificaciones |
| `manifest.webmanifest` | JSON | Permite instalarla como app en el móvil |
| `firestore.rules` | Reglas de Firebase | Cada persona solo ve sus datos |

**Herramientas de otras personas que uso:** Leaflet (dibuja el mapa), OpenStreetMap (los mapas), Nominatim (buscar direcciones), OSRM (rutas a pie), Firebase (cuentas y datos) y Tabler Icons (iconos).

## 🔔 Los avisos

Las tareas y las pastillas avisan con voz y con notificación. Si pasa la hora y no se marca, aparece un cuadro «Se te ha pasado hoy».

Si la app está cerrada del todo, el móvil puede no avisar. Por eso se puede llevar los avisos al **calendario del móvil** (en Ajustes), que sí suena aunque Memvia esté cerrada.

## 🔒 Privacidad

- Cada persona solo ve **sus** datos.
- Se pide permiso explícito para guardar datos de salud, como la medicación.
- Se pueden **descargar** los datos o **borrar la cuenta** cuando se quiera.
- La demostración no guarda nada fuera del aparato.
- Más detalle en la [política de privacidad](privacidad.html).

## ⚠️ Límites

- Memvia **ayuda a recordar**, pero no es un sistema de seguridad ni sustituye a un cuidador o a un médico. En una emergencia, llama al 112.
- El mapa y las rutas necesitan internet, y las rutas son orientativas.
- Los avisos no son fiables si la app está cerrada del todo.
- Está probada con comprobaciones automáticas, pero todavía no con lectores de pantalla ni con personas reales.

## 🔭 Ideas futuras

- Avisos que suenen siempre, aunque la app esté cerrada.
- Videollamada al familiar desde su ficha.
- Que el cuidador cambie los datos desde su móvil y la persona los vea al momento.
- Más idiomas (catalán, inglés).

---

Hecho por **Alejandro Narvaez Jaime** (Codelearn Gava) para Coolest Projects.
