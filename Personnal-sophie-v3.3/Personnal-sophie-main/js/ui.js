/* PERSONAL OS — Composants d'interface sans dépendance. */
import { Utils } from './core.js';

const paths = {
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2.2l1.3-2h7l1.3 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.6"/>',
  shield: '<path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z"/><path d="M9.5 12l2 2 3.5-4"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/>',
  activity: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
  folder: '<path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/>',
  wallet: '<path d="M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12"/><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z"/><path d="M4 5.5v14M8 7h8M8 11h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.6.77 1 1.4 1H21v4h-.08a1.7 1.7 0 0 0-1.52 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', chevron: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4ZM22 9l-6 6M16 9l6 6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="20" r="1"/>',
  cloud: '<path d="M17.5 19H6a4 4 0 0 1-.5-8 6.5 6.5 0 0 1 12.4-1.6A4.8 4.8 0 0 1 17.5 19Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2 3M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.1-.9"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  flag: '<path d="M5 22V3M5 4h12l-2 4 2 4H5"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0M12 12l5-4"/><path d="M12 21h.01"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17a2.1 2.1 0 0 0 3 3l8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4 2.3-2.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 17V5M7 10l5-5 5 5M4 21h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  alert: '<path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  note: '<path d="M4 3h16v18H4zM8 8h8M8 12h8M8 16h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
  timeline: '<path d="M6 3v18M6 7h11M6 13h15M6 19h9"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="13" r="2"/><circle cx="6" cy="19" r="2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-1L20 12M4 12l2.4 5a7 7 0 0 0 11.5-1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  droplet: '<path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-1.5-5.5-4-8 .2 3-1 4-2 4-1.5 0-2-2-1-5-4 2-7 5.5-7 9 0 4 3 7 7 7Z"/>'
};

export function icon(name, size = 20, className = '') {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}

export const Toast = {
  show(message, type = 'success', duration = 3600) {
    const root = document.getElementById('toast-root'); if (!root) return;
    const node = document.createElement('div');
    node.className = `toast toast-${type}`; node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.innerHTML = `<span class="toast-icon">${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check', 18)}</span><span>${Utils.esc(message)}</span><button class="icon-button" aria-label="Fermer">${icon('x', 16)}</button>`;
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('visible'));
    const dismiss = () => { node.classList.remove('visible'); setTimeout(() => node.remove(), 250); };
    node.querySelector('button').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }
};

