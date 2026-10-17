// Memvia · lógica pura de los avisos (sin tocar la pantalla, para poder probarla).
// - qué avisos tocan ahora y cuáles se han quedado atrás
// - qué avisos ya han sonado hoy (se guarda en este aparato, no en la nube)
// - exportar tareas y medicación a un archivo de calendario (.ics)

export const VENTANA_MIN = 10;          // un aviso "toca" durante 10 minutos desde su hora
const CLAVE_SONADOS = 'memvia_avisos_v1';

export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export function claveDia(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function mismoDia(iso, d) {
  if (!iso) return false;
  const t = new Date(iso);
  return !isNaN(t) && claveDia(t) === claveDia(d);
}

// Los ids creados desde la app son Date.now() en base 36: sirven para saber cuándo se creó cada aviso.
// Los ids de la demostración ("d-r1") no lo son: se tratan como antiguos.
export function creadoEn(id) {
  if (typeof id !== 'string' || !/^[0-9a-z]{8,10}$/.test(id)) return null;
  const t = parseInt(id, 36);
  return t > 1.5e12 && t < 4e12 ? t : null;
}

function horaComoFecha(hhmm, ahora) {
  const min = aMinutos(hhmm);
  const d = new Date(ahora); d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + min * 60000);
}

// Lista de avisos de hoy con su estado: 'ahora' (toca ya), 'perdido' (pasó y sigue sin hacerse) o null.
export function estadoAvisos(reminders, meds, ahora) {
  const lista = [];
  const enMin = ahora.getHours() * 60 + ahora.getMinutes();
  const consider = (tipo, item, hecho, texto, icono) => {
    const min = aMinutos(item.time);
    if (min === null || hecho) return;
    const pasado = enMin - min;
    if (pasado < 0) return;
    // Si se creó hoy después de su hora, no es un aviso perdido: nació tarde.
    const nacio = creadoEn(item.id);
    if (nacio && nacio > horaComoFecha(item.time, ahora).getTime()) return;
    lista.push({ tipo, id: item.id, time: item.time, texto, icono, estado: pasado < VENTANA_MIN ? 'ahora' : 'perdido' });
  };
  (reminders || []).forEach(r => consider('r', r, !!r.done, r.text, r.icon || '⏰'));
  (meds || []).forEach(m => consider('m', m, mismoDia(m.lastTaken, ahora), m.name, '💊'));
  return lista;
}

export function claveAviso(a) { return a.tipo + ':' + a.id; }

// ---- Avisos que ya han sonado hoy (localStorage; se vacía solo al cambiar de día) ----
export function cargarSonados(ahora, almacen) {
  try {
    const raw = JSON.parse((almacen || localStorage).getItem(CLAVE_SONADOS) || 'null');
    if (raw && raw.dia === claveDia(ahora) && Array.isArray(raw.claves)) return new Set(raw.claves);
  } catch (e) { /* ignorar */ }
  return new Set();
}
export function guardarSonados(ahora, set, almacen) {
  try { (almacen || localStorage).setItem(CLAVE_SONADOS, JSON.stringify({ dia: claveDia(ahora), claves: [...set] })); } catch (e) { /* ignorar */ }
}

// ---- Calendario (.ics) ----
function escapar(t) {
  return String(t == null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
// Las líneas de un .ics no pueden pasar de 75 bytes: se parten con un espacio al principio de la siguiente.
function plegar(linea) {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes = []; let actual = '', bytes = 0, limite = 75;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    if (bytes + b > limite) { partes.push(actual); actual = ''; bytes = 0; limite = 74; }
    actual += ch; bytes += b;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}
function fechaLocal(d, hhmm) {
  const min = aMinutos(hhmm);
  return claveDia(d).replace(/-/g, '') + 'T' + String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0') + '00';
}
function sello(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

// Cada tarea y cada medicamento se convierte en un evento diario con alarma a su hora.
export function crearICS(reminders, meds, ahora) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memvia//Avisos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Memvia'];
  let n = 0;
  const evento = (uid, time, titulo, descripcion) => {
    if (aMinutos(time) === null) return;
    n++;
    L.push('BEGIN:VEVENT',
      'UID:' + uid + '@memvia',
      'DTSTAMP:' + sello(ahora),
      'DTSTART:' + fechaLocal(ahora, time),
      'DURATION:PT15M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:' + escapar(titulo),
      'DESCRIPTION:' + escapar(descripcion),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapar(titulo), 'TRIGGER:PT0S', 'END:VALARM',
      'END:VEVENT');
  };
  (reminders || []).forEach(r => evento('r-' + r.id, r.time, (r.icon || '⏰') + ' ' + r.text, 'Aviso de Memvia'));
  (meds || []).forEach(m => evento('m-' + m.id, m.time, '💊 ' + m.name + (m.dose ? ' (' + m.dose + ')' : ''), 'Hora de tu medicación. Aviso de Memvia'));
  L.push('END:VCALENDAR');
  return { texto: L.map(plegar).join('\r\n') + '\r\n', eventos: n };
}
