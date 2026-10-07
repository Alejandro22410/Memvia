import { cargar, guardar, borrar, validar, vacio, nuevoId, TONOS, NOMBRES_TONO } from './store.js';
import { buscarDireccion, calcularRuta, corta, formatoDistancia, minutosAndando, haversine, enlaceMapa, enlaceRuta } from './geo.js';
import { crearMapa } from './map.js';

const $ = (s, p = document) => p.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const inicial = (n) => ([...String(n).trim()][0] || '?').toUpperCase();
const mostrar = (el, si) => { el.hidden = !si; };

/* ---------- Datos de ejemplo (lugares públicos de Madrid) ---------- */
const EJEMPLO = {
  version: 1,
  usuario: 'Antonia',
  casa: { direccion: 'Puerta del Sol, Madrid', lat: 40.41692, lng: -3.70351 },
  personas: [
    { id: 'e-marta', nombre: 'Marta', rel: 'Tu hija', tono: 155, nota: 'Te llama cada mañana. Trabaja en la farmacia.', direccion: 'Plaza Mayor, Madrid', lat: 40.41537, lng: -3.7074 },
    { id: 'e-lucia', nombre: 'Lucía', rel: 'Tu nieta', tono: 335, nota: 'Le encanta que le cuentes cómo era el pueblo.', direccion: 'Museo del Prado, Madrid', lat: 40.41378, lng: -3.69214 },
    { id: 'e-javier', nombre: 'Javier', rel: 'Tu hijo', tono: 210, nota: 'Viene los domingos con el pan.', direccion: 'Estación de Atocha, Madrid', lat: 40.40654, lng: -3.69076 },
    { id: 'e-pablo', nombre: 'Pablo', rel: 'Tu nieto', tono: 275, nota: 'Toca la guitarra y le gusta cantarte.', direccion: 'Teatro Real, Madrid', lat: 40.41846, lng: -3.71047 },
    { id: 'e-rosa', nombre: 'Rosa', rel: 'Tu hermana', tono: 15, nota: 'Crecisteis juntas. Siempre os reís mucho.', direccion: 'Puerta de Alcalá, Madrid', lat: 40.41999, lng: -3.68877 }
  ],
  ajustes: { tamano: 0, tema: null }
};

/* ---------- Estado ---------- */
let datos = cargar();
let sel = null;
let rutaActual = null;
const rutas = new Map(); // clave -> promesa de ruta
const resueltas = new Map(); // clave -> ruta ya calculada
const byId = (id) => datos.personas.find((p) => p.id === id);
const claveRuta = (p) => `${datos.casa.lat},${datos.casa.lng}>${p.lat},${p.lng}`;

function persistir() { return guardar(datos); }

