// Buscador de direcciones: el usuario escribe, pulsa Buscar y elige una opción.
// Así la casa de cada familiar queda en un punto exacto del mapa, sin que la
// app adivine por su cuenta cuál de varias calles iguales era.

import { buscarDireccion } from './geo.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {string} prefijo      Para ids únicos (ej. "fa")
 * @param {string} etiqueta     Texto sobre el campo
 * @param {string} ayuda        Texto de ayuda cuando no hay nada elegido
 */
export function crearBuscador(prefijo, etiqueta, ayuda = '') {
  const cont = document.createElement('div');
  cont.className = 'addr-search';
  cont.innerHTML =
    `<label class="f-label" for="${prefijo}-q">${esc(etiqueta)}</label>` +
    `<div class="addr-row"><input id="${prefijo}-q" type="text" autocomplete="off" maxlength="200" placeholder="Calle, número y ciudad">` +
    `<button class="secondary-btn addr-go" type="button" id="${prefijo}-go"><i class="ti ti-search" aria-hidden="true"></i>Buscar</button></div>` +
    `<p class="hint-text addr-status" id="${prefijo}-st" role="status"></p>` +
    `<ul class="addr-results" id="${prefijo}-res"></ul>`;

  const entrada = cont.querySelector(`#${prefijo}-q`);
  const boton = cont.querySelector(`#${prefijo}-go`);
  const estado = cont.querySelector(`#${prefijo}-st`);
  const lista = cont.querySelector(`#${prefijo}-res`);
  let elegida = null;
  let hallados = [];
  let control = null;

  const textoAyuda = () => { estado.textContent = ayuda; estado.classList.remove('ok'); };
  textoAyuda();

  entrada.addEventListener('input', () => {
    if (elegida && entrada.value.trim() !== elegida.direccion) { elegida = null; textoAyuda(); }
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
  boton.addEventListener('click', buscar);
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    elegida = hallados[Number(b.dataset.i)];
    entrada.value = elegida.direccion;
    lista.innerHTML = '';
    estado.textContent = '📍 Dirección elegida. Quedará marcada en el mapa.';
    estado.classList.add('ok');
  });

  async function buscar() {
    const texto = entrada.value.trim();
    if (texto.length < 4) { estado.textContent = 'Escribe la calle, el número y la ciudad.'; estado.classList.remove('ok'); return; }
    if (control) control.abort();
    control = new AbortController();
    boton.disabled = true;
    estado.textContent = 'Buscando…';
    estado.classList.remove('ok');
    lista.innerHTML = '';
    try {
      hallados = await buscarDireccion(texto, control.signal);
      if (!hallados.length) {
        estado.textContent = 'No encuentro esa dirección. Prueba a añadir la ciudad o a quitar el piso.';
      } else {
        estado.textContent = 'Elige la dirección correcta:';
        lista.innerHTML = hallados
          .map((h, i) => `<li><button type="button" class="addr-result" data-i="${i}">${esc(h.direccion)}</button></li>`)
          .join('');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      estado.textContent = 'No se pudo buscar. Comprueba la conexión e inténtalo de nuevo.';
    } finally {
      boton.disabled = false;
    }
  }

  return {
    el: cont,
    /** { direccion, lat, lng } con lat/lng null si solo hay texto; null si está vacío. */
    valor() {
      if (elegida) return { ...elegida };
      const t = entrada.value.trim();
      return t ? { direccion: t, lat: null, lng: null } : null;
    },
    /** v: { direccion, lat, lng } o null. */
    poner(v) {
      elegida = v && typeof v.lat === 'number' && typeof v.lng === 'number' ? { ...v } : null;
      entrada.value = v && v.direccion ? v.direccion : '';
      lista.innerHTML = '';
      if (elegida) { estado.textContent = '📍 Dirección elegida. Quedará marcada en el mapa.'; estado.classList.add('ok'); }
      else if (v && v.direccion) { estado.textContent = 'Esta dirección no está en el mapa. Pulsa Buscar para ubicarla.'; estado.classList.remove('ok'); }
      else textoAyuda();
    },
    limpiar() { this.poner(null); }
  };
}
