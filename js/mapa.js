// Mapa real con Leaflet y OpenStreetMap.
// Si Leaflet no carga (sin internet), la app sigue funcionando: el mapa muestra
// un aviso y quedan el esquema de distancias y los enlaces a Google Maps.

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const SIN_MOVIMIENTO = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CASA_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 2 1 12h3v9h6v-6h4v6h6v-9h3z"/></svg>';
const FOTO_VALIDA = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const iniciales = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/**
 * @param {HTMLElement} contenedor
 * @param {(tipo: string, id: string) => void} alElegir  Se llama al tocar un marcador
 */
export function crearMapa(contenedor, alElegir) {
  const L = window.L;
  if (!L) {
    contenedor.innerHTML = '<p class="map-offline">No se pudo cargar el mapa. Comprueba la conexión a internet y recarga la página. Mientras tanto puedes usar el <strong>Esquema</strong> y el botón <strong>Cómo llegar</strong> de cada tarjeta.</p>';
    return { disponible: false, actualizar() {}, ruta() {}, ajustar() {}, invalidar() {} };
  }

  const mapa = L.map(contenedor, { minZoom: 3, maxZoom: 19, zoomControl: true }).setView([40.4168, -3.7038], 6);
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mapa);
  const capaPines = L.layerGroup().addTo(mapa);
  const capaRuta = L.layerGroup().addTo(mapa);
  let puntos = [];
  let elegido = null;

  const css = (v) => getComputedStyle(document.getElementById('app') || document.documentElement).getPropertyValue(v).trim();

  function pin(t, esCasa, activo, atenuado) {
    const d = document.createElement('div');
    d.className = 'mv-pin' + (esCasa ? ' home' : '') + (activo ? ' sel' : '') + (atenuado ? ' dim' : '');
    if (!esCasa) {
      d.style.setProperty('--pin-bg', t.style.bg);
      d.style.setProperty('--pin-fg', t.style.text);
      if (t.photo && FOTO_VALIDA.test(t.photo)) {
        const img = document.createElement('img');
        img.src = t.photo;
        img.alt = '';
        d.appendChild(img);
      } else {
        d.textContent = t.icon || iniciales(t.name);
      }
    } else {
      d.innerHTML = CASA_SVG;
    }
    const icono = L.divIcon({ className: 'mv-pin-wrap', html: d.outerHTML, iconSize: [52, 66], iconAnchor: [26, 64] });
    const m = L.marker([t.lat, t.lng], {
      icon: icono,
      title: esCasa ? 'Tu casa' : t.name,
      alt: esCasa ? 'Tu casa' : `${t.name}, ${t.sub || ''}`,
      keyboard: true,
      zIndexOffset: esCasa ? 500 : activo ? 1000 : 0
    });
    const etiqueta = document.createElement('span');
    etiqueta.textContent = esCasa ? 'Tu casa' : t.name;
    m.bindTooltip(etiqueta, { permanent: true, direction: 'bottom', offset: [0, 4], className: 'mv-pin-name' });
    if (!esCasa) m.on('click', () => alElegir(t.kind, t.id));
    return m;
  }

  return {
    disponible: true,

    /** casa: {lat,lng}|null · destinos: [{kind,id,name,sub,lat,lng,style,icon,photo}] · sel: {kind,id}|null */
    actualizar(casa, destinos, sel) {
      elegido = sel;
      capaPines.clearLayers();
      puntos = [];
      if (casa) {
        pin({ lat: casa.lat, lng: casa.lng, name: 'Tu casa' }, true, false, false).addTo(capaPines);
        puntos.push({ casa: true, lat: casa.lat, lng: casa.lng });
      }
      for (const t of destinos) {
        const activo = !!sel && sel.kind === t.kind && sel.id === t.id;
        pin(t, false, activo, !!sel && !activo).addTo(capaPines);
        puntos.push({ kind: t.kind, id: t.id, lat: t.lat, lng: t.lng });
      }
    },

    /** linea: [[lat,lng],...] o null para quitarla. */
    ruta(linea) {
      capaRuta.clearLayers();
      if (!linea || linea.length < 2) return;
      L.polyline(linea, { color: css('--surface-1') || '#fff', weight: 14, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaRuta);
      L.polyline(linea, { color: css('--brand-1') || '#5B3FD0', weight: 7, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(capaRuta);
    },

    /** Encuadra la casa y lo elegido, o todo si no hay nada elegido. */
    ajustar(animar = true) {
      const usar = elegido ? puntos.filter((p) => p.casa || (p.kind === elegido.kind && p.id === elegido.id)) : puntos;
      if (!usar.length) return;
      const limites = L.latLngBounds(usar.map((p) => [p.lat, p.lng]));
      const op = { padding: [60, 60], maxZoom: 17 };
      if (animar && !SIN_MOVIMIENTO()) mapa.flyToBounds(limites, { ...op, duration: 0.8 });
      else mapa.fitBounds(limites, { ...op, animate: false });
    },

    invalidar() { mapa.invalidateSize(); }
  };
}