/* ---------- Buscador de direcciones ---------- */
function crearBuscador(pref, etiqueta = 'Dirección completa') {
  const cont = document.createElement('div');
  cont.className = 'buscador';
  cont.innerHTML =
    `<label for="${pref}Q">${esc(etiqueta)}</label>` +
    `<div class="fila"><input id="${pref}Q" autocomplete="off" maxlength="200" placeholder="Calle, número y ciudad">` +
    `<button class="btn" type="button" id="${pref}B">Buscar</button></div>` +
    `<p class="ayuda" id="${pref}E" role="status"></p><ul class="resultados" id="${pref}R"></ul>`;
  const q = $(`#${pref}Q`, cont), btn = $(`#${pref}B`, cont), estado = $(`#${pref}E`, cont), lista = $(`#${pref}R`, cont);
  let elegida = null, ctrl = null, hallados = [];

  q.addEventListener('input', () => {
    if (elegida && q.value.trim() !== elegida.direccion) { elegida = null; estado.textContent = ''; }
  });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
  btn.addEventListener('click', buscar);
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    elegida = hallados[Number(b.dataset.i)];
    q.value = elegida.direccion;
    lista.innerHTML = '';
    estado.textContent = 'Dirección elegida.';
  });

  async function buscar() {
    const texto = q.value.trim();
    if (texto.length < 4) { estado.textContent = 'Escribe la calle, el número y la ciudad.'; return; }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    btn.disabled = true;
    estado.textContent = 'Buscando…';
    lista.innerHTML = '';
    try {
      hallados = await buscarDireccion(texto, ctrl.signal);
      if (!hallados.length) {
        estado.textContent = 'No encuentro esa dirección. Prueba a añadir la ciudad o a quitar el piso.';
      } else {
        estado.textContent = 'Elige la dirección correcta:';
        lista.innerHTML = hallados.map((h, i) => `<li><button type="button" class="res" data-i="${i}">${esc(h.direccion)}</button></li>`).join('');
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      estado.textContent = 'No se pudo buscar. Comprueba la conexión e inténtalo de nuevo.';
    } finally {
      btn.disabled = false;
    }
  }

  return {
    el: cont,
    valor() {
      if (elegida) return { ...elegida };
      const t = q.value.trim();
      return t ? { direccion: t, lat: null, lng: null } : null;
    },
    poner(v) {
      elegida = v ? { ...v } : null;
      q.value = v ? v.direccion : '';
      lista.innerHTML = '';
      estado.textContent = v ? (v.lat !== null ? 'Dirección elegida.' : 'Esta dirección no está en el mapa. Pulsa Buscar para ubicarla.') : '';
    }
  };
}

const busB = crearBuscador('bus', 'Dirección de su casa');
const busP = crearBuscador('per', 'Dónde vive');
const busA = crearBuscador('aju', 'Dirección de su casa');
$('#slotBuscadorB').append(busB.el);
$('#slotBuscadorP').append(busP.el);
$('#slotBuscadorA').append(busA.el);

/* ---------- Mapa ---------- */
const mapa = crearMapa($('#mapa'), (id) => elegir(id, false));

/* ---------- Pantalla: hoy ---------- */
function sol(dia) {
  if (dia) {
    let rayos = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
      rayos += `<line class="g-ray" x1="${(32 + c * 20).toFixed(1)}" y1="${(32 + s * 20).toFixed(1)}" x2="${(32 + c * 27).toFixed(1)}" y2="${(32 + s * 27).toFixed(1)}"/>`;
    }
    return `<svg class="glyph" viewBox="0 0 64 64" aria-hidden="true"><circle class="g-fill" cx="32" cy="32" r="12"/>${rayos}</svg>`;
  }
  return '<svg class="glyph" viewBox="0 0 64 64" aria-hidden="true"><path class="g-fill" d="M44 42a18 18 0 1 1-20-28 14 14 0 0 0 20 28z"/><circle class="g-star" cx="48" cy="14" r="2.5"/><circle class="g-star" cx="55" cy="26" r="2"/></svg>';
}

function renderHoy() {
  if (!datos.casa) return;
  const d = new Date();
  let fecha = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  fecha = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d);
  const h = d.getHours();
  const parte = h < 6 ? 'de madrugada' : h < 13 ? 'por la mañana' : h < 20 ? 'por la tarde' : 'de noche';
  $('#hoy').innerHTML =
    `<p class="eyebrow">${datos.usuario ? 'Hola, ' + esc(datos.usuario) : 'Hoy'}</p><h1>${esc(fecha)}</h1>` +
    sol(h >= 7 && h < 20) +
    `<p class="sub">Es ${parte}, las ${esc(hora)}. Año ${d.getFullYear()}.</p>` +
    `<p class="where"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 12h3v9h6v-6h4v6h6v-9h3z"/></svg>Estás en casa: ${esc(corta(datos.casa.direccion))}</p>`;
}

/* ---------- Pantalla: familia ---------- */
function metrosEstimados(p) {
  const r = resueltas.get(claveRuta(p));
  return r ? r.metros : haversine(datos.casa, p) * 1.25;
}

