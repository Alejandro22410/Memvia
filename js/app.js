// Memvia · lógica de la app.
// Estructura: tu web original (familia, medicación, tareas, recuerdos, juego, cuentas)
// + mapa real con rutas a pie, buscador de direcciones, edición de familiares,
// confirmaciones y modo demostración.
import { firebaseConfig } from './config.js';
import { DEMO_STATE, DEMO_KEY } from './demo.js';
import { crearMapa } from './mapa.js';
import { crearBuscador } from './buscador.js';
import { calcularRuta, formatoDistancia, minutosAndando } from './geo.js';

(function() {
  const RELATION_STYLES = [
    { test: /hij[oa]/, bg: '#FAECE7', text: '#4A1B0C', icon: 'ti-child' },
    { test: /niet[oa]/, bg: '#FAEEDA', text: '#412402', icon: 'ti-mood-smile' },
    { test: /herman[oa]/, bg: '#E1F5EE', text: '#04342C', icon: 'ti-users' },
    { test: /(madre|padre|mam[aá]|pap[aá])/, bg: '#EEEDFE', text: '#26215C', icon: 'ti-heart-handshake' },
    { test: /(espos[oa]|marido|mujer|pareja)/, bg: '#FBEAF0', text: '#4B1528', icon: 'ti-heart' },
    { test: /amig[oa]/, bg: '#E6F1FB', text: '#042C53', icon: 'ti-friends' }
  ];
  const DEFAULT_STYLE = { bg: '#F1EFE8', text: '#2C2C2A', icon: 'ti-user' };
  const PLACE_ICONS = { medico: '🩺', farmacia: '💊', centro_dia: '🏢', otro: '📍' };
  const ICON_CHOICES = ['👵', '👴', '👩', '👨', '👧', '👦', '👶', '❤️', '🌟', '🏠'];
  const PLACE_STYLE = { bg: '#E6F1FB', text: '#042C53' };
  const PLACE_LABELS = { medico: 'Médico', farmacia: 'Farmacia', centro_dia: 'Centro de día', otro: 'Lugar' };
  const FOTO_VALIDA = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  const hasCoords = (o) => !!o && typeof o.lat === 'number' && typeof o.lng === 'number' && !isNaN(o.lat) && !isNaN(o.lng);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Confirmación propia (los diálogos del navegador no funcionan bien en una app instalada)
  function confirmDialog(message, yesLabel) {
    return new Promise(resolve => {
      const dlg = document.getElementById('confirm-dlg');
      if (!dlg || !dlg.showModal) { resolve(window.confirm(message)); return; }
      document.getElementById('confirm-msg').textContent = message;
      document.getElementById('confirm-yes').textContent = yesLabel || 'Sí, continuar';
      const onClose = () => { dlg.removeEventListener('close', onClose); resolve(dlg.returnValue === 'ok'); };
      dlg.addEventListener('close', onClose);
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  let family = [];
  let home = null;
  let fsScale = 1;
  let reminders = [];
  let meds = [];
  let places = [];
  let memories = [];
  let userName = '';
  let simpleMode = false;
  let theme = 'auto';
  let consent = null;            // { version, at }: prueba del consentimiento para datos de salud
  let pendingConsent = null;     // se rellena al crear cuenta y se guarda con el primer documento
  const CONSENT_VERSION = '2026-10-09';
  let quizScore = { correct: 0, total: 0 };
  let selectedIcon = '';

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  function avatarContent(f) {
    const fallback = f.icon ? f.icon : initials(f.name);
    if (f.photo) return `<img src="${escapeHtml(f.photo)}" alt="${escapeHtml(f.name)}" data-fallback="${escapeHtml(fallback)}" />`;
    return escapeHtml(fallback);
  }
  // Si una foto no carga, se muestra el icono o las iniciales
  document.addEventListener('error', function(e) {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset && img.dataset.fallback !== undefined && img.parentElement) img.parentElement.textContent = img.dataset.fallback;
  }, true);
  function relationStyle(relation) {
    const r = (relation || '').toLowerCase();
    for (const s of RELATION_STYLES) if (s.test.test(r)) return s;
    return DEFAULT_STYLE;
  }
  function speak(text) {
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) {}
  }
  function toRad(d) { return d * Math.PI / 180; }
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function bearingDeg(lat1, lon1, lat2, lon2) {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function mapsDirUrl(address) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address); }
  function mapsEmbedUrl(lat, lng) { return 'https://www.google.com/maps?q=' + lat + ',' + lng + '&z=15&output=embed'; }
  function waUrl(phone) { return 'https://wa.me/' + phone.replace(/[^0-9]/g, ''); }

  function renderIconPicker() {
    const wrap = document.getElementById('icon-picker');
    wrap.innerHTML = '';
    ICON_CHOICES.forEach(icon => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'icon-chip' + (selectedIcon === icon ? ' selected' : '');
      chip.textContent = icon;
      chip.onclick = () => { selectedIcon = selectedIcon === icon ? '' : icon; renderIconPicker(); };
      wrap.appendChild(chip);
    });
  }

  function updateOrientation() {
    const now = new Date();
    const dayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('orientation').textContent = 'Hoy es ' + dayStr.charAt(0).toUpperCase() + dayStr.slice(1) + ' · ' + timeStr;
  }

  function checkBirthdays() {
    const now = new Date();
    const mmdd = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const celebs = family.filter(f => f.birthday && f.birthday.slice(5) === mmdd);
    const banner = document.getElementById('birthday-banner');
    if (celebs.length) {
      banner.style.display = 'block';
      banner.textContent = '🎉 Hoy es el cumpleaños de ' + celebs.map(c => c.name).join(' y ');
    } else {
      banner.style.display = 'none';
    }
  }

  function greetingWord() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function primaryContact() { return family.find(f => f.primary && f.phone) || family.find(f => f.phone) || null; }

  function nextReminder() {
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const pending = reminders.filter(r => !r.done).sort((a, b) => a.time.localeCompare(b.time));
    return pending.find(r => r.time >= hhmm) || pending[0] || null;
  }

  function openProfile(f) {
    const s = relationStyle(f.relation);
    const card = document.getElementById('profile-card');
    card.innerHTML = `
      <button class="profile-close" aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="profile-avatar" style="background:${s.bg}; color:${s.text};">${avatarContent(f)}</div>
      <p class="fam-name" style="font-size:22px;">${escapeHtml(f.name)}</p>
      <p class="fam-relation" style="justify-content:center;"><i class="ti ${s.icon}" aria-hidden="true"></i>${escapeHtml(f.relation)}</p>
      ${f.note ? `<p class="profile-note">❤️ ${escapeHtml(f.note)}</p>` : ''}
      ${f.address ? `<p class="profile-row">🏡 ${escapeHtml(f.address)}</p>` : ''}
      ${f.birthday ? `<p class="profile-row">🎂 ${escapeHtml(f.birthday)}</p>` : ''}
      <div class="fam-actions" style="justify-content:center; margin-top:14px;" id="profile-actions"></div>
    `;
    card.querySelector('.profile-close').onclick = () => { document.getElementById('profile-modal').style.display = 'none'; };
    const actions = document.getElementById('profile-actions');
    const listenBtn = document.createElement('button');
    listenBtn.innerHTML = '<i class="ti ti-volume" aria-hidden="true"></i>Escuchar';
    listenBtn.onclick = () => speak(`Este es tu ${f.relation}, ${f.name}.${f.note ? ' ' + f.note : ''}`);
    actions.appendChild(listenBtn);
    if (f.phone) {
      const callLink = document.createElement('a');
      callLink.href = 'tel:' + f.phone.replace(/\s+/g, '');
      callLink.innerHTML = '<i class="ti ti-phone" aria-hidden="true"></i>Llamar';
      actions.appendChild(callLink);
    }
    if (f.address) {
      const dirLink = document.createElement('a');
      dirLink.href = mapsDirUrl(f.address); dirLink.target = '_blank'; dirLink.rel = 'noopener';
      dirLink.innerHTML = '<i class="ti ti-route" aria-hidden="true"></i>Cómo llegar';
      actions.appendChild(dirLink);
    }
    if (hasCoords(f) && home) {
      const routeBtn = document.createElement('button');
      routeBtn.innerHTML = '<i class="ti ti-map-pin" aria-hidden="true"></i>Ver camino';
      routeBtn.onclick = () => { document.getElementById('profile-modal').style.display = 'none'; showTargetOnMap('familia', f.id); };
      actions.appendChild(routeBtn);
    }
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="ti ti-pencil" aria-hidden="true"></i>Editar';
    editBtn.onclick = () => startEditFamily(f);
    actions.appendChild(editBtn);
    document.getElementById('profile-modal').style.display = 'flex';
  }

  function renderStatChips() {
    const wrap = document.getElementById('stat-chips');
    const next = nextReminder();
    const now = new Date(); const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const medsToday = meds.filter(m => m.time >= hhmm).length;
    wrap.innerHTML = `
      <div class="stat-chip">👨‍👩‍👧 <span class="n">${family.length}</span> familiares</div>
      <div class="stat-chip">✅ <span class="n">${reminders.filter(r=>!r.done).length}</span> tareas hoy</div>
      <div class="stat-chip">💊 <span class="n">${medsToday}</span> por tomar</div>
    `;
  }

  function renderFamily() {
    const grid = document.getElementById('family-grid');
    grid.innerHTML = '';
    if (family.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1; font-size:15px; color:var(--text-secondary); text-align:center; padding:1.5rem 0;">Todavía no hay familiares añadidos.</p>';
      return;
    }
    family.forEach((f, idx) => {
      const s = relationStyle(f.relation);
      const card = document.createElement('div');
      card.className = 'fam-card';
      card.innerHTML = `
        <div class="fam-ribbon" style="background:${s.bg};"></div>
        <div class="fam-move">
          <button aria-label="Mover antes" ${idx === 0 ? 'disabled' : ''}><i class="ti ti-chevron-up" aria-hidden="true"></i></button>
          <button aria-label="Mover después" ${idx === family.length - 1 ? 'disabled' : ''}><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
        </div>
        <button class="fam-star ${f.primary ? 'active' : ''}" aria-label="Marcar como contacto principal" title="Contacto principal"><i class="ti ${f.primary ? 'ti-star-filled' : 'ti-star'}" aria-hidden="true"></i></button>
        <div class="avatar" style="background:${s.bg}; color:${s.text};">${avatarContent(f)}</div>
        <p class="fam-name">${escapeHtml(f.name)}</p>
        <p class="fam-relation"><i class="ti ${s.icon}" aria-hidden="true" style="font-size:15px;"></i>${escapeHtml(f.relation)}</p>
        ${f.address ? `<p class="fam-address">${escapeHtml(f.address)}</p>` : ''}
        ${f.address && !hasCoords(f) ? '<p class="fam-unplaced">📍 Sin ubicar en el mapa</p>' : ''}
        <div class="fam-actions"></div>
      `;
      card.querySelector('.fam-star').onclick = () => { family.forEach(x => x.primary = false); f.primary = true; saveFamily(); renderFamily(); };
      const moveBtns = card.querySelectorAll('.fam-move button');
      moveBtns[0].onclick = () => { if (idx > 0) { [family[idx - 1], family[idx]] = [family[idx], family[idx - 1]]; saveFamily(); renderFamily(); } };
      moveBtns[1].onclick = () => { if (idx < family.length - 1) { [family[idx + 1], family[idx]] = [family[idx], family[idx + 1]]; saveFamily(); renderFamily(); } };
      const actions = card.querySelector('.fam-actions');
      const listenBtn = document.createElement('button');
      listenBtn.innerHTML = '<i class="ti ti-volume" aria-hidden="true"></i>Escuchar';
      listenBtn.onclick = () => speak(`Este es tu ${f.relation}, ${f.name}.`);
      actions.appendChild(listenBtn);
      if (f.phone) {
        const callLink = document.createElement('a');
        callLink.href = 'tel:' + f.phone.replace(/\s+/g, '');
        callLink.innerHTML = '<i class="ti ti-phone" aria-hidden="true"></i>Llamar';
        actions.appendChild(callLink);
        const waLink = document.createElement('a');
        waLink.href = waUrl(f.phone); waLink.target = '_blank'; waLink.rel = 'noopener';
        waLink.innerHTML = '<i class="ti ti-brand-whatsapp" aria-hidden="true"></i>WhatsApp';
        actions.appendChild(waLink);
      }
      if (f.address) {
        const dirLink = document.createElement('a');
        dirLink.href = mapsDirUrl(f.address); dirLink.target = '_blank'; dirLink.rel = 'noopener';
        dirLink.innerHTML = '<i class="ti ti-route" aria-hidden="true"></i>Cómo llegar';
        actions.appendChild(dirLink);
      }
      if (hasCoords(f) && home) {
        const mapBtn = document.createElement('button');
        mapBtn.innerHTML = '<i class="ti ti-map-pin" aria-hidden="true"></i>Ver camino';
        mapBtn.onclick = () => showTargetOnMap('familia', f.id);
        actions.appendChild(mapBtn);
      }
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
      delBtn.setAttribute('aria-label', 'Eliminar a ' + f.name);
      delBtn.onclick = async () => {
        if (!(await confirmDialog('¿Eliminar a ' + f.name + ' de tu lista?', 'Sí, eliminar'))) return;
        family = family.filter(x => x.id !== f.id);
        saveFamily(); renderFamily(); renderMap(); updateDashboard();
      };
      actions.appendChild(delBtn);
      card.addEventListener('click', (ev) => { if (!ev.target.closest('.fam-actions, .fam-move, .fam-star')) openProfile(f); });
      grid.appendChild(card);
    });
  }

  /* ---------------- Mapa real, esquema y rutas ---------------- */
  let selected = null;            // { kind: 'familia' | 'lugar', id }
  let routeToken = 0;
  const routeCache = new Map();
  let mapMode = 'real';
  const mapa = crearMapa(document.getElementById('leaflet-map'), (kind, id) => selectTarget(kind, id));

  function targets() {
    const out = [];
    family.forEach(f => { if (hasCoords(f)) out.push({ kind: 'familia', id: f.id, name: f.name, sub: f.relation, address: f.address, lat: f.lat, lng: f.lng, style: relationStyle(f.relation), icon: f.icon, photo: f.photo }); });
    places.forEach(p => { if (hasCoords(p)) out.push({ kind: 'lugar', id: p.id, name: p.name, sub: PLACE_LABELS[p.category] || 'Lugar', address: p.address, lat: p.lat, lng: p.lng, style: PLACE_STYLE, icon: PLACE_ICONS[p.category] || '📍' }); });
    return out;
  }
  const sameTarget = (t) => !!selected && selected.kind === t.kind && selected.id === t.id;

  function svgEl(tag, attrs, styles) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (styles) for (const k in styles) e.style[k] = styles[k];
    return e;
  }

  // Esquema: tu casa en el centro y cada sitio a su distancia y dirección
  function renderSchema(list) {
    const svg = document.getElementById('map-svg');
    svg.innerHTML = '';
    if (!home) return;
    const cx = 170, cy = 170, maxR = 140;
    const dists = list.map(o => distanceKm(home.lat, home.lng, o.lat, o.lng));
    const maxDist = dists.length ? Math.max(...dists, 0.1) : 1;
    [0.35, 0.7, 1].forEach(frac => svg.appendChild(svgEl('circle', { cx, cy, r: maxR * frac, fill: 'none', 'stroke-width': 1, 'stroke-dasharray': '3,4' }, { stroke: 'var(--border)' })));
    const points = list.map((o, i) => {
      const r = 48 + (dists[i] / maxDist) * (maxR - 48);
      const a = toRad(bearingDeg(home.lat, home.lng, o.lat, o.lng));
      return { o, dist: dists[i], x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
    });
    points.forEach(p => svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: p.x, y2: p.y, 'stroke-width': 1.5, 'stroke-opacity': 0.4, stroke: p.o.style.text })));
    svg.appendChild(svgEl('circle', { cx, cy, r: 18, fill: '#5B3FD0' }));
    const homeIcon = svgEl('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 16, fill: '#fff' }); homeIcon.textContent = '⌂'; svg.appendChild(homeIcon);
    const homeText = svgEl('text', { x: cx, y: cy + 36, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600 }, { fill: 'var(--text-primary)' }); homeText.textContent = 'Tu casa'; svg.appendChild(homeText);
    points.forEach(p => {
      const g = svgEl('g', { tabindex: 0, role: 'button', 'aria-label': `${p.o.name}, a ${p.dist.toFixed(1)} kilómetros` }, { cursor: 'pointer' });
      g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 18, fill: p.o.style.bg, stroke: p.o.style.text, 'stroke-width': sameTarget(p.o) ? 4 : 2 }));
      const t = svgEl('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', 'font-size': p.o.icon ? 14 : 12, 'font-weight': 600, fill: p.o.style.text });
      t.textContent = p.o.icon ? p.o.icon : initials(p.o.name); g.appendChild(t);
      const l = svgEl('text', { x: p.x, y: p.y + (p.y > cy ? 30 : -24), 'text-anchor': 'middle', 'font-size': 12 }, { fill: 'var(--text-secondary)' });
      l.textContent = p.o.name; g.appendChild(l);
      g.addEventListener('click', () => { speak(`${p.o.kind === 'familia' ? 'La casa de tu ' + String(p.o.sub).toLowerCase() + ', ' + p.o.name : p.o.name} está a ${p.dist.toFixed(1)} kilómetros de tu casa.`); selectTarget(p.o.kind, p.o.id); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); g.dispatchEvent(new Event('click')); } });
      svg.appendChild(g);
    });
  }

  function renderLegend(list) {
    const legend = document.getElementById('map-legend');
    legend.innerHTML = '';
    if (!home) return;
    if (!list.length) {
      legend.innerHTML = '<p style="font-size:14px; color:var(--text-secondary);">Busca la dirección de un familiar o de un lugar y aparecerá en el mapa.</p>';
      return;
    }
    list.map(o => ({ o, d: distanceKm(home.lat, home.lng, o.lat, o.lng) })).sort((a, b) => a.d - b.d).forEach(({ o, d }) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'legend-row' + (sameTarget(o) ? ' selected' : '');
      row.setAttribute('aria-pressed', sameTarget(o) ? 'true' : 'false');
      row.innerHTML = `<span class="legend-main"><span class="legend-dot" style="background:${o.style.bg}; color:${o.style.text};">${escapeHtml(o.icon || initials(o.name))}</span><span>${escapeHtml(o.name)}</span></span><span class="legend-km">${d.toFixed(1)} km</span>`;
      row.onclick = () => selectTarget(o.kind, o.id);
      legend.appendChild(row);
    });
  }

  function renderMap() {
    document.getElementById('no-home-msg').style.display = home ? 'none' : 'block';
    const list = home ? targets() : [];
    if (selected && !list.some(sameTarget)) clearSelection(true);
    mapa.actualizar(home, list, selected);
    renderSchema(list);
    renderLegend(list);
  }

  function clearSelection(skipRender) {
    selected = null;
    routeToken++;
    const panel = document.getElementById('route-panel');
    panel.hidden = true; panel.innerHTML = '';
    mapa.ruta(null);
    if (!skipRender) { renderMap(); mapa.ajustar(true); }
  }

  function routeFor(t) {
    const key = [home.lat, home.lng, t.lat, t.lng].join(',');
    if (!routeCache.has(key)) routeCache.set(key, calcularRuta(home, t).catch(e => { routeCache.delete(key); throw e; }));
    return routeCache.get(key);
  }

  const gmapsWalkUrl = (t) => `https://www.google.com/maps/dir/?api=1&origin=${home.lat},${home.lng}&destination=${t.lat},${t.lng}&travelmode=walking`;

  function renderRoutePanel(t, route, first) {
    const panel = document.getElementById('route-panel');
    panel.hidden = false;
    const mins = route ? minutosAndando(route.metros) : null;
    const avatar = t.kind === 'familia' ? avatarContent({ photo: t.photo, icon: t.icon, name: t.name }) : escapeHtml(t.icon);
    let body;
    if (route === null) body = '<p class="route-note">Calculando el camino a pie…</p>';
    else if (route === false) body = '<p class="route-note">No se pudo calcular el camino ahora. Prueba otra vez en un momento.</p>';
    else body =
      `<div class="route-metrics"><div class="route-metric"><b>${mins} min</b><span>andando, sin prisa</span></div>` +
      `<div class="route-metric"><b>${escapeHtml(formatoDistancia(route.metros))}</b><span>de camino</span></div></div>` +
      (route.aproximada ? '<p class="route-note">Camino aproximado: no se pudo calcular la ruta por las calles.</p>' : '') +
      '<p class="route-label">Cómo llegar desde tu casa</p><ol class="route-steps">' +
      route.pasos.map(s => `<li><span class="route-arrow${s.fin ? ' end' : ''}" aria-hidden="true">${escapeHtml(s.flecha)}</span><span>${escapeHtml(s.texto)}</span></li>`).join('') + '</ol>';
    panel.innerHTML =
      `<div class="route-head"><div class="avatar" style="background:${t.style.bg}; color:${t.style.text};">${avatar}</div>` +
      `<div><h3 class="route-title">${escapeHtml(t.name)}</h3><p class="route-sub">${escapeHtml(t.sub || '')}${t.address ? ' · ' + escapeHtml(t.address) : ''}</p></div></div>` +
      body + '<div class="route-actions"></div>';
    const actions = panel.querySelector('.route-actions');
    if (route) {
      const listen = document.createElement('button');
      listen.innerHTML = '<i class="ti ti-volume" aria-hidden="true"></i>Escuchar';
      listen.onclick = () => speak(`${t.kind === 'familia' ? 'La casa de tu ' + String(t.sub).toLowerCase() + ', ' + t.name : t.name}, está a unos ${mins} minutos andando. ` + route.pasos.map(s => s.texto).join(' '));
      actions.appendChild(listen);
    }
    const g = document.createElement('a');
    g.href = gmapsWalkUrl(t); g.target = '_blank'; g.rel = 'noopener';
    g.innerHTML = '<i class="ti ti-brand-google-maps" aria-hidden="true"></i>Abrir en Google Maps';
    actions.appendChild(g);
    const close = document.createElement('button');
    close.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>Quitar camino';
    close.onclick = () => clearSelection(false);
    actions.appendChild(close);
    if (t.kind === 'lugar') {
      const del = document.createElement('button');
      del.className = 'danger';
      del.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>Quitar lugar';
      del.onclick = async () => {
        if (!(await confirmDialog('¿Quitar «' + t.name + '» de tus lugares?', 'Sí, quitar'))) return;
        places = places.filter(x => x.id !== t.id);
        savePlaces(); clearSelection(true); renderMap();
      };
      actions.appendChild(del);
    }
    if (first) panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  async function selectTarget(kind, id) {
    if (!home) { speak('Primero configura tu casa en Ajustes.'); return; }
    const t = targets().find(x => x.kind === kind && x.id === id);
    if (!t) return;
    selected = { kind, id };
    const token = ++routeToken;
    mapa.ruta(null);
    renderMap();
    mapa.ajustar(true);
    renderRoutePanel(t, null, true);
    let route;
    try { route = await routeFor(t); } catch (e) { if (token === routeToken) renderRoutePanel(t, false, false); return; }
    if (token !== routeToken) return;
    mapa.ruta(route.linea);
    renderRoutePanel(t, route, false);
  }

  function setMapMode(mode) {
    mapMode = mode;
    const real = mode === 'real';
    document.getElementById('real-map-card').style.display = real ? 'block' : 'none';
    document.getElementById('map-wrap').style.display = real ? 'none' : 'flex';
    document.getElementById('map-mode-real').classList.toggle('active', real);
    document.getElementById('map-mode-schema').classList.toggle('active', !real);
    document.getElementById('map-mode-real').setAttribute('aria-pressed', real ? 'true' : 'false');
    document.getElementById('map-mode-schema').setAttribute('aria-pressed', real ? 'false' : 'true');
    if (real) { mapa.invalidar(); mapa.ajustar(false); }
  }
  document.getElementById('map-mode-real').onclick = () => setMapMode('real');
  document.getElementById('map-mode-schema').onclick = () => setMapMode('schema');

  function showTargetOnMap(kind, id) {
    activateTab('mapa');
    setMapMode('real');
    selectTarget(kind, id);
  }

  function renderReminders() {
    const list = document.getElementById('reminders-list');
    list.innerHTML = '';
    if (!reminders.length) { list.innerHTML = '<p style="margin:4px 0;color:var(--text-secondary);font-size:14px;">No tienes tareas todavía. Añade una abajo.</p>'; return; }
    reminders.slice().sort((a, b) => a.time.localeCompare(b.time)).forEach(r => {
      const item = document.createElement('div');
      item.className = 'reminder-item' + (r.done ? ' done' : '');
      item.innerHTML = `<div class="reminder-main">
          <button class="reminder-check ${r.done ? 'checked' : ''}" aria-label="Marcar como hecho">${r.done ? '<i class=\"ti ti-check\"></i>' : ''}</button>
          <span class="reminder-time">${escapeHtml(r.time)}</span>
          <span class="reminder-text ${r.done ? 'done-text' : ''}">${r.icon || '⏰'} ${escapeHtml(r.text)}</span>
        </div>`;
      item.querySelector('.reminder-check').onclick = () => { r.done = !r.done; saveReminders(); renderReminders(); updateDashboard(); };
      const del = document.createElement('button');
      del.className = 'reminder-delete'; del.setAttribute('aria-label', 'Eliminar');
      del.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
      del.onclick = () => { reminders = reminders.filter(x => x.id !== r.id); saveReminders(); renderReminders(); updateDashboard(); };
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function renderMeds() {
    const list = document.getElementById('meds-list');
    list.innerHTML = '';
    if (!meds.length) { list.innerHTML = '<p style="margin:4px 0;color:var(--text-secondary);font-size:14px;">Todavía no has añadido medicamentos.</p>'; return; }
    meds.slice().sort((a, b) => a.time.localeCompare(b.time)).forEach(m => {
      const now = new Date(); const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      const item = document.createElement('div');
      item.className = 'reminder-item' + (m.time === hhmm ? ' due' : '');
      const lastTaken = m.history && m.history.length ? m.history[m.history.length - 1] : null;
      item.innerHTML = `<div class="reminder-main" style="flex-direction:column; align-items:flex-start; gap:2px;">
          <span><span class="reminder-time">${escapeHtml(m.time)}</span> 💊 ${escapeHtml(m.name)}${m.dose ? ' — ' + escapeHtml(m.dose) : ''}</span>
          ${lastTaken ? `<span class="med-history">Última toma: ${escapeHtml(lastTaken)}</span>` : ''}
        </div>`;
      const takeBtn = document.createElement('button');
      takeBtn.className = 'med-take-btn';
      takeBtn.textContent = 'Ya lo he tomado';
      takeBtn.onclick = () => {
        m.history = m.history || [];
        m.history.push(new Date().toLocaleString('es-ES'));
        if (m.history.length > 10) m.history = m.history.slice(-10);
        saveMeds(); renderMeds();
        speak(`Anotado. Has tomado ${m.name}.`);
      };
      item.appendChild(takeBtn);
      const del = document.createElement('button');
      del.className = 'reminder-delete'; del.setAttribute('aria-label', 'Eliminar');
      del.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
      del.onclick = () => { meds = meds.filter(x => x.id !== m.id); saveMeds(); renderMeds(); };
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function renderMemories() {
    const list = document.getElementById('memories-list');
    list.innerHTML = '';
    if (!memories.length) { list.innerHTML = '<p style="margin:4px 0;color:var(--text-secondary);font-size:14px;">Todavía no hay recuerdos guardados.</p>'; return; }
    memories.slice().reverse().forEach(mem => {
      const item = document.createElement('div');
      item.className = 'memory-item';
      item.innerHTML = `<h4>❤️ ${escapeHtml(mem.title)}</h4><p>${escapeHtml(mem.text)}</p>`;
      const del = document.createElement('button');
      del.className = 'reminder-delete'; del.setAttribute('aria-label', 'Eliminar');
      del.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
      del.style.float = 'right';
      del.onclick = () => { memories = memories.filter(x => x.id !== mem.id); saveMemories(); renderMemories(); };
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function updateDashboard() {
    const h = document.getElementById('welcome-title');
    const sub = document.getElementById('welcome-subtitle');
    const greetName = userName ? `, ${userName}` : '';
    if (h) h.textContent = `${greetingWord()}${greetName}`;
    const next = nextReminder();
    if (sub) sub.textContent = next ? `Próximo: ${next.time} — ${next.icon || ''} ${next.text}` : 'Aquí tienes a tu gente y tus tareas de hoy.';
    renderStatChips();
  }

  function renderQuiz() {
    const area = document.getElementById('quiz-area');
    if (family.length < 2) { area.innerHTML = '<p style="color:var(--text-secondary); font-size:15px;">Añade al menos 2 familiares para poder jugar.</p>'; return; }
    const target = family[Math.floor(Math.random() * family.length)];
    const s = relationStyle(target.relation);
    let pool = family.filter(f => f.id !== target.id).map(f => f.name);
    pool = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.length));
    const options = [...pool, target.name].sort(() => Math.random() - 0.5);

    area.innerHTML = `
      <div class="quiz-avatar" style="background:${s.bg}; color:${s.text};">${avatarContent(target)}</div>
      <p style="text-align:center; font-size: calc(17px * var(--fs-scale)); margin:0; font-weight:500;">¿Quién es tu ${escapeHtml(target.relation)}?</p>
      <div class="quiz-options"></div>
      <p class="quiz-score">Aciertos: ${quizScore.correct} / ${quizScore.total}</p>
    `;
    const optWrap = area.querySelector('.quiz-options');
    options.forEach(name => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.onclick = () => {
        quizScore.total++;
        const buttons = optWrap.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        if (name === target.name) { quizScore.correct++; btn.classList.add('correct'); speak(`¡Correcto! Es tu ${target.relation}, ${target.name}.`); }
        else { btn.classList.add('wrong'); buttons.forEach(b => { if (b.textContent === target.name) b.classList.add('correct'); }); speak(`No es correcto. Es tu ${target.relation}, ${target.name}.`); }
        setTimeout(renderQuiz, 1800);
      };
      optWrap.appendChild(btn);
    });
  }

  // ---- Persistencia en la nube (Firebase Auth + Firestore) ----
  let auth = null, db = null;
  const firebaseLoaded = typeof firebase !== 'undefined';
  const firebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'TU_API_KEY';
  if (firebaseLoaded && firebaseConfigured) {
    try { firebase.initializeApp(firebaseConfig); auth = firebase.auth(); db = firebase.firestore(); } catch (e) { auth = null; db = null; }
  }
  let currentUser = null;
  let demoMode = false;
  let unsubscribeSnapshot = null;
  let timersStarted = false;
  const MAX_DOC_CHARS = 900000; // Firestore guarda hasta ~1 MB por documento

  function buildState() { return { family, home, fsScale, reminders, meds, places, memories, userName, simpleMode, theme, consent: consent || null }; }
  function applyState(s) {
    family = s.family || []; home = s.home || null; fsScale = s.fsScale || 1;
    reminders = s.reminders || []; meds = s.meds || []; places = s.places || [];
    memories = s.memories || []; userName = s.userName || ''; simpleMode = !!s.simpleMode; theme = s.theme || 'auto';
    consent = s.consent && typeof s.consent.version === 'string' && typeof s.consent.at === 'string' ? { version: s.consent.version, at: s.consent.at } : null;
  }
  function scheduleSave() {
    if (!currentUser) return;
    const state = buildState();
    if (demoMode) {
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch (e) { showSaveError('No se pudo guardar en este navegador.'); }
      return;
    }
    let size = 0;
    try { size = JSON.stringify(state).length; } catch (e) { /* ignorar */ }
    if (size > MAX_DOC_CHARS) { showSaveError('Hay demasiadas fotos y no caben. Quita alguna foto para poder guardar.'); return; }
    db.collection('memvia_users').doc(currentUser.uid).set(state).catch(function(err) {
      console.error('Error guardando en Firestore:', err);
      const code = err && err.code ? ' (' + err.code + ')' : '';
      showSaveError('No se pudo guardar' + code + '. ' + firestoreHelp(err), 20000);
    });
  }
  let saveErrorTimer = null;
  function firestoreHelp(err) {
    const c = err && err.code;
    if (c === 'permission-denied') return 'Firestore rechaza el acceso: publica las reglas de firestore.rules en Firebase.';
    if (c === 'unavailable') return 'No hay conexión con Firebase. Revisa internet.';
    if (c === 'failed-precondition' || c === 'not-found') return 'Falta crear la base de datos en Firebase (Firestore Database → Crear base de datos).';
    return 'Revisa tu conexión y la configuración de Firestore.';
  }
  function showSaveError(message, ms) {
    const box = document.getElementById('save-error');
    clearTimeout(saveErrorTimer);
    box.textContent = '⚠️ ' + (message || 'No se pudo guardar. Revisa tu conexión o los permisos de Firestore.');
    box.style.display = 'block';
    saveErrorTimer = setTimeout(() => { box.style.display = 'none'; }, ms || 6000);
  }
  async function saveFamily() { scheduleSave(); }
  async function saveHome() { scheduleSave(); }
  async function saveTextSize() { scheduleSave(); }
  async function saveReminders() { scheduleSave(); }
  async function saveMeds() { scheduleSave(); }
  async function savePlaces() { scheduleSave(); }
  async function saveMemories() { scheduleSave(); }
  async function saveUserName() { scheduleSave(); }
  async function saveSimpleMode() { scheduleSave(); }
  async function saveTheme() { scheduleSave(); }

  function applyTextSize() { document.getElementById('app').style.setProperty('--fs-scale', fsScale); }
  function applySimpleMode() { document.getElementById('app').classList.toggle('simple-mode', simpleMode); }
  function applyTheme() { document.getElementById('app').setAttribute('data-theme', theme); }

  function renderAll() {
    applyTextSize(); applySimpleMode(); applyTheme(); renderIconPicker();
    document.getElementById('loading').style.display = 'none';
    renderFamily(); renderMap(); renderReminders(); renderMeds(); renderMemories(); updateDashboard(); updateOrientation(); checkBirthdays();
  }

  let consentPrompting = false;
  async function askConsent() {
    if (consentPrompting || demoMode || !auth) return;
    consentPrompting = true;
    const ok = await confirmDialog('Memvia guarda datos de salud, como tu medicación. Para seguir usando tu cuenta necesitamos tu consentimiento explícito (lo explica la Política de privacidad, en Ajustes). Puedes retirarlo cuando quieras. Si no aceptas, se cerrará la sesión y no se borrará nada.', 'Sí, acepto');
    consentPrompting = false;
    if (ok) { consent = { version: CONSENT_VERSION, at: new Date().toISOString() }; scheduleSave(); }
    else if (auth) auth.signOut();
  }

  function resetLocalState() {
    family = []; home = null; reminders = []; meds = []; places = []; memories = []; userName = ''; simpleMode = false; theme = 'auto'; fsScale = 1; consent = null;
    clearSelection(true); routeCache.clear();
    applyTextSize(); applySimpleMode(); applyTheme();
    renderFamily(); renderMap(); renderReminders(); renderMeds(); renderMemories(); updateDashboard();
  }

  async function deleteAccount() {
    const msg = demoMode
      ? '¿Borrar los datos de la demostración de este dispositivo?'
      : '¿Eliminar tu cuenta de Memvia? Se borrarán tu cuenta y todos tus datos (familia, medicación, recuerdos...). No se puede deshacer.';
    if (!(await confirmDialog(msg, demoMode ? 'Sí, borrar' : 'Sí, eliminar mi cuenta'))) return;
    document.getElementById('settings-modal').style.display = 'none';
    if (demoMode) {
      try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignorar */ }
      resetLocalState(); leaveDemo();
      return;
    }
    const user = auth && auth.currentUser;
    if (!user || !db) { showSaveError('No se pudo conectar con el servicio de cuentas. Inténtalo de nuevo con internet.'); return; }
    try {
      stopListening();
      await db.collection('memvia_users').doc(user.uid).delete();
    } catch (err) {
      console.error('Error borrando los datos:', err);
      startListening(user.uid);
      showSaveError('No se pudieron borrar los datos. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }
    try {
      await user.delete();
    } catch (err) {
      resetLocalState();
      if (err && err.code === 'auth/requires-recent-login') {
        showSaveError('Tus datos se han borrado. Para eliminar también tu usuario, cierra sesión, vuelve a entrar y repite «Eliminar mi cuenta».');
        if (auth) auth.signOut();
      } else {
        showSaveError('Tus datos se han borrado, pero no se pudo eliminar el usuario. Escribe al correo de privacidad.');
      }
      return;
    }
    resetLocalState();
  }
  document.getElementById('delete-account-btn').onclick = deleteAccount;

  function startListening(uid) {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = db.collection('memvia_users').doc(uid).onSnapshot(doc => {
      if (doc.exists) applyState(doc.data()); else consent = null;
      if (!consent && pendingConsent) { consent = pendingConsent; pendingConsent = null; scheduleSave(); }
      renderAll();
      if (!consent) askConsent();
    }, err => {
      document.getElementById('loading').style.display = 'none';
      console.error('Error leyendo de Firestore:', err);
      const code = err && err.code ? ' (' + err.code + ')' : '';
      showSaveError('No se pueden leer tus datos' + code + '. ' + firestoreHelp(err), 20000);
    });
  }

  function stopListening() { if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; } }

  function showApp() {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    const banner = document.getElementById('demo-banner');
    banner.style.display = demoMode ? 'block' : 'none';
    banner.textContent = 'Modo demostración · los datos son de ejemplo y solo se guardan en este dispositivo';
    if (!timersStarted) {
      timersStarted = true;
      setInterval(updateOrientation, 30000);
      setInterval(checkAlerts, 30000);
    }
  }
  function showGate() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-gate').style.display = 'flex';
  }

  if (auth) {
    auth.onAuthStateChanged(function(user) {
      if (demoMode) return;
      if (user) {
        currentUser = user;
        showApp();
        startListening(user.uid);
      } else {
        currentUser = null;
        stopListening();
        resetLocalState();   // que los datos de una persona no queden en memoria al entrar otra
        showGate();
      }
    });
  } else {
    // Sin Firebase (sin internet o sin configurar): solo se ofrece la demostración
    showGate();
    document.getElementById('auth-email').disabled = true;
    document.getElementById('auth-password').disabled = true;
    document.getElementById('auth-signup-btn').disabled = true;
    document.querySelector('#auth-form button[type="submit"]').disabled = true;
    const note = document.getElementById('auth-note');
    note.style.display = 'block';
    if (firebaseLoaded && !firebaseConfigured) {
      document.getElementById('setup-needed').style.display = 'block';
      note.textContent = 'Las cuentas todavía no están configuradas. Puedes probar la demostración.';
    } else {
      note.textContent = 'No se pudo conectar con el servicio de cuentas. ¿Hay internet? Puedes probar la demostración.';
    }
  }

  function enterDemo() {
    demoMode = true;
    currentUser = { uid: 'demo' };
    stopListening();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { /* ignorar */ }
    applyState(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : structuredClone(DEMO_STATE));
    showApp();
    renderAll();
    activateTab('familia');
  }
  function leaveDemo() {
    demoMode = false;
    currentUser = null;
    resetLocalState();
    showGate();
  }
  document.getElementById('auth-demo-btn').onclick = enterDemo;
  document.getElementById('logout-btn').onclick = function() {
    if (demoMode) leaveDemo();
    else if (auth) auth.signOut();
  };

  document.getElementById('auth-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!auth) return;
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
      errorEl.textContent = 'No se pudo entrar: ' + (err.message || 'revisa el email y la contraseña.');
      errorEl.style.display = 'block';
    });
  });
  document.getElementById('auth-signup-btn').onclick = function() {
    if (!auth) return;
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';
    if (!email || pass.length < 6) { errorEl.textContent = 'Escribe un email y una contraseña de al menos 6 caracteres.'; errorEl.style.display = 'block'; return; }
    if (!document.getElementById('auth-consent').checked) {
      errorEl.textContent = 'Para crear la cuenta marca la casilla de consentimiento. Sin ella no se pueden guardar datos de salud.';
      errorEl.style.display = 'block';
      return;
    }
    pendingConsent = { version: CONSENT_VERSION, at: new Date().toISOString() };
    auth.createUserWithEmailAndPassword(email, pass).catch(err => {
      pendingConsent = null;
      errorEl.textContent = 'No se pudo crear la cuenta: ' + (err.message || '');
      errorEl.style.display = 'block';
    });
  };

  function checkAlerts() {
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    reminders.filter(r => !r.done && r.time === hhmm && r._last !== hhmm).forEach(r => { r._last = hhmm; speak('Aviso: ' + r.text); });
    meds.filter(m => m.time === hhmm && m._last !== hhmm).forEach(m => { m._last = hhmm; speak('Es hora de tu medicación: ' + m.name); });
  }

  document.getElementById('text-size-btn').onclick = function() {
    fsScale = fsScale >= 1.3 ? 1 : Math.round((fsScale + 0.15) * 100) / 100;
    applyTextSize(); saveTextSize();
  };
  document.getElementById('simple-mode-btn').onclick = function() {
    simpleMode = !simpleMode;
    applySimpleMode(); saveSimpleMode();
    if (simpleMode) activateTab('familia');
  };
  document.getElementById('theme-btn').onclick = function() {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    applyTheme(); saveTheme();
    speak(theme === 'auto' ? 'Tema automático' : theme === 'light' ? 'Tema claro' : 'Tema oscuro');
  };

  function activateTab(name) {
    ['familia', 'mapa', 'dia', 'meds', 'recuerdos', 'juego'].forEach(tab => {
      document.getElementById('tab-' + tab).classList.toggle('active', tab === name);
      const view = document.getElementById('view-' + tab);
      view.style.display = tab === name ? 'block' : 'none';
      if (tab === name) { view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in'); }
    });
    if (name === 'mapa') { renderMap(); if (mapMode === 'real') { mapa.invalidar(); mapa.ajustar(false); } }
    if (name === 'dia') renderReminders();
    if (name === 'meds') renderMeds();
    if (name === 'recuerdos') renderMemories();
    if (name === 'juego') { quizScore = { correct: 0, total: 0 }; renderQuiz(); }
  }
  document.getElementById('tab-familia').onclick = () => activateTab('familia');
  document.getElementById('tab-mapa').onclick = () => activateTab('mapa');
  document.getElementById('tab-dia').onclick = () => activateTab('dia');
  document.getElementById('tab-meds').onclick = () => activateTab('meds');
  document.getElementById('tab-recuerdos').onclick = () => activateTab('recuerdos');
  document.getElementById('tab-juego').onclick = () => activateTab('juego');


  /* ---- Fotos desde el dispositivo y direcciones automáticas ---- */
  function resetPhotoPicker() {
    const prev = document.getElementById('f-photo-prev');
    prev.innerHTML = '<i class="ti ti-camera" aria-hidden="true"></i>'; prev.style.backgroundImage = '';
    document.getElementById('f-photo').value = ''; document.getElementById('f-photo-file').value = ''; document.getElementById('f-photo-cam').value = '';
  }
  document.getElementById('f-photo-btn').onclick = () => document.getElementById('f-photo-file').click();
  document.getElementById('f-photo-cam-btn').onclick = () => document.getElementById('f-photo-cam').click();
  document.getElementById('f-photo-cam').onchange = function() { handlePhotoFile(this); };
  document.getElementById('f-photo-file').onchange = function() { handlePhotoFile(this); };
  function handlePhotoFile(input) {
    const file = input.files && input.files[0]; if (!file) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = function() {
      const max = 320, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url);
      document.getElementById('f-photo').value = data;
      const prev = document.getElementById('f-photo-prev'); prev.innerHTML = ''; prev.style.backgroundImage = 'url(' + data + ')';
    };
    img.src = url;
  }

  const familySearch = crearBuscador('fa', '🏡 Dirección de su casa', 'Escribe la dirección, pulsa Buscar y elige una opción.');
  document.getElementById('f-address-slot').appendChild(familySearch.el);
  let editingFamilyId = null;

  function resetAddForm() {
    resetPhotoPicker();
    ['f-name', 'f-relation', 'f-photo', 'f-phone', 'f-birthday', 'f-note'].forEach(id => document.getElementById(id).value = '');
    familySearch.limpiar();
    selectedIcon = ''; renderIconPicker();
    editingFamilyId = null;
    document.getElementById('add-summary-text').textContent = 'Añadir un familiar';
    document.getElementById('f-submit').textContent = 'Guardar familiar';
    document.getElementById('f-cancel-edit').style.display = 'none';
    document.getElementById('add-error').style.display = 'none';
  }

  function startEditFamily(f) {
    document.getElementById('profile-modal').style.display = 'none';
    activateTab('familia');
    resetAddForm();
    editingFamilyId = f.id;
    document.getElementById('f-name').value = f.name || '';
    document.getElementById('f-relation').value = f.relation || '';
    document.getElementById('f-phone').value = f.phone || '';
    document.getElementById('f-birthday').value = f.birthday || '';
    document.getElementById('f-note').value = f.note || '';
    if (f.photo && FOTO_VALIDA.test(f.photo)) {
      document.getElementById('f-photo').value = f.photo;
      const prev = document.getElementById('f-photo-prev');
      prev.innerHTML = ''; prev.style.backgroundImage = 'url("' + f.photo + '")';
    }
    selectedIcon = f.icon || ''; renderIconPicker();
    familySearch.poner(f.address ? { direccion: f.address, lat: hasCoords(f) ? f.lat : null, lng: hasCoords(f) ? f.lng : null } : null);
    document.getElementById('add-summary-text').textContent = 'Editar a ' + f.name;
    document.getElementById('f-submit').textContent = 'Guardar cambios';
    document.getElementById('f-cancel-edit').style.display = 'flex';
    const det = document.getElementById('add-details');
    det.setAttribute('open', '');
    det.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  document.getElementById('f-cancel-edit').onclick = function() {
    resetAddForm();
    document.getElementById('add-details').removeAttribute('open');
  };

  document.getElementById('add-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    const relation = document.getElementById('f-relation').value.trim();
    const place = familySearch.valor();
    const errorEl = document.getElementById('add-error');
    if (!name || !relation) { errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    const data = {
      name, relation,
      phone: document.getElementById('f-phone').value.trim(),
      address: place ? place.direccion : '',
      photo: document.getElementById('f-photo').value.trim(),
      birthday: document.getElementById('f-birthday').value,
      note: document.getElementById('f-note').value.trim(),
      icon: selectedIcon,
      lat: place && place.lat !== null ? place.lat : null,
      lng: place && place.lng !== null ? place.lng : null
    };
    if (editingFamilyId) {
      const f = family.find(x => x.id === editingFamilyId);
      if (f) Object.assign(f, data);
    } else {
      family.push({ id: newId(), ...data, primary: family.length === 0 });
    }
    resetAddForm();
    document.getElementById('add-details').removeAttribute('open');
    saveFamily(); renderFamily(); renderMap(); updateDashboard(); checkBirthdays();
  });

  document.getElementById('reminder-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const icon = document.getElementById('r-icon').value;
    const input = document.getElementById('r-text'); const time = document.getElementById('r-time');
    const value = input.value.trim();
    if (!value || !time.value) return;
    reminders.push({ id: Date.now().toString(36), text: value, time: time.value, icon, done: false });
    input.value = ''; time.value = '';
    saveReminders(); renderReminders(); updateDashboard();
  });

  document.getElementById('med-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('m-name').value.trim();
    const dose = document.getElementById('m-dose').value.trim();
    const time = document.getElementById('m-time').value;
    const errorEl = document.getElementById('med-error');
    if (!name || !time) { errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    meds.push({ id: Date.now().toString(36), name, dose, time, history: [] });
    document.getElementById('m-name').value = ''; document.getElementById('m-dose').value = ''; document.getElementById('m-time').value = '';
    saveMeds(); renderMeds();
  });

  const placeSearch = crearBuscador('pa', '🏡 Dirección', 'Escribe la dirección, pulsa Buscar y elige una opción.');
  document.getElementById('p-address-slot').appendChild(placeSearch.el);
  document.getElementById('place-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('p-name').value.trim();
    const category = document.getElementById('p-category').value;
    const v = placeSearch.valor();
    const errorEl = document.getElementById('place-error');
    if (!name) { errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    places.push({ id: newId(), name, category, address: v ? v.direccion : '', lat: v && v.lat !== null ? v.lat : null, lng: v && v.lng !== null ? v.lng : null });
    document.getElementById('p-name').value = '';
    placeSearch.limpiar();
    document.getElementById('add-place-details').removeAttribute('open');
    savePlaces(); renderMap();
  });

  document.getElementById('memory-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const title = document.getElementById('mem-title').value.trim();
    const text = document.getElementById('mem-text').value.trim();
    const errorEl = document.getElementById('memory-error');
    if (!title) { errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    memories.push({ id: Date.now().toString(36), title, text });
    document.getElementById('mem-title').value = ''; document.getElementById('mem-text').value = '';
    saveMemories(); renderMemories();
  });

  const homeSearch = crearBuscador('ha', '🏡 Tu dirección', 'Escribe tu dirección, pulsa Buscar y elige una opción.');
  document.getElementById('h-address-slot').appendChild(homeSearch.el);
  document.getElementById('settings-btn').onclick = function() {
    const modal = document.getElementById('settings-modal');
    const show = modal.style.display === 'none';
    modal.style.display = show ? 'block' : 'none';
    if (show) {
      document.getElementById('u-name').value = userName || '';
      homeSearch.poner(home ? { direccion: home.address, lat: home.lat, lng: home.lng } : null);
      document.getElementById('home-error').style.display = 'none';
      modal.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };
  document.getElementById('cancel-home').onclick = function() { document.getElementById('settings-modal').style.display = 'none'; };
  document.getElementById('close-settings-x').onclick = function() { document.getElementById('settings-modal').style.display = 'none'; };

  document.querySelectorAll('details').forEach(function(det) {
    const icon = det.querySelector('summary i.ti');
    if (!icon) return;
    det.addEventListener('toggle', function() {
      icon.className = det.open ? 'ti ti-x' : 'ti ti-plus';
    });
  });
  document.getElementById('save-home').onclick = function() {
    const name = document.getElementById('u-name').value.trim();
    const v = homeSearch.valor();
    const errorEl = document.getElementById('home-error');
    if (!v || v.lat === null) { errorEl.style.display = 'block'; return; }
    errorEl.style.display = 'none';
    userName = name; home = { address: v.direccion, lat: v.lat, lng: v.lng };
    saveUserName(); saveHome();
    document.getElementById('settings-modal').style.display = 'none';
    clearSelection(true);
    renderMap(); updateDashboard();
  };

  document.getElementById('export-btn').onclick = function() {
    const blob = new Blob([JSON.stringify(buildState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'memvia-copia-seguridad.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  document.getElementById('import-btn').onclick = function() { document.getElementById('import-file').click(); };
  document.getElementById('import-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5000000) { showSaveError('Ese archivo es demasiado grande para ser una copia de Memvia.'); return; }
    const reader = new FileReader();
    reader.onload = async function() {
      let data = null;
      try { data = JSON.parse(reader.result); } catch (err) { data = null; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) { showSaveError('Ese archivo no es una copia de Memvia.'); return; }
      if (!(await confirmDialog('Esto reemplaza todos los datos actuales por los de la copia.', 'Sí, reemplazar'))) return;
      const keepConsent = consent;
      applyState(data);
      consent = keepConsent;   // el consentimiento no viaja en las copias: solo lo da la propia persona
      clearSelection(true); routeCache.clear();
      renderAll(); scheduleSave();
      document.getElementById('settings-modal').style.display = 'none';
    };
    reader.readAsText(file);
  });

  document.getElementById('wipe-btn').onclick = async function() {
    if (!(await confirmDialog('¿Seguro que quieres borrar todos los datos de Memvia? Esto no se puede deshacer.', 'Sí, borrar todo'))) return;
    family = []; home = null; reminders = []; meds = []; places = []; memories = []; userName = ''; simpleMode = false; theme = 'auto'; fsScale = 1;
    clearSelection(true); routeCache.clear();
    applyTextSize(); applySimpleMode(); applyTheme();
    renderFamily(); renderMap(); renderReminders(); renderMeds(); renderMemories(); updateDashboard();
    scheduleSave();
    document.getElementById('settings-modal').style.display = 'none';
  };

  document.getElementById('emergency-btn').onclick = function() {
    const target = primaryContact();
    if (!target) { speak('No hay ningún familiar con teléfono guardado.'); return; }
    speak(`Voy a llamar a ${target.name}, tu ${target.relation}.`);
    if (demoMode) { showSaveError('Es una demostración: aquí se llamaría a ' + target.name + '.'); return; }
    window.location.href = 'tel:' + target.phone.replace(/\s+/g, '');
  };
  document.getElementById('speak-home-btn').onclick = function() {
    if (!home) { speak('Todavía no has configurado tu casa.'); return; }
    speak(`Estás en casa. Tu dirección es ${home.address}.`);
  };
  document.getElementById('now-btn').onclick = function() {
    const next = nextReminder();
    if (!next) { speak('Hoy no tienes más tareas pendientes.'); return; }
    speak(`A las ${next.time} toca: ${next.text}.`);
    activateTab('dia');
  };
  document.getElementById('locate-btn').onclick = function() {
    if (!home) { speak('Primero configura tu casa en Ajustes.'); return; }
    if (!navigator.geolocation) { speak('Este dispositivo no permite ver tu ubicación.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const d = distanceKm(home.lat, home.lng, pos.coords.latitude, pos.coords.longitude);
        speak(`Estás a ${d.toFixed(1)} kilómetros de tu casa.`);
      },
      () => speak('No he podido saber tu ubicación. Revisa los permisos del navegador.')
    );
  };

  // Sonido suave al pulsar cualquier botón o enlace, para dar confirmación auditiva
  let audioCtx = null;
  function playClickSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, audioCtx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + 0.13);
    } catch (e) {}
  }
  document.addEventListener('click', function(e) {
    if (e.target.closest('button, a, .icon-chip, .fam-star, .reminder-check')) playClickSound();
  }, true);

  (function initWelcomeScreen() {
    const welcomeEl = document.getElementById('welcome-screen');
    try { if (localStorage.getItem('memvia_skip_welcome') === '1') welcomeEl.style.display = 'none'; } catch (e) { /* ignorar */ }
    document.getElementById('welcome-continue-btn').onclick = function() {
      try { if (document.getElementById('welcome-skip-check').checked) localStorage.setItem('memvia_skip_welcome', '1'); } catch (e) { /* ignorar */ }
      welcomeEl.style.opacity = '0';
      welcomeEl.style.transition = 'opacity .3s ease';
      setTimeout(() => { welcomeEl.style.display = 'none'; }, 300);
    };
  })();

  // Modo sin conexión: el service worker guarda la app para abrirla sin internet
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').catch(function() { /* sin modo sin conexión */ });
    });
  }

})();
