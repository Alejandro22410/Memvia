// Memvia · seguridad de los datos (sin tocar la pantalla, para poder probarla).
// - escapar: convierte texto en algo seguro para meter en el HTML, también dentro de comillas
// - limpiarEstado: revisa los datos que llegan de la nube, del navegador o de una copia de seguridad
// - mensajeAuth: traduce los errores de Firebase sin dar pistas de si un correo existe

const MAX_LISTA = 200;

export function escapar(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;');
}

const txt = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, min, max) => (typeof v === 'number' && isFinite(v) && v >= min && v <= max ? v : null);
const FOTO_OK = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function telefonoLimpio(v) { return typeof v === 'string' && /^[0-9+()\-\s.]{0,25}$/.test(v) ? v.trim() : ''; }
export function fotoSegura(v) {
  if (typeof v !== 'string' || !v) return '';
  if (FOTO_OK.test(v) && v.length <= 900000) return v;
  if (/^https:\/\/[^\s"'()<>\\]{1,300}$/.test(v)) return v;
  return '';
}

// Campos desconocidos: se conservan solo si son números, booleanos o textos cortos (nunca objetos).
function extras(o, conocidos) {
  const out = {};
  for (const k of Object.keys(o)) {
    if (conocidos.includes(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const v = o[k];
    if (typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 300);
  }
  return out;
}
const lista = (v) => (Array.isArray(v) ? v.slice(0, MAX_LISTA).filter(x => x && typeof x === 'object' && !Array.isArray(x)) : []);
const id = (v) => (typeof v === 'string' && v.length <= 60 ? v : String(Math.random()).slice(2, 12));
const hora = (v) => (typeof v === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');
const fechaIso = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v.slice(0, 40) : '');

function familiar(f) {
  const k = ['id', 'name', 'relation', 'phone', 'address', 'photo', 'birthday', 'note', 'icon', 'lat', 'lng', 'primary'];
  return {
    ...extras(f, k),
    id: id(f.id), name: txt(f.name, 60), relation: txt(f.relation, 40), phone: telefonoLimpio(f.phone),
    address: txt(f.address, 250), photo: fotoSegura(f.photo),
    birthday: /^\d{4}-\d{2}-\d{2}$/.test(f.birthday || '') ? f.birthday : '',
    note: txt(f.note, 400), icon: txt(f.icon, 8), lat: num(f.lat, -90, 90), lng: num(f.lng, -180, 180), primary: !!f.primary
  };
}
function lugar(p) {
  const k = ['id', 'name', 'category', 'address', 'lat', 'lng'];
  return { ...extras(p, k), id: id(p.id), name: txt(p.name, 60), category: txt(p.category, 30), address: txt(p.address, 250), lat: num(p.lat, -90, 90), lng: num(p.lng, -180, 180) };
}
function tarea(r) {
  const k = ['id', 'text', 'time', 'icon', 'done'];
  return { ...extras(r, k), id: id(r.id), text: txt(r.text, 200), time: hora(r.time), icon: txt(r.icon, 8), done: !!r.done };
}
function medicamento(m) {
  const k = ['id', 'name', 'dose', 'time', 'history', 'lastTaken'];
  return {
    ...extras(m, k), id: id(m.id), name: txt(m.name, 100), dose: txt(m.dose, 100), time: hora(m.time),
    history: Array.isArray(m.history) ? m.history.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(-10) : [],
    lastTaken: fechaIso(m.lastTaken)
  };
}
function recuerdo(m) {
  const k = ['id', 'title', 'text'];
  return { ...extras(m, k), id: id(m.id), title: txt(m.title, 100), text: txt(m.text, 1500) };
}

// ---- PIN de los Ajustes: nunca se guarda el número, solo una "huella" con sal ----
export const pinValido = (p) => typeof p === 'string' && /^\d{4,6}$/.test(p);
export function pinLimpio(v) {
  return v && typeof v === 'object' && typeof v.salt === 'string' && typeof v.hash === 'string'
    && /^[0-9a-f]{32}$/.test(v.salt) && /^[0-9a-f]{64}$/.test(v.hash) ? { salt: v.salt, hash: v.hash } : null;
}
const aHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export function nuevaSal() { return aHex(crypto.getRandomValues(new Uint8Array(16))); }
export async function hashPin(pin, sal) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: 100000 }, clave, 256);
  return aHex(bits);
}
export async function crearPin(pin) { const salt = nuevaSal(); return { salt, hash: await hashPin(pin, salt) }; }
export async function comprobarPin(pin, guardado) { return !!guardado && (await hashPin(pin, guardado.salt)) === guardado.hash; }

export function limpiarEstado(s) {
  s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  const h = s.home && typeof s.home === 'object' ? s.home : null;
  const lat = h ? num(h.lat, -90, 90) : null, lng = h ? num(h.lng, -180, 180) : null;
  const c = s.consent;
  return {
    family: lista(s.family).map(familiar),
    home: h && lat !== null && lng !== null ? { address: txt(h.address, 250), lat, lng } : null,
    fsScale: typeof s.fsScale === 'number' && s.fsScale >= 0.8 && s.fsScale <= 3 ? s.fsScale : 1,
    reminders: lista(s.reminders).map(tarea),
    meds: lista(s.meds).map(medicamento),
    places: lista(s.places).map(lugar),
    memories: lista(s.memories).map(recuerdo),
    userName: txt(s.userName, 60),
    simpleMode: !!s.simpleMode,
    theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    pin: pinLimpio(s.pin),
    consent: c && typeof c.version === 'string' && typeof c.at === 'string' ? { version: c.version.slice(0, 20), at: c.at.slice(0, 40) } : null
  };
}

// Mensajes de Firebase Auth en español. Los de "usuario no existe" y "contraseña mal" son el mismo,
// para que nadie pueda averiguar qué correos tienen cuenta.
export function mensajeAuth(err, accion) {
  const c = (err && err.code) || '';
  if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(c)) return 'El correo o la contraseña no son correctos.';
  if (c === 'auth/invalid-email') return 'Ese correo no parece válido.';
  if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (c === 'auth/network-request-failed') return 'No hay conexión. Comprueba internet y prueba otra vez.';
  if (c === 'auth/email-already-in-use') return 'No se pudo crear la cuenta con esos datos. Si ya tienes una, pulsa «Entrar».';
  if (c === 'auth/weak-password') return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
  if (c === 'auth/user-disabled') return 'Esta cuenta está desactivada.';
  return (accion === 'crear' ? 'No se pudo crear la cuenta.' : 'No se pudo entrar.') + (c ? ' (' + c + ')' : '');
}

export function contrasenaValida(pass, email) {
  if (typeof pass !== 'string' || pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (email && pass.toLowerCase() === String(email).toLowerCase()) return 'La contraseña no puede ser igual que el correo.';
  if (/^(.)\1+$/.test(pass) || /^(12345678|password|contraseña|qwertyui)/i.test(pass)) return 'Esa contraseña es demasiado fácil de adivinar.';
  return '';
}