function renderLista() {
  const ul = $('#lista');
  if (!datos.personas.length) {
    ul.innerHTML = '<li class="vacio">Aún no hay familiares. Un cuidador puede añadirlos con el botón de abajo.</li>';
    return;
  }
  ul.innerHTML = datos.personas.map((p) => {
    const dato = p.lat === null ? 'Sin ubicar en el mapa' : `Unos ${minutosAndando(metrosEstimados(p))} min andando`;
    return `<li><button class="person" type="button" data-id="${esc(p.id)}" style="--h:${p.tono}" aria-pressed="${p.id === sel}">` +
      `<span class="av" aria-hidden="true">${esc(inicial(p.nombre))}</span>` +
      `<span class="pn"><strong>${esc(p.nombre)}</strong><span>${esc(p.rel)}</span><small>${esc(dato)}</small></span></button></li>`;
  }).join('');
}

function renderDetalle() {
  const box = $('#detalle');
  const p = sel && byId(sel);
  if (!p) {
    box.innerHTML = '<p class="eyebrow">Tu barrio</p><h2 class="d-title">Toca una cara</h2>' +
      '<p class="lead">Verás quién es, dónde vive y cómo llegar desde casa.</p>' +
      `<p class="home-line">Tu casa: <strong>${esc(corta(datos.casa.direccion))}</strong></p>`;
    return;
  }
  const ubicado = p.lat !== null;
  const voz = 'speechSynthesis' in window ? '<button class="btn primary" type="button" data-act="voz">Escuchar</button>' : '';
  const completa = p.direccion !== corta(p.direccion) ? `<p class="home-line">${esc(p.direccion)}</p>` : '';
  box.innerHTML =
    `<div class="d-head" style="--h:${p.tono}"><span class="av" aria-hidden="true">${esc(inicial(p.nombre))}</span>` +
    `<div><h2 class="d-title">${esc(p.nombre)}</h2><span class="chip">${esc(p.rel)}</span></div></div>` +
    (p.nota ? `<div class="d-block"><span class="label">Para recordar</span><p>${esc(p.nota)}</p></div>` : '') +
    `<div class="d-block"><span class="label">Vive en</span><p class="addr">${esc(corta(p.direccion))}</p>${completa}</div>` +
    (ubicado
      ? '<div id="rutaInfo"><p class="home-line">Calculando el camino…</p></div>'
      : '<p class="aviso">Esta dirección aún no está en el mapa. Un cuidador puede ubicarla en Editar.</p>') +
    `<div class="actions">${voz}<button class="btn" type="button" data-act="todos">Ver a todos</button>` +
    (ubicado ? `<a class="btn" target="_blank" rel="noopener" href="${esc(enlaceMapa(p))}">Abrir en el mapa</a>` : '') +
    '</div>' +
    '<details class="care"><summary>Opciones para cuidadores</summary>' +
    '<div class="actions"><button class="btn" type="button" data-act="editar">Editar</button>' +
    '<button class="btn" type="button" data-act="borrar">Eliminar</button></div>' +
    `<div class="confirma" id="borrarConf" hidden><p>¿Eliminar a ${esc(p.nombre)}?</p>` +
    '<div class="actions"><button class="btn primary" type="button" data-act="borrarsi">Sí, eliminar</button>' +
    '<button class="btn" type="button" data-act="borrarno">No</button></div></div></details>';
}

function completarRuta(r, p) {
  const cont = $('#rutaInfo');
  if (!cont) return;
  cont.innerHTML =
    `<div class="metrics"><div class="metric"><b>${minutosAndando(r.metros)} min</b><span>andando, sin prisa</span></div>` +
    `<div class="metric"><b>${esc(formatoDistancia(r.metros))}</b><span>de camino</span></div></div>` +
    (r.aproximada ? '<p class="aviso">Camino aproximado: no se pudo calcular la ruta por las calles.</p>' : '') +
    '<div class="d-block"><span class="label">Cómo llegar</span></div>' +
    `<ol class="steps">${r.pasos.map((s) => `<li><span class="arrow${s.fin ? ' end' : ''}" aria-hidden="true">${esc(s.flecha)}</span><span>${esc(s.texto)}</span></li>`).join('')}</ol>` +
    `<p><a href="${esc(enlaceRuta(datos.casa, p))}" target="_blank" rel="noopener">Ver la ruta en OpenStreetMap</a></p>`;
}

