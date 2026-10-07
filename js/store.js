// Almacenamiento local de Memvia.
// Todo se guarda en este dispositivo (localStorage). No se envía a ningún servidor.

const CLAVE = 'memvia.datos.v1';

export const TONOS = [155, 210, 275, 335, 15, 185];
export const NOMBRES_TONO = ['Verde', 'Azul', 'Violeta', 'Rosa', 'Coral', 'Turquesa'];

export const vacio = () => ({
  version: 1,
  usuario: '',
  casa: null, // { direccion, lat, lng }
  personas: [], // { id, nombre, rel, tono, nota, direccion, lat|null, lng|null }
  ajustes: { tamano: 0, tema: null }
});

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const coord = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

function lugar(o) {
  if (!o || typeof o !== 'object') return null;
  const direccion = texto(o.direccion, 300);
  if (!direccion) return null;
  const lat = coord(o.lat, -90, 90);
  const lng = coord(o.lng, -180, 180);
  return { direccion, lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null };
}

/** Devuelve los datos limpios o null si el objeto no sirve. */
export function validar(d) {
  if (!d || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.personas)) return null;
  const out = vacio();
  out.usuario = texto(d.usuario, 30);
  const casa = lugar(d.casa);
  out.casa = casa && casa.lat !== null ? casa : null;
  const ids = new Set();
  for (const p of d.personas.slice(0, 60)) {
    if (!p || typeof p !== 'object') continue;
    const l = lugar(p);
    const nombre = texto(p.nombre, 24);
    if (!l || !nombre) continue;
    let id = texto(p.id, 40) || 'p' + Math.random().toString(36).slice(2, 9);
    while (ids.has(id)) id += 'x';
    ids.add(id);
    out.personas.push({
      id,
      nombre,
      rel: texto(p.rel, 30) || 'Familiar',
      tono: TONOS.includes(p.tono) ? p.tono : TONOS[0],
      nota: texto(p.nota, 120),
      ...l
    });
  }
  const a = d.ajustes || {};
  out.ajustes.tamano = [0, 1, 2].includes(a.tamano) ? a.tamano : 0;
  out.ajustes.tema = a.tema === 'light' || a.tema === 'dark' ? a.tema : null;
  return out;
}

export function cargar() {
  try {
    return validar(JSON.parse(localStorage.getItem(CLAVE))) || vacio();
  } catch (e) {
    return vacio();
  }
}

/** Devuelve true si se pudo guardar. */
export function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch (e) {
    return false;
  }
}

export function borrar() {
  try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
}

export const nuevoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