export const Modal = {
  previousFocus: null,
  init() {
    const dialog = document.getElementById('app-modal'); if (!dialog) return;
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-modal-close]')) this.close();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
  },
  open({ title, eyebrow = 'PERSONAL OS', subtitle = '', content = '', size = 'normal', submitLabel = '', onSubmit = null }) {
    const dialog = document.getElementById('app-modal');
    this.previousFocus = document.activeElement;
    dialog.className = `modal modal-${size}`;
    dialog.innerHTML = `<div class="modal-shell"><header class="modal-header"><div><span class="eyebrow">${Utils.esc(eyebrow)}</span><h2 id="modal-title">${Utils.esc(title)}</h2>${subtitle ? `<p>${Utils.esc(subtitle)}</p>` : ''}</div><button class="icon-button" data-modal-close aria-label="Fermer la fenêtre">${icon('x')}</button></header><div class="modal-content">${content}</div>${submitLabel ? `<footer class="modal-footer"><button class="button ghost" data-modal-close>Annuler</button><button class="button primary" type="submit" form="modal-form">${icon('check', 17)}${Utils.esc(submitLabel)}</button></footer>` : ''}</div>`;
    dialog.setAttribute('aria-labelledby', 'modal-title');
    if (!dialog.open) dialog.showModal();
    dialog.classList.remove('closing');
    requestAnimationFrame(() => dialog.classList.add('opened'));
    if (onSubmit) {
      const form = dialog.querySelector('#modal-form');
      form?.addEventListener('submit', async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        const submit = dialog.querySelector('[type="submit"]'); if (submit) { submit.disabled = true; submit.classList.add('loading'); }
        try { const result = await onSubmit(form); if (result !== false) this.close(); }
        catch (error) { Toast.show(error.message || 'Une erreur est survenue.', 'error'); }
        finally { if (submit) { submit.disabled = false; submit.classList.remove('loading'); } }
      });
    }
    setTimeout(() => dialog.querySelector('input:not([type="hidden"]), textarea, select, button')?.focus({ preventScroll: true }), 80);
    return dialog;
  },
  close() {
    const dialog = document.getElementById('app-modal'); if (!dialog?.open) return;
    dialog.classList.add('closing'); dialog.classList.remove('opened');
    setTimeout(() => { dialog.close(); dialog.innerHTML = ''; this.previousFocus?.focus?.({ preventScroll: true }); }, 180);
  },
  field(field, values = {}) {
    const value = values[field.name] ?? field.value ?? '';
    const id = `field-${field.name}`;
    const described = field.hint ? `${id}-hint` : '';
    const common = `id="${id}" name="${Utils.esc(field.name)}" ${field.required ? 'required' : ''} ${field.disabled ? 'disabled' : ''} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : ''} ${field.maxlength ? `maxlength="${field.maxlength}"` : ''} ${field.placeholder ? `placeholder="${Utils.esc(field.placeholder)}"` : ''} ${described ? `aria-describedby="${described}"` : ''}`;
    let control;
    if (field.type === 'textarea') control = `<textarea ${common} rows="${field.rows || 3}">${Utils.esc(value)}</textarea>`;
    else if (field.type === 'select') {
      const options = (field.options || []).map(option => {
        const item = typeof option === 'object' ? option : { value: option, label: option };
        return `<option value="${Utils.esc(item.value)}" ${String(value) === String(item.value) ? 'selected' : ''}>${Utils.esc(item.label)}</option>`;
      }).join('');
      control = `<select ${common}>${field.placeholder ? `<option value="">${Utils.esc(field.placeholder)}</option>` : ''}${options}</select>`;
    } else if (field.type === 'checkbox') control = `<label class="switch-field"><input type="checkbox" ${common} ${value ? 'checked' : ''}><span class="switch"><span></span></span><span>${Utils.esc(field.checkboxLabel || 'Activé')}</span></label>`;
    else control = `<input type="${field.type || 'text'}" ${common} value="${Utils.esc(value)}">`;
    return `<div class="form-field ${field.full ? 'full' : ''} ${field.type === 'checkbox' ? 'checkbox-field' : ''}"><label for="${id}">${Utils.esc(field.label)}${field.required ? '<span aria-hidden="true"> *</span>' : ''}</label>${control}${field.hint ? `<small id="${id}-hint">${Utils.esc(field.hint)}</small>` : ''}</div>`;
  },
  form({ title, subtitle = '', eyebrow, fields, values = {}, submitLabel = 'Enregistrer', onSubmit, size = 'normal', intro = '' }) {
    const content = `${intro}<form id="modal-form" class="form-grid" novalidate>${fields.map(field => this.field(field, values)).join('')}</form>`;
    return this.open({ title, subtitle, eyebrow, content, size, submitLabel, onSubmit });
  },
  values(form, fields) {
    const output = {};
    fields.forEach(field => {
      const input = form.elements[field.name]; if (!input || field.disabled) return;
      if (field.type === 'checkbox') output[field.name] = input.checked;
      else if (field.type === 'number') output[field.name] = input.value === '' ? null : Number(input.value);
      else output[field.name] = typeof input.value === 'string' ? input.value.trim() : input.value;
    });
    return output;
  },
  confirm({ title = 'Confirmer', message, confirmLabel = 'Supprimer', danger = true }) {
    return new Promise(resolve => {
      const content = `<div class="confirm-message"><span class="confirm-symbol ${danger ? 'danger' : ''}">${icon(danger ? 'alert' : 'info', 28)}</span><p>${Utils.esc(message)}</p></div><div class="confirm-actions"><button class="button ghost" id="confirm-cancel">Annuler</button><button class="button ${danger ? 'danger' : 'primary'}" id="confirm-ok">${Utils.esc(confirmLabel)}</button></div>`;
      this.open({ title, content, size: 'small' });
      document.getElementById('confirm-cancel').addEventListener('click', () => { this.close(); resolve(false); });
      document.getElementById('confirm-ok').addEventListener('click', () => { this.close(); resolve(true); });
    });
  }
};

export function progressBar(value, label = '', tone = '') {
  const safe = Utils.clamp(value);
  return `<div class="progress-wrap ${tone}"><div class="progress-meta">${label ? `<span>${Utils.esc(label)}</span>` : '<span></span>'}<strong>${Math.round(safe)}%</strong></div><div class="progress-track" role="progressbar" aria-valuenow="${Math.round(safe)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${safe}%"></span></div></div>`;
}

export function badge(text, tone = '') { return `<span class="badge ${tone || Utils.slug(text)}">${Utils.esc(text)}</span>`; }

export function emptyState(title, text, action = '', iconName = 'folder') {
  return `<div class="empty-state"><span class="empty-icon">${icon(iconName, 26)}</span><h3>${Utils.esc(title)}</h3><p>${Utils.esc(text)}</p>${action}</div>`;
}