function rutaDe(p) {
  const k = claveRuta(p);
  if (!rutas.has(k)) {
    rutas.set(k, calcularRuta(datos.casa, p).then((r) => { resueltas.set(k, r); return r; }, (e) => { rutas.delete(k); throw e; }));
  }
  return rutas.get(k);
}

/* ---------- Refresco general ---------- */
function aplicarModo() {
  const principal = !!datos.casa;
  $('#app').dataset.modo = principal ? 'principal' : 'inicio';
  mostrar($('#bienvenida'), !principal);
  mostrar($('#hoy'), principal);
  mostrar($('#stage'), principal);
  mostrar($('#familia'), principal);
  mostrar($('#btnAnadir'), principal);
  mostrar($('#btnAjustes'), principal);
}

function refrescar(animar = true) {
  aplicarModo();
  if (!datos.casa) return;
  if (sel && !byId(sel)) sel = null;
  renderHoy();
  renderLista();
  renderDetalle();
  mapa.actualizar(datos.casa, datos.personas, sel);
  mapa.ruta(null);
  mostrar($('#btnTodo'), !!sel);
  mapa.ajustar(animar);
}

async function elegir(id, desplazar) {
  if (id && !byId(id)) id = null;
  sel = id;
  rutaActual = null;
  refrescar(true);
  if (!id) return;
  if (desplazar && matchMedia('(max-width: 959px)').matches) {
    $('#stage').scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
  }
  const p = byId(id);
  if (p.lat === null) return;
  try {
    const r = await rutaDe(p);
    if (sel !== id) return;
    rutaActual = r;
    completarRuta(r, p);
    mapa.ruta(r.linea);
    renderLista();
  } catch (e) {
    if (sel === id && $('#rutaInfo')) $('#rutaInfo').innerHTML = '<p class="aviso">No se pudo calcular el camino ahora.</p>';
  }
}

/* ---------- Eventos de la pantalla principal ---------- */
$('#lista').addEventListener('click', (e) => {
  const b = e.target.closest('.person');
  if (b) elegir(b.dataset.id, true);
});
$('#btnTodo').addEventListener('click', () => elegir(null));

$('#detalle').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = sel && byId(sel);
  switch (b.dataset.act) {
    case 'todos': elegir(null); break;
    case 'voz':
      if (!p) break;
      try {
        speechSynthesis.cancel();
        const min = rutaActual ? minutosAndando(rutaActual.metros) : null;
        const u = new SpeechSynthesisUtterance(`${p.nombre}. ${p.rel}. Vive en ${corta(p.direccion)}.${min ? ` Desde tu casa, está a unos ${min} minutos andando.` : ''} ${p.nota || ''}`);
        u.lang = 'es-ES';
        u.rate = 0.85;
        speechSynthesis.speak(u);
      } catch (err) { /* sin voz disponible */ }
      break;
    case 'editar': if (p) abrirPersona(p.id); break;
    case 'borrar': mostrar($('#borrarConf'), true); break;
    case 'borrarno': mostrar($('#borrarConf'), false); break;
    case 'borrarsi':
      if (!p) break;
      datos.personas = datos.personas.filter((x) => x.id !== p.id);
      persistir();
      sel = null;
      refrescar(true);
      break;
    default: break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sel && !document.querySelector('dialog[open]')) elegir(null);
});

let anchoMapa = 0;
new ResizeObserver(() => {
  const w = $('#mapwrap').clientWidth;
  if (w && w !== anchoMapa) {
    anchoMapa = w;
    mapa.invalidar();
    mapa.ajustar(false);
  }
}).observe($('#mapwrap'));

