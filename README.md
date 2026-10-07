# Memvia

App para personas mayores con alzheimer. Muestra a la familia como caras (iniciales y color, sin fotos) conectadas a un mapa real con la casa de cada una. Al tocar una cara se ve quién es, su dirección, cuánto se tarda andando desde casa y cómo llegar, y se puede escuchar en voz alta.

No necesita instalar nada: son archivos estáticos (HTML, CSS y JavaScript).

## Probarla en tu ordenador

```bash
cd memvia
python3 -m http.server 8080
```

Abre http://localhost:8080. Sirve cualquier otro servidor estático (`npx serve`, la extensión Live Server de VS Code...). Hace falta conexión a internet para el mapa, las direcciones y las rutas.

Al abrirla por primera vez, un familiar o cuidador escribe la dirección de la casa y pulsa **Buscar**. Con **Probar con datos de ejemplo** se carga un barrio de lugares públicos de Madrid para verla funcionando.

## Usarla en el móvil

Para instalarla en el móvil (Añadir a pantalla de inicio) necesita una dirección https. La forma más fácil es subir esta carpeta tal cual a Netlify Drop, Cloudflare Pages o GitHub Pages. No hay paso de compilación.

Una vez abierta con https, también funciona sin conexión para ver lo ya guardado. El mapa, las búsquedas y las rutas siempre necesitan internet.

## Qué hace cada parte

| Archivo | Función |
| --- | --- |
| `index.html` | Estructura de la pantalla y los diálogos |
| `css/styles.css` | Diseño: colores, letra, modo oscuro, tamaños táctiles |
| `js/app.js` | Pantallas y eventos: familia, detalle, ajustes, copia de seguridad |
| `js/store.js` | Guardado en el dispositivo y validación de datos |
| `js/geo.js` | Búsqueda de direcciones y rutas a pie, con ruta aproximada si falla el servicio |
| `js/map.js` | Mapa con Leaflet y marcadores |
| `sw.js`, `manifest.webmanifest` | Instalación y modo sin conexión |

## Datos y privacidad

- Todo se guarda solo en este dispositivo (`localStorage`). No hay servidor ni cuenta.
- Para buscar una dirección, el texto que escribes se envía a Nominatim (OpenStreetMap). Para calcular rutas, se envían las coordenadas de la casa y del familiar a FOSSGIS. No se envía nada más.
- La copia de seguridad (Ajustes, Descargar copia) es un archivo con direcciones exactas. Guárdalo en un sitio seguro.
- Borrar los datos del navegador borra la app. Haz una copia de vez en cuando.

## Límites conocidos

- Los servicios gratuitos de OpenStreetMap, Nominatim y FOSSGIS son para uso personal y de poco volumen. La app busca solo al pulsar el botón y espera un segundo entre búsquedas, como pide Nominatim. Si Memvia llega a mucha gente, hay que contratar o alojar un servicio de mapas y direcciones.
- Los datos no se sincronizan entre dispositivos. Para que un cuidador edite desde su móvil y lo vea la persona en su tableta hace falta un servidor y cuentas.
- Los pasos de la ruta vienen de OSRM y se traducen al español con reglas simples. Revisa algunas rutas reales antes de confiar en ellas.
- Memvia ayuda a recordar y orientarse. No es un sistema de seguridad ni sustituye a un cuidador.
- Leaflet se carga desde unpkg.com. Para no depender de ese servicio, descarga `leaflet.js` y `leaflet.css` (versión 1.9.4) a una carpeta `vendor/` y cambia las dos líneas de `index.html`.

## Siguientes pasos posibles

1. Sincronizar entre dispositivos con una cuenta de cuidador.
2. Fotos opcionales, además de las iniciales.
3. Llamar o videollamar al familiar desde su tarjeta.
4. Un recordatorio con voz de las visitas del día.
