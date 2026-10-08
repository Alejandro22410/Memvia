# Memvia · Tu gente, siempre cerca

Memvia es una app para personas con alzheimer. Muestra a la familia con su cara y su nombre, dice quién es cada persona y **dónde vive**, en un mapa real, con el camino a pie desde casa. También ayuda con la medicación, las tareas del día y los recuerdos.

Proyecto para **Coolest Projects**.

## Qué hace

- **Familia**: foto (o icono), nombre, parentesco y una frase especial. Un toque y la app lo lee en voz alta. Llamada y WhatsApp con un botón.
- **Mapa real** (OpenStreetMap): casa de cada familiar y lugares importantes (farmacia, centro de salud...). Al tocar uno se ve cuánto se tarda **andando** y los pasos del camino, escritos en español. También hay un **esquema** sencillo de distancias que funciona sin internet.
- **Mi día**: recordatorios con hora y aviso.
- **Medicación**: horarios y registro de tomas.
- **Recuerdos**: pequeñas historias de la familia.
- **Juego**: "¿Quién es?", para ejercitar la memoria con las caras de la familia.
- **SOS**: llama a un familiar.
- **Hecha para leer fácil**: modo simple, letra grande, tema claro / oscuro / automático, botones grandes.
- **Cuentas** (Firebase): un cuidador puede preparar los datos y la persona los ve en su dispositivo.
- **Modo demostración**: se prueba sin cuenta, con datos inventados que solo se guardan en ese dispositivo.
- **Se instala como app** (PWA) en el móvil, y abre sin internet para ver lo ya guardado.

## Probarla

Online (GitHub Pages): activa Pages en el repositorio (Settings → Pages → rama `main`, carpeta `/ (root)`). La dirección será `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

En tu ordenador, con cualquier servidor estático:

```bash
python3 -m http.server 8080      # o: npx serve
```

y abre http://localhost:8080. No hay paso de compilación.

Pulsa **Probar sin cuenta (demostración)** para verla funcionando.

### Instalarla como app

- **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari)**: Compartir → *Añadir a pantalla de inicio*.
- **APK**: en <https://www.pwabuilder.com> pega la dirección https de la app y descarga el paquete para Android.

## Poner tu propia cuenta de Firebase

1. En <https://console.firebase.google.com> crea un proyecto, activa **Authentication → Correo y contraseña** y **Firestore**.
2. Copia la configuración web en `js/config.js`.
3. En Firestore → Reglas, pega el contenido de `firestore.rules`. Así cada persona solo puede leer y escribir **sus** datos.
4. En Authentication → Configuración → Dominios autorizados, añade el dominio donde publiques la app.

## Archivos

| Archivo | Función |
| --- | --- |
| `index.html` | Pantallas y diálogos |
| `css/styles.css` | Diseño, temas claro y oscuro, tamaños táctiles |
| `js/app.js` | Lógica: familia, mapa, rutas, medicación, cuentas, modo demo |
| `js/mapa.js` | Mapa Leaflet y marcadores |
| `js/buscador.js` | Buscador de direcciones (elige tú el resultado correcto) |
| `js/geo.js` | Direcciones (Nominatim) y rutas a pie (OSRM), con ruta aproximada si falla |
| `js/demo.js` | Datos de ejemplo inventados |
| `js/config.js` | Configuración de Firebase |
| `sw.js`, `manifest.webmanifest` | Instalación y modo sin conexión |
| `firestore.rules` | Reglas de seguridad de la base de datos |

## Privacidad

- Con cuenta, los datos (nombres, fotos, direcciones, medicación) se guardan en Firebase, en un documento por usuario protegido por las reglas.
- En modo demostración, nada sale del dispositivo.
- Para buscar una dirección, el texto se envía a Nominatim (OpenStreetMap). Para calcular una ruta, las coordenadas de la casa y del familiar se envían a FOSSGIS. Nada más.
- Usa datos inventados o permiso de la familia en las demos públicas.

## Límites

- Memvia ayuda a recordar y orientarse. **No es un sistema de seguridad** ni sustituye a un cuidador.
- Las fotos se guardan dentro del documento de Firestore, que admite cerca de 1 MB. Con muchas fotos grandes la app avisa y no guarda.
- Los servicios gratuitos de OpenStreetMap, Nominatim y FOSSGIS son para poco volumen. La app busca solo al pulsar el botón y espera entre búsquedas.
- Los pasos de la ruta se traducen al español con reglas sencillas; algunas calles pueden sonar raras.
- El mapa, las búsquedas y las rutas necesitan internet.

## Créditos

[OpenStreetMap](https://www.openstreetmap.org/copyright) · [Nominatim](https://nominatim.org) · [FOSSGIS OSRM](https://routing.openstreetmap.de) · [Leaflet](https://leafletjs.com) · [Firebase](https://firebase.google.com) · [Tabler Icons](https://tabler.io/icons) · Fuentes Fraunces y Nunito (Google Fonts).