/* ---------- Ajustes de pantalla ---------- */
const TAMANOS = [['Normal', 1], ['Grande', 1.15], ['Muy grande', 1.3]];
const root = document.documentElement;
const temaEfectivo = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function aplicarAjustes() {
  const { tamano, tema } = datos.ajustes;
  if (tema) root.dataset.theme = tema; else delete root.dataset.theme;
  root.style.setProperty('--scale', TAMANOS[tamano][1]);
  $('#btnLetra').textContent = `Letra: ${TAMANOS[tamano][0]}`;
  $('#btnLetra').setAttribute('aria-label', `Tamaño de letra: ${TAMANOS[tamano][0]}. Pulsa para cambiarlo.`);
  $('#btnTema').textContent = temaEfectivo() === 'dark' ? 'Modo claro' : 'Modo oscuro';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = temaEfectivo() === 'dark' ? '#0C1A1D' : '#0B6E6E';
}
$('#btnLetra').addEventListener('click', () => {
  datos.ajustes.tamano = (datos.ajustes.tamano + 1) % TAMANOS.length;
  aplicarAjustes(); persistir(); mapa.invalidar(); mapa.ajustar(false);
});
$('#btnTema').addEventListener('click', () => {
  datos.ajustes.tema = temaEfectivo() === 'dark' ? 'light' : 'dark';
  aplicarAjustes(); persistir(); mapa.ruta(rutaActual ? rutaActual.linea : null);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarAjustes);

/* ---------- Primera vez ---------- */
function cargarEjemplo() {
  const aj = datos.ajustes;
  datos = validar(EJEMPLO);
  datos.ajustes = aj;
  rutas.clear(); resueltas.clear();
  sel = null;
  persistir();
  refrescar(false);
}
$('#btnEjemplo').addEventListener('click', cargarEjemplo);

$('#formBienvenida').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#bErr');
  const v = busB.valor();
  if (!v || v.lat === null) { err.textContent = 'Escribe la dirección, pulsa Buscar y elige una opción de la lista.'; mostrar(err, true); return; }
  datos.usuario = $('#bNombre').value.trim().slice(0, 30);
  datos.casa = v;
  if (!persistir()) { err.textContent = 'No se pudo guardar en este navegador. Si estás en una ventana privada, abre una normal.'; mostrar(err, true); return; }
  mostrar(err, false);
  sel = null;
  refrescar(false);
});

/* ---------- Añadir o editar familiar ---------- */
const dlgP = $('#dlgPersona'), formP = $('#formPersona');
let editando = null;
$('#muestras').innerHTML = TONOS.map((h, i) =>
  `<label class="sw" style="--h:${h}"><input type="radio" name="tono" value="${h}" aria-label="${NOMBRES_TONO[i]}"><span></span></label>`).join('');

function abrirPersona(id) {
  editando = id || null;
  const p = id ? byId(id) : null;
  formP.reset();
  $('#pTitulo').textContent = p ? 'Editar familiar' : 'Añadir familiar';
  $('#pNombre').value = p ? p.nombre : '';
  $('#pRel').value = p ? p.rel : 'Tu hijo';
  if (p && ![...$('#pRel').options].some((o) => o.value === p.rel)) $('#pRel').add(new Option(p.rel, p.rel, true, true));
  $('#pNota').value = p ? p.nota : '';
  const usados = new Set(datos.personas.map((x) => x.tono));
  const tono = p ? p.tono : (TONOS.find((t) => !usados.has(t)) ?? TONOS[0]);
  const r = formP.querySelector(`input[name="tono"][value="${tono}"]`);
  if (r) r.checked = true;
  busP.poner(p ? { direccion: p.direccion, lat: p.lat, lng: p.lng } : null);
  mostrar($('#pErr'), false);
  dlgP.showModal();
  $('#pNombre').focus();
}
$('#btnAnadir').addEventListener('click', () => abrirPersona(null));
$('#pCancelar').addEventListener('click', () => dlgP.close());

