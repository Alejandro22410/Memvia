// Direcciones (Nominatim) y rutas a pie (FOSSGIS/OSRM), con plan B sin conexión.
//
// Nominatim pide: una búsqueda por segundo como máximo y nada de autocompletar.
// Por eso solo se busca cuando se pulsa "Buscar".

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const RUTA_A_PIE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

// Ritmo tranquilo para personas mayores: 60 metros por minuto (3,6 km/h).
export const METROS_POR_MINUTO = 60;

const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function formatoDistancia(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${fmt.format(m / 1000)} km`;
}

export const minutosAndando = (m) => Math.max(1, Math.round(m / METROS_POR_MINUTO));

/** En España el número va detrás de la calle: "Calle Mayor, 12". */
function ordenarDireccion(displayName) {
  const partes = displayName.split(',').map((s) => s.trim()).filter(Boolean);
  if (partes.length > 1 && /^\d+[a-zA-Z]?$/.test(partes[0])) {
    return [`${partes[1]}, ${partes[0]}`, ...partes.slice(2)].join(', ');
  }
  return partes.join(', ');
}

/** Dos primeras partes de la dirección, para mostrar corto. */
export function corta(direccion) {
  return direccion.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', ');
}

let ultima = 0;

export async function buscarDireccion(consulta, signal) {
  const espera = 1100 - (Date.now() - ultima);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const url = `${NOMINATIM}?format=jsonv2&limit=5&accept-language=es&q=${encodeURIComponent(consulta)}`;
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('nominatim ' + r.status);
  const j = await r.json();
  return j
    .map((x) => ({ direccion: ordenarDireccion(String(x.display_name || '')), lat: Number(x.lat), lng: Number(x.lon) }))
    .filter((x) => x.direccion && Number.isFinite(x.lat) && Number.isFinite(x.lng));
}

/* ---------- Rutas ---------- */

const rad = (g) => (g * Math.PI) / 180;

export function haversine(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rumbo(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const PUNTOS = ['el norte', 'el noreste', 'el este', 'el sureste', 'el sur', 'el suroeste', 'el oeste', 'el noroeste'];
const cardinal = (grados) => PUNTOS[Math.round(grados / 45) % 8];

function aproximada(a, b) {
  const metros = haversine(a, b) * 1.25; // las calles rodean las manzanas
  return {
    metros,
    linea: [[a.lat, a.lng], [b.lat, b.lng]],
    aproximada: true,
    pasos: [
      { flecha: '↑', texto: `Camina hacia ${cardinal(rumbo(a, b))}, unos ${formatoDistancia(metros)}.` },
      { flecha: '•', texto: 'Has llegado.', fin: true }
    ]
  };
}

const LADO = {
  left: ['←', 'a la izquierda'],
  'slight left': ['←', 'ligeramente a la izquierda'],
  'sharp left': ['←', 'cerrando a la izquierda'],
  right: ['→', 'a la derecha'],
  'slight right': ['→', 'ligeramente a la derecha'],
  'sharp right': ['→', 'cerrando a la derecha'],
  straight: ['↑', 'recto'],
  uturn: ['↓', 'dando la vuelta']
};

/** Convierte los pasos de OSRM a frases cortas en español. */
export function pasosEnEspanol(pasos) {
  const out = [];
  for (const s of pasos || []) {
    const m = s.maneuver || {};
    const calle = s.name ? ` por ${s.name}` : '';
    const dist = s.distance > 0 ? ` Sigue ${formatoDistancia(s.distance)}.` : '';
    const lado = LADO[m.modifier] || ['↑', 'recto'];
    if (m.type === 'arrive') {
      out.push({ flecha: '•', texto: 'Has llegado.', fin: true });
    } else if (m.type === 'depart') {
      out.push({ flecha: '↑', texto: `Sal hacia ${cardinal(m.bearing_after || 0)}${calle}.${dist}` });
    } else if (m.type === 'roundabout' || m.type === 'rotary') {
      out.push({ flecha: '↻', texto: `En la rotonda, toma la salida ${m.exit || 1}${calle}.${dist}` });
    } else if (m.type === 'new name' || m.type === 'continue') {
      if (m.modifier && m.modifier !== 'straight') out.push({ flecha: lado[0], texto: `Sigue ${lado[1]}${calle}.${dist}` });
      else out.push({ flecha: '↑', texto: `Sigue${calle || ' recto'}.${dist}` });
    } else {
      out.push({ flecha: lado[0], texto: m.modifier === 'straight' ? `Sigue recto${calle}.${dist}` : `Gira ${lado[1]}${calle}.${dist}` });
    }
  }
  return out;
}

export async function calcularRuta(a, b, signal) {
  try {
    const url = `${RUTA_A_PIE}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=true`;
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('ruta ' + r.status);
    const j = await r.json();
    const ruta = j.routes && j.routes[0];
    if (!ruta || !ruta.geometry) throw new Error('sin ruta');
    const pasos = pasosEnEspanol(ruta.legs && ruta.legs[0] ? ruta.legs[0].steps : []);
    return {
      metros: ruta.distance,
      linea: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      pasos: pasos.length ? pasos : aproximada(a, b).pasos,
      aproximada: false
    };
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    return aproximada(a, b);
  }
}

export const enlaceMapa = (p) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
export const enlaceRuta = (a, b) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${a.lat}%2C${a.lng}%3B${b.lat}%2C${b.lng}`;
