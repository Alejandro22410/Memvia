// Capa de mapa con Leaflet. Si Leaflet no carga (sin internet), la app sigue
// funcionando y el mapa muestra un aviso en su lugar.

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const MARCA_CASA = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2 1 12h3v9h6v-6h4v6h6v-9h3z"/></svg>';

export function crearMapa(contenedor, alElegir) {
  const L = window.L;
  if (!L) {
    contenedor.innerHTML = '<p class="sin-mapa">No se pudo cargar el mapa. Comprueba la conexión a internet y recarga la página. Mientras tanto, cada familiar tiene un enlace para abrir su casa en otro mapa.</p>';
    return { disponible: false, actualizar() {}, ruta() {}, ajustar() {}, invalidar() {} };
  }

  const mapa = L.map(contenedor, { zoomControl: true, minZoom: 3, maxZoom: 19 }).setView([40.4168, -3.7038], 6);
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mapa);
  const capaPins = L.layerGroup().addTo(mapa);
  const capaRuta = L.layerGroup().addTo(mapa);
  let puntos = [];
  let seleccion = null;

  const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

  function marcador(p, esCasa, activo, atenuado) {
    const inicial = ([...p.nombre][0] || '?').toUpperCase();
    const div = document.createElement('div');
    div.className = 'mk' + (esCasa ? ' casa' : '') + (activo ? ' sel' : '') + (atenuado ? ' dim' : '');
    div.style.setProperty('--h', p.tono || 155);
    if (esCasa) div.innerHTML = MARCA_CASA;
    else div.textContent = inicial;
    const icono = L.divIcon({ className: 'pin-wrap', html: div.outerHTML, iconSize: [52, 66], iconAnchor: [26, 64] });
    const m = L.marker([p.lat, p.lng], {
      icon: icono,
      title: esCasa ? 'Tu casa' : p.nombre,
      alt: esCasa ? 'Tu casa' : `${p.nombre}, ${p.rel}`,
      keyboard: true,
      zIndexOffset: esCasa ? 500 : activo ? 1000 : 0
    });
    const etiqueta = document.createElement('span');
    etiqueta.textContent = esCasa ? 'Tu casa' : p.nombre;
    m.bindTooltip(etiqueta, { permanent: true, direction: 'bottom', offset: [0, 4], className: 'mk-name' });
    if (!esCasa) m.on('click', () => alElegir(p.id));
    return m;
  }

  return {
    disponible: true,

    /** Dibuja la casa y los familiares que tienen posición. */
    actualizar(casa, personas, sel) {
      seleccion = sel;
      capaPins.clearLayers();
      puntos = [];
      if (casa) {
        marcador({ ...casa, nombre: 'Tu casa', rel: '' }, true, false, false).addTo(capaPins);
        puntos.push({ id: 'casa', lat: casa.lat, lng: casa.lng });
      }
      for (const p of personas) {
        if (p.lat === null) continue;
        marcador(p, false, p.id === sel, !!sel && p.id !== sel).addTo(capaPins);
        puntos.push({ id: p.id, lat: p.lat, lng: p.lng });
      }
    },

    /** linea: [[lat, lng], ...] o null para quitarla. */
    ruta(linea) {
      capaRuta.clearLayers();
      if (!linea || linea.length < 2) return;
      L.polyline(linea, { color: css('--halo') || '#fff', weight: 14, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaRuta);
      L.polyline(linea, { color: css('--accent') || '#0B6E6E', weight: 7, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaRuta);
    },

    /** Encuadra la casa y al familiar elegido, o a todos. */
    ajustar(animar = true) {
      const usar = seleccion ? puntos.filter((p) => p.id === 'casa' || p.id === seleccion) : puntos;
      if (!usar.length) return;
      const limites = L.latLngBounds(usar.map((p) => [p.lat, p.lng]));
      const opciones = { padding: [60, 60], maxZoom: 17 };
      if (animar && !sinMovimiento()) mapa.flyToBounds(limites, { ...opciones, duration: 0.8 });
      else mapa.fitBounds(limites, { ...opciones, animate: false });
    },

    invalidar() { mapa.invalidateSize(); }
  };
}