formP.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#pErr');
  const nombre = $('#pNombre').value.trim();
  const v = busP.valor();
  let msg = '';
  if (!nombre) msg = 'Escribe el nombre de tu familiar.';
  else if (!v) msg = 'Escribe dónde vive y pulsa Buscar.';
  if (msg) { err.textContent = msg; mostrar(err, true); return; }
  const marcado = formP.querySelector('input[name="tono"]:checked');
  const persona = {
    id: editando || nuevoId(),
    nombre,
    rel: $('#pRel').value,
    tono: marcado ? Number(marcado.value) : TONOS[0],
    nota: $('#pNota').value.trim(),
    ...v
  };
  if (editando) datos.personas = datos.personas.map((x) => (x.id === editando ? persona : x));
  else datos.personas.push(persona);
  if (!persistir()) { err.textContent = 'No se pudo guardar en este navegador. Si estás en una ventana privada, abre una normal.'; mostrar(err, true); return; }
  dlgP.close();
  elegir(persona.id, true);
});

/* ---------- Ajustes y copia de seguridad ---------- */
const dlgA = $('#dlgAjustes'), formA = $('#formAjustes');
let importPendiente = null;
const msgA = (t) => { $('#aMsg').textContent = t; };

function abrirAjustes() {
  $('#aNombre').value = datos.usuario;
  busA.poner(datos.casa);
  mostrar($('#aErr'), false);
  mostrar($('#aImportConfirm'), false);
  mostrar($('#aBorrarConfirm'), false);
  importPendiente = null;
  msgA('');
  dlgA.showModal();
}
$('#btnAjustes').addEventListener('click', abrirAjustes);
$('#aCerrar').addEventListener('click', () => dlgA.close());

formA.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#aErr');
  const v = busA.valor();
  if (!v || v.lat === null) { err.textContent = 'Pulsa Buscar y elige la dirección de la casa en la lista.'; mostrar(err, true); return; }
  datos.usuario = $('#aNombre').value.trim().slice(0, 30);
  datos.casa = v;
  if (!persistir()) { err.textContent = 'No se pudo guardar en este navegador.'; mostrar(err, true); return; }
  dlgA.close();
  refrescar(false);
});

$('#aExportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `memvia-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  msgA('Copia descargada. Guárdala en un sitio seguro: contiene direcciones.');
});

$('#aImportar').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 1_000_000) { msgA('El archivo es demasiado grande para ser una copia de Memvia.'); return; }
  try {
    importPendiente = validar(JSON.parse(await f.text()));
  } catch (err) {
    importPendiente = null;
  }
  if (!importPendiente) { msgA('Ese archivo no es una copia válida de Memvia.'); mostrar($('#aImportConfirm'), false); return; }
  msgA('');
  mostrar($('#aImportConfirm'), true);
});
$('#aImportNo').addEventListener('click', () => { importPendiente = null; mostrar($('#aImportConfirm'), false); });
$('#aImportSi').addEventListener('click', () => {
  if (!importPendiente) return;
  datos = importPendiente;
  importPendiente = null;
  rutas.clear(); resueltas.clear();
  sel = null;
  persistir();
  aplicarAjustes();
  dlgA.close();
  refrescar(false);
});

$('#aEjemplo').addEventListener('click', () => { cargarEjemplo(); dlgA.close(); });
$('#aBorrar').addEventListener('click', () => mostrar($('#aBorrarConfirm'), true));
$('#aBorrarNo').addEventListener('click', () => mostrar($('#aBorrarConfirm'), false));
$('#aBorrarSi').addEventListener('click', () => {
  datos = vacio();
  borrar();
  rutas.clear(); resueltas.clear();
  sel = null;
  busB.poner(null);
  $('#bNombre').value = '';
  aplicarAjustes();
  dlgA.close();
  refrescar(false);
});

/* ---------- Arranque ---------- */
aplicarAjustes();
refrescar(false);
setInterval(renderHoy, 30000);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
}