export function sectionHeader(eyebrow, title, description, actions = '') {
  return `<header class="section-heading reveal"><div><span class="eyebrow">${Utils.esc(eyebrow)}</span><h1>${Utils.esc(title)}</h1><p>${Utils.esc(description)}</p></div><div class="heading-actions">${actions}</div></header>`;
}

export const Charts = {
  line(values, { labels = [], color = 'var(--accent)', height = 210, unit = '', fill = true } = {}) {
    const clean = values.map(v => Number(v) || 0); const id = Utils.uid('gradient');
    if (!clean.length) return emptyState('Pas encore de données', 'Ajoutez des éléments pour faire apparaître la courbe.', '', 'activity');
    const w = 680, h = height, padX = 28, padY = 24;
    let min = Math.min(...clean), max = Math.max(...clean);
    if (min === max) { min = Math.max(0, min - 1); max += 1; }
    const points = clean.map((value, i) => ({ x: padX + (clean.length === 1 ? (w - padX * 2) / 2 : i * (w - padX * 2) / (clean.length - 1)), y: h - padY - ((value - min) / (max - min)) * (h - padY * 2), value }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${points.at(-1).x},${h - padY} L${points[0].x},${h - padY} Z`;
    return `<div class="chart chart-line"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Graphique : ${clean.join(', ')} ${Utils.esc(unit)}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${[0, .5, 1].map(n => `<line class="chart-gridline" x1="${padX}" x2="${w - padX}" y1="${padY + n * (h - padY * 2)}" y2="${padY + n * (h - padY * 2)}"/>`).join('')}${fill ? `<path d="${area}" fill="url(#${id})"/>` : ''}<path class="chart-line-path" d="${line}" stroke="${color}"/>${points.map((p, i) => `<g><circle class="chart-point" cx="${p.x}" cy="${p.y}" r="4" fill="${color}"><title>${Utils.esc(labels[i] || '')} : ${p.value}${Utils.esc(unit)}</title></circle>${labels[i] ? `<text class="chart-label" x="${p.x}" y="${h - 4}" text-anchor="middle">${Utils.esc(labels[i])}</text>` : ''}</g>`).join('')}</svg></div>`;
  },
  bars(series, { color = 'var(--accent)', secondary = null, unit = '' } = {}) {
    if (!series.length) return emptyState('Aucune donnée', 'Les barres apparaîtront après votre première saisie.', '', 'activity');
    const max = Math.max(1, ...series.flatMap(item => [Number(item.value) || 0, Number(item.secondary) || 0]));
    return `<div class="bar-chart" role="img" aria-label="Graphique mensuel">${series.map(item => `<div class="bar-column" title="${Utils.esc(item.label)} : ${item.value}${Utils.esc(unit)}"><div class="bar-values"><span>${Math.round(item.value)}</span></div><div class="bars">${secondary !== null || item.secondary !== undefined ? `<i class="bar secondary" style="height:${Utils.clamp((item.secondary / max) * 100, 0, 100)}%;background:${secondary || 'var(--accent-2)'}"></i>` : ''}<i class="bar" style="height:${Utils.clamp((item.value / max) * 100, 0, 100)}%;background:${item.color || color}"></i></div><span class="bar-label">${Utils.esc(item.label)}</span></div>`).join('')}</div>`;
  },
  donut(items, centerLabel = '') {
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    if (!total) return emptyState('Aucune dépense', 'La répartition sera calculée sur vos opérations réelles.', '', 'wallet');
    const palette = ['#37D6A0', '#35BDE0', '#FF9A5A', '#A78BFA', '#E7C873', '#6E8795', '#EC6A88'];
    let offset = 0;
    const circles = items.map((item, index) => {
      const share = item.value / total * 100; const circle = `<circle cx="60" cy="60" r="43" fill="none" stroke="${item.color || palette[index % palette.length]}" stroke-width="14" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}" pathLength="100"><title>${Utils.esc(item.label)} : ${Utils.money(item.value)}</title></circle>`;
      offset += share; return circle;
    }).join('');
    return `<div class="donut-layout"><div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Répartition des dépenses"><circle cx="60" cy="60" r="43" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="14"/>${circles}</svg><div><strong>${Utils.money(total, true)}</strong><span>${Utils.esc(centerLabel)}</span></div></div><div class="chart-legend">${items.slice(0, 7).map((item, index) => `<div><i style="background:${item.color || palette[index % palette.length]}"></i><span>${Utils.esc(item.label)}</span><strong>${Utils.money(item.value)}</strong></div>`).join('')}</div></div>`;
  }
};
