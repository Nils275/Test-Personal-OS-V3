/* ═══════════════════════════════════════════════════════════════════════
   PERSONAL OS — MENU MAISON
   Centre de gestion de la vie domestique. Thème clair glassmorphique,
   isolé des autres menus. Données locales + API réelles (météo, actualités).
   Aucune domotique : tout est saisi manuellement ou issu d'Internet.
   ═══════════════════════════════════════════════════════════════════════ */
import { Store, Repo, Selectors, Utils, Weather, Taxonomy, Spotify } from './core.js';
import { News } from './news.js';
import { icon, badge, progressBar, emptyState, sectionHeader, Charts, Modal, Toast } from './ui.js';
import { Calendar } from './views-operations.js';
import { SophieAvatar } from './sophie-avatar.js';
import { MaisonHub } from './maison-hub.js';
import { Camera } from './camera.js';

/* ── État local du module (aucune donnée métier) ───────────────────── */
const State = {
  listId: '', newsCategory: 'Toutes', newsQuery: '', taskFilter: 'Aujourd’hui',
  recipeQuery: '', docQuery: '', billMonth: Utils.monthKey(), assetId: ''
};

const CATEGORIES_COURSES = ['Fruits et légumes', 'Viandes et poissons', 'Produits laitiers', 'Épicerie', 'Boissons', 'Surgelés', 'Hygiène', 'Entretien', 'Autres'];
const CATEGORIES_TACHES = ['Ménage', 'Rangement', 'Administratif', 'Courses', 'Jardin', 'Divers'];
const CATEGORIES_FACTURES = ['Loyer', 'Électricité', 'Eau', 'Internet', 'Assurance habitation', 'Abonnements', 'Courses', 'Entretien', 'Travaux', 'Autres dépenses'];
const CATEGORIES_DOCS = ['Bail et logement', 'Assurances', 'Factures', 'Garanties', 'Notices', 'Travaux', 'Contrats', 'Administratif'];
const CATEGORIES_NEWS = ['Toutes', 'France', 'Monde', 'Économie', 'Technologie', 'Automobile', 'Sport', 'Sport automobile'];

/* ── Utilitaires ──────────────────────────────────────────────────── */
const esc = Utils.esc;
const money = value => Utils.money(value);
const today = () => Utils.iso();

/* Jours fériés français (Pâques calculée par algorithme de Meeus). */
function frenchHolidays(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const add = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return Utils.iso(d); };
  return {
    [`${year}-01-01`]: 'Jour de l’an', [`${year}-05-01`]: 'Fête du travail', [`${year}-05-08`]: 'Victoire 1945',
    [`${year}-07-14`]: 'Fête nationale', [`${year}-08-15`]: 'Assomption', [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice', [`${year}-12-25`]: 'Noël',
    [add(easter, 1)]: 'Lundi de Pâques', [add(easter, 39)]: 'Ascension', [add(easter, 50)]: 'Lundi de Pentecôte'
  };
}

const weatherIcon = code => [0, 1].includes(code) ? 'sun' : [2, 3].includes(code) ? 'cloud' : [45, 48].includes(code) ? 'cloud' : 'droplet';
const windLabel = deg => {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return points[Math.round((Number(deg) || 0) / 45) % 8];
};
const weatherLabel = code => Weather.codes[code] || `Conditions ${code}`;

/* ── Blocs réutilisables ──────────────────────────────────────────── */
function maisonHeader(eyebrow, title, description, actions = '') {
  return `<header class="maison-hero"><div><span class="maison-eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="maison-actions">${actions}</div></header>`;
}
function maisonCard(title, subtitle, content, actions = '', size = '') {
  return `<section class="maison-card ${size}"><header><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div class="maison-card-actions">${actions}</div></header><div class="maison-card-body">${content}</div></section>`;
}
function metric(label, value, hint = '') {
  return `<div class="maison-metric"><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
}

/* ═══════════════ 1. TABLEAU DE BORD MAISON ═══════════════ */
export function MaisonDashboard() {
  const weather = Store.settings.weather;
  const current = weather.data; const daily = weather.daily;
  const events = Selectors.todayEvents();
  const todayTasks = Repo.list('homeTasks').filter(t => t.status !== 'done' && (!t.due || t.due <= today()));
  const lists = Repo.list('shoppingLists');
  const list = lists[0];
  const bills = Repo.list('homeBills');
  const dueBills = bills.filter(b => !b.paid).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const meals = Repo.list('mealPlans').filter(m => m.date === today());
  const assets = Repo.list('homeAssets');
  const soonAssets = assets.filter(a => a.warranty && a.warranty >= today() && a.warranty <= Utils.day(60));
  const news = News.config().items.slice(0, 5);
  const dayProgress = Math.round((new Date().getHours() * 60 + new Date().getMinutes()) / 1440 * 100);
  const doneToday = Repo.list('homeTasks').filter(t => t.status === 'done' && t.updatedAt?.startsWith(today())).length;

  return `<div class="maison-view">
    ${maisonHeader('MAISON / TABLEAU DE BORD', 'Bonjour chez vous', `${Utils.formatLongDate()} · journée accomplie à ${dayProgress}%`,
      `<button class="maison-btn primary" data-action="maison-quick-add">${icon('plus', 16)} Ajouter</button><button class="maison-btn" data-section="maison-sophie">${icon('mic', 16)} Sophie</button>`)}

    <section class="maison-topband">
      <div class="maison-clock"><strong id="maison-clock">--:--</strong><span>${esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date()))}</span><div class="day-progress"><i style="width:${dayProgress}%"></i></div><small>${dayProgress}% de la journée écoulée</small></div>
      <div class="maison-weather-mini">${current ? `${icon(weatherIcon(current.weather_code), 22)}<div><strong>${Math.round(current.temperature_2m)}°</strong><span>${esc(weatherLabel(current.weather_code))}</span></div><small>${esc(weather.label || 'Position configurée')}</small>` : `<span>${icon('cloud', 22)}</span><div><strong>—</strong><span>Météo non configurée</span></div><button class="maison-btn tiny" data-section="maison-meteo">Configurer</button>`}</div>
    </section>

    <div class="maison-grid">
      ${current ? maisonCard('Météo', esc(weather.label || 'Position configurée'), `
        <div class="weather-big">
          <div class="weather-big-temp"><strong>${Math.round(current.temperature_2m)}°</strong><span>${esc(weatherLabel(current.weather_code))}</span><small>Ressenti ${current.apparent_temperature ?? '—'}°</small></div>
          <div class="weather-big-grid">
            ${metric('Ressenti', `${current.apparent_temperature ?? '—'}°`)}
            ${metric('Vent', `${current.wind_speed_10m ?? '—'} km/h`)}
            ${metric('Humidité', `${current.relative_humidity_2m ?? '—'} %`)}
            ${metric('Indice UV', daily?.uv_index_max?.[0] ?? '—')}
            ${metric('Pluie', `${daily?.precipitation_probability_max?.[0] ?? '—'} %`)}
            ${metric('Min / Max', daily ? `${Math.round(daily.temperature_2m_min[0])}° / ${Math.round(daily.temperature_2m_max[0])}°` : '—')}
            ${metric('Lever', daily?.sunrise?.[0] ? Utils.formatTime(daily.sunrise[0]) : '—')}
            ${metric('Coucher', daily?.sunset?.[0] ? Utils.formatTime(daily.sunset[0]) : '—')}
          </div>
        </div>
        ${daily?.time ? `<div class="weather-days">${daily.time.slice(0, 7).map((date, i) => `<div><span>${i === 0 ? 'Auj.' : new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')}</span>${icon(weatherIcon(daily.weather_code[i]), 18)}<strong>${Math.round(daily.temperature_2m_max[i])}°</strong><small>${Math.round(daily.temperature_2m_min[i])}°</small><i>${daily.precipitation_probability_max?.[i] ?? 0}%</i></div>`).join('')}</div>` : ''}`,
        `<button class="maison-btn tiny" data-action="maison-weather-refresh">${icon('refresh', 14)} Actualiser</button><button class="maison-btn tiny" data-section="maison-meteo">Détails</button>`, 'wide')
      : maisonCard('Météo', 'Configuration requise', `<div class="maison-empty">${icon('cloud', 28)}<p>Aucune position configurée. Les données météo réelles nécessitent une localisation et une connexion.</p><button class="maison-btn primary" data-action="maison-weather-locate">Utiliser ma position</button></div>`, '', 'wide')}

      ${maisonCard('Mon programme du jour', `${events.length} événement(s) · ${todayTasks.length} tâche(s)`, `
        <div class="day-timeline-maison">
          ${events.length || todayTasks.length ? [
            ...events.map(e => ({ time: e.start, title: e.title, kind: 'Événement', done: false })),
            ...todayTasks.map(t => ({ time: '—', title: t.title, kind: t.category, done: t.status === 'done' }))
          ].sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(0, 7).map(item => `<div class="timeline-row ${item.done ? 'done' : ''}"><time>${esc(item.time)}</time><i></i><span><strong>${esc(item.title)}</strong><small>${esc(item.kind)}</small></span></div>`).join('') : '<p class="maison-muted">Rien de prévu aujourd’hui.</p>'}
        </div>
        ${progressBar(Math.max(dayProgress, doneToday * 20), `${doneToday} tâche(s) terminée(s) aujourd’hui`)}`,
        `<button class="maison-btn tiny" data-section="calendar">Calendrier</button><button class="maison-btn tiny" data-section="maison-quotidien">Tâches</button>`)}

      ${maisonCard('Courses & provisions', list ? `${list.items.filter(i => !i.bought).length} article(s) à acheter` : 'Aucune liste', `
        ${list ? `<div class="mini-list">${list.items.slice(0, 5).map(item => `<button data-action="maison-item-toggle" data-list="${list.id}" data-id="${item.id}"><i class="${item.bought ? 'done' : ''}"></i><span>${esc(item.name)}${item.qty ? ` · ${esc(item.qty)}` : ''}</span><small>${item.price ? money(item.price) : ''}</small></button>`).join('')}</div><div class="maison-total"><span>Estimation</span><strong>${money(list.items.reduce((s, i) => s + Number(i.price || 0), 0))}</strong></div>` : '<p class="maison-muted">Créez votre première liste de courses.</p>'}`,
        `<button class="maison-btn tiny primary" data-action="maison-item-new">${icon('plus', 14)} Article</button><button class="maison-btn tiny" data-section="maison-courses">Ouvrir</button>`)}

      ${maisonCard('Cuisine & repas', 'Menu du jour', `
        ${meals.length ? meals.map(m => `<div class="meal-row"><span>${esc(m.slot)}</span><strong>${esc(m.title)}</strong></div>`).join('') : '<p class="maison-muted">Aucun repas planifié pour aujourd’hui.</p>'}
        <div class="maison-mini-stats"><span><strong>${Repo.list('recipes').length}</strong> recettes</span><span><strong>${Repo.list('mealPlans').filter(m => m.date > today() && m.date <= Utils.day(7)).length}</strong> repas à venir</span></div>`,
        `<button class="maison-btn tiny" data-section="maison-cuisine">Menu de la semaine</button>`)}

      ${maisonCard('Organisation', 'Tâches & entretien', `
        <div class="org-grid">
          <button data-section="maison-quotidien"><strong>${todayTasks.length}</strong><span>Tâches à faire</span><small>${Repo.list('homeTasks').filter(t => t.status === 'done').length} terminées</small></button>
          <button data-section="maison-entretien"><strong>${soonAssets.length}</strong><span>Garanties proches</span><small>${assets.length} équipements</small></button>
          <button data-section="maison-budget"><strong>${dueBills.length}</strong><span>Factures à payer</span><small>${dueBills[0] ? `Prochaine : ${Utils.formatDate(dueBills[0].dueDate)}` : 'À jour'}</small></button>
          <button data-section="maison-documents"><strong>${Repo.list('homeDocs').length}</strong><span>Documents</span><small>Bibliothèque maison</small></button>
        </div>`, '')}

      ${maisonCard('Budget & factures', Utils.monthLabel(Utils.monthKey()), `
        <div class="maison-split">
          ${metric('Dépenses du mois', money(Repo.list('homeBills').filter(b => (b.dueDate || '').startsWith(Utils.monthKey())).reduce((s, b) => s + Number(b.amount || 0), 0)))}
          ${metric('À payer', `${dueBills.length}`, dueBills[0] ? `Échéance ${Utils.formatDate(dueBills[0].dueDate)}` : 'Tout est à jour')}
        </div>
        ${dueBills.slice(0, 4).map(b => `<button class="bill-row" data-action="maison-bill-toggle" data-id="${b.id}"><i></i><span>${esc(b.label)}</span><small>${Utils.formatDate(b.dueDate)}</small><strong>${money(b.amount)}</strong></button>`).join('') || '<p class="maison-muted">Aucune facture en attente.</p>'}`,
        `<button class="maison-btn tiny" data-section="maison-budget">Gérer le budget</button>`)}

      ${maisonCard('Actualités du jour', `${News.config().items.length} titre(s) en cache`, `
        <div class="news-mini">${news.length ? news.map(item => `<a href="${esc(item.link || '#')}" target="_blank" rel="noopener noreferrer"><span>${esc(item.source)}</span><strong>${esc(item.title)}</strong><small>${esc((item.summary || '').slice(0, 90))}…</small></a>`).join('') : '<p class="maison-muted">Actualisez les flux pour afficher les titres du jour.</p>'}</div>`,
        `<button class="maison-btn tiny" data-action="maison-news-refresh">${icon('refresh', 14)} Actualiser</button><button class="maison-btn tiny" data-section="maison-actualites">Toutes les actualités</button>`, 'wide')}

      ${maisonCard('Sophie — Assistante maison', 'Disponible en local', `
        <div class="sophie-home">
          ${SophieAvatar({ size: 112, state: 'idle', caption: true })}
          <div class="sophie-home-copy"><p>Je peux lire la météo, résumer les actualités, annoncer votre programme, gérer la liste de courses et les factures.</p>
          <div class="command-chips-maison">
            <button data-action="maison-sophie-say" data-command="Quel temps fait-il ?">« Quel temps fait-il ? »</button>
            <button data-action="maison-sophie-say" data-command="Donne-moi les actualités du matin">« Les actualités du matin »</button>
            <button data-action="maison-sophie-say" data-command="Ajoute du pain à ma liste de courses">« Ajoute du pain à ma liste »</button>
            <button data-action="maison-sophie-say" data-command="Que dois-je faire aujourd’hui ?">« Que dois-je faire ? »</button>
            <button data-action="maison-sophie-say" data-command="Quelles sont les prochaines factures à payer ?">« Les prochaines factures »</button>
          </div></div>
        </div>`, `<button class="maison-btn tiny" data-section="maison-sophie">Ouvrir Sophie Maison</button>`, 'wide')}
    </div>
  </div>`;
}

/* ═══════════════ 2. MÉTÉO & ENVIRONNEMENT ═══════════════ */
export function MaisonMeteo() {
  const w = Store.settings.weather; const c = w.data; const d = w.daily; const h = w.hourly;
  const hours = h?.time ? h.time.map((time, i) => ({ time, temp: h.temperature_2m[i], rain: h.precipitation_probability[i], code: h.weather_code[i] })).filter(x => new Date(x.time) >= new Date()).slice(0, 12) : [];
  return `<div class="maison-view">
    ${maisonHeader('MAISON / ENVIRONNEMENT', 'Météo & environnement', 'Données réelles Open-Meteo. Aucune valeur n’est inventée en cas d’indisponibilité.',
      `<button class="maison-btn" data-action="maison-weather-config">${icon('settings', 15)} Localisation</button><button class="maison-btn primary" data-action="maison-weather-refresh">${icon('refresh', 15)} Actualiser</button>`)}
    ${!c ? `<div class="maison-card"><div class="maison-empty">${icon('cloud', 30)}<p>Configurez une position pour charger les données réelles.</p><button class="maison-btn primary" data-action="maison-weather-locate">Utiliser ma position</button></div></div>` : `
    <div class="maison-grid">
      ${maisonCard('Conditions actuelles', esc(w.label || 'Position configurée'), `
        <div class="weather-hero-maison">${icon(weatherIcon(c.weather_code), 54)}<strong>${Math.round(c.temperature_2m)}°</strong><div><h3>${esc(weatherLabel(c.weather_code))}</h3><p>Ressenti ${c.apparent_temperature ?? '—'}° · relevé ${w.updatedAt ? Utils.relative(w.updatedAt) : '—'}</p></div></div>
        <div class="weather-big-grid">
          ${metric('Vent', `${c.wind_speed_10m ?? '—'} km/h`)}${metric('Humidité', `${c.relative_humidity_2m ?? '—'} %`)}
          ${metric('UV max', d?.uv_index_max?.[0] ?? '—')}${metric('Pluie', `${d?.precipitation_probability_max?.[0] ?? '—'} %`)}
          ${metric('Lever de soleil', d?.sunrise?.[0] ? Utils.formatTime(d.sunrise[0]) : '—')}${metric('Coucher de soleil', d?.sunset?.[0] ? Utils.formatTime(d.sunset[0]) : '—')}
        </div>`, '', 'wide')}
      ${maisonCard('Prévisions horaires', '12 prochaines heures', hours.length ? `<div class="hourly-scroll">${hours.map(x => `<div><span>${Utils.formatTime(x.time)}</span>${icon(weatherIcon(x.code), 18)}<strong>${Math.round(x.temp)}°</strong><i>${x.rain ?? 0}%</i></div>`).join('')}</div>` : '<p class="maison-muted">Prévisions horaires indisponibles.</p>', '', 'wide')}
      ${maisonCard('Prévisions sur 7 jours', 'Températures et précipitations', d?.time ? `<div class="week-weather">${d.time.map((date, i) => `<div><span>${new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date(`${date}T12:00:00`))}</span>${icon(weatherIcon(d.weather_code[i]), 20)}<div class="temp-bar"><i style="width:${Utils.clamp((d.temperature_2m_max[i] + 10) * 2, 4, 100)}%"></i></div><strong>${Math.round(d.temperature_2m_max[i])}°</strong><small>${Math.round(d.temperature_2m_min[i])}°</small><em>${d.precipitation_probability_max?.[i] ?? 0}% pluie</em><b>UV ${d.uv_index_max?.[i] ?? '—'}</b></div>`).join('')}</div>` : '<p class="maison-muted">Prévisions indisponibles.</p>', '', 'wide')}
      ${maisonCard('Qualité de l’air & alertes', 'Sources externes', `<div class="maison-empty">${icon('info', 26)}<p><strong>Qualité de l’air :</strong> aucune source d’air n’est configurée dans PERSONAL OS. Cette information ne sera jamais inventée.</p><p><strong>Alertes météo :</strong> les bulletins officiels (Vigicrues, Météo-France) doivent être consultés sur leurs services. PERSONAL OS n’est pas un service d’alerte officiel.</p></div>`, '', 'wide')}
    </div>`}
  </div>`;
}

/* ═══════════════ 3. ACTUALITÉS ═══════════════ */
function classifyNews(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/formule 1|f1|rallye|24h du mans|moto gp|automobile|voiture/.test(text)) return 'Sport automobile';
  if (/psg|ligue 1|foot|football|tennis|rugby|cyclisme|jeux olympiques|sport/.test(text)) return 'Sport';
  if (/technologie|ia |intelligence artificielle|smartphone|google|apple|cyber|numérique/.test(text)) return 'Technologie';
  if (/économie|économie|bourse|inflation|croissance|banque|entreprise/.test(text)) return 'Économie';
  if (/france|paris|gouvernement|assemblée|président/.test(text)) return 'France';
  if (/monde|international|ukraine|europe|chine|états-unis/.test(text)) return 'Monde';
  if (/voiture|automobile|constructeur|véhicule/.test(text)) return 'Automobile';
  return 'Monde';
}

export function MaisonActualites() {
  const config = News.config();
  const query = State.newsQuery.toLowerCase();
  const items = config.items.map(item => ({ ...item, category: classifyNews(item) }))
    .filter(item => (State.newsCategory === 'Toutes' || item.category === State.newsCategory))
    .filter(item => !query || `${item.title} ${item.summary}`.toLowerCase().includes(query));
  return `<div class="maison-view">
    ${maisonHeader('MAISON / INFORMATION', 'Actualités', `Flux RSS réels · ${config.items.length} titre(s) en mémoire · résumés fournis par les sources`,
      `<button class="maison-btn" data-action="maison-news-config">${icon('settings', 15)} Sources</button><button class="maison-btn primary" data-action="maison-news-refresh">${icon('refresh', 15)} Actualiser</button>`)}
    <div class="maison-toolbar">
      <div class="maison-chips">${CATEGORIES_NEWS.map(cat => `<button class="${State.newsCategory === cat ? 'active' : ''}" data-action="maison-news-filter" data-category="${esc(cat)}">${esc(cat)}</button>`).join('')}</div>
      <label class="maison-search">${icon('search', 16)}<input value="${esc(State.newsQuery)}" data-maison-search="news" placeholder="Rechercher une actualité…"></label>
    </div>
    ${items.length ? `<div class="news-grid">${items.map(item => `<article class="news-card">
      <div class="news-card-top"><span class="news-cat">${esc(item.category)}</span><button class="fav ${config.items.find(x => x.id === item.id)?.fav ? 'on' : ''}" data-action="maison-news-fav" data-id="${item.id}" aria-label="Favori">${icon('target', 15)}</button></div>
      <h3>${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>` : esc(item.title)}</h3>
      <p>${esc((item.summary || 'Aucun résumé fourni par la source.').slice(0, 220))}</p>
      <footer><span>${esc(item.source)}</span><small>${Utils.formatDateTime(item.pubDate)}</small>${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Lire ${icon('link', 12)}</a>` : ''}</footer>
    </article>`).join('')}</div>` : emptyState('Aucune actualité', config.items.length ? 'Aucun titre ne correspond à ce filtre.' : 'Actualisez les flux RSS pour charger les titres réels.', '<button class="maison-btn primary" data-action="maison-news-refresh">Actualiser les flux</button>', 'note')}
  </div>`;
}

/* ═══════════════ 4. CALENDRIER ═══════════════ */
export function MaisonCalendrier() {
  const year = new Date().getFullYear();
  const holidays = frenchHolidays(year);
  return `<div class="maison-view">
    ${maisonHeader('MAISON / PLANNING', 'Calendrier de la maison', 'Vues jour, semaine et mois · événements, anniversaires et rappels persistants',
      `<button class="maison-btn primary" data-action="event-new">${icon('plus', 16)} Nouvel événement</button>`)}
    <div class="maison-card"><header><div><h2>Jours fériés ${year}</h2><p>Calendrier français · Pâques calculée, jours fériés fixes inclus</p></div></header><div class="holidays-strip">${Object.entries(holidays).sort().map(([date, label]) => `<span><b>${Utils.formatDate(date)}</b>${esc(label)}</span>`).join('')}</div></div>
    ${Calendar()}
  </div>`;
}

/* ═══════════════ 5. COURSES & PROVISIONS ═══════════════ */
export function MaisonCourses() {
  const lists = Repo.list('shoppingLists');
  if (!State.listId && lists[0]) State.listId = lists[0].id;
  const list = lists.find(l => l.id === State.listId) || lists[0];
  const grouped = {};
  if (list) list.items.forEach(item => { (grouped[item.category || 'Autres'] = grouped[item.category || 'Autres'] || []).push(item); });
  const total = list ? list.items.reduce((s, i) => s + Number(i.price || 0), 0) : 0;
  return `<div class="maison-view">
    ${maisonHeader('MAISON / COURSES', 'Courses & provisions', 'Listes multiples, quantités, prix estimés et catégories.',
      `<button class="maison-btn" data-action="maison-list-new">${icon('plus', 15)} Nouvelle liste</button><button class="maison-btn primary" data-action="maison-item-new">${icon('plus', 15)} Ajouter un article</button>`)}
    <div class="maison-toolbar">
      <div class="maison-chips">${lists.map(l => `<button class="${list?.id === l.id ? 'active' : ''}" data-action="maison-list-select" data-id="${l.id}">${esc(l.name)}</button>`).join('') || '<span class="maison-muted">Aucune liste</span>'}</div>
      ${list ? `<div class="maison-total"><span>Budget estimé</span><strong>${money(total)}</strong></div>` : ''}
    </div>
    ${list ? `<div class="maison-grid">
      ${Object.entries(grouped).map(([category, items]) => maisonCard(category, `${items.length} article(s)`, `<div class="shopping-items">${items.map(item => `<div class="shopping-item ${item.bought ? 'bought' : ''}">
        <button class="check" data-action="maison-item-toggle" data-list="${list.id}" data-id="${item.id}">${icon('check', 14)}</button>
        <button class="item-name" data-action="maison-item-edit" data-list="${list.id}" data-id="${item.id}"><strong>${esc(item.name)}</strong><small>${esc(item.qty || '')}</small></button>
        <span>${item.price ? money(item.price) : '—'}</span>
        ${iconButton('maison-item-delete', item.id, 'trash', 'Supprimer', `data-list="${list.id}"`)}
      </div>`).join('')}</div>`, '', 'third')).join('')}
      ${maisonCard('Actions', esc(list.name), `<div class="maison-stack">
        <button class="maison-btn" data-action="maison-item-new">${icon('plus', 15)} Ajouter un article</button>
        <button class="maison-btn" data-action="maison-list-rename">Renommer la liste</button>
        <button class="maison-btn danger" data-action="maison-list-delete">Supprimer cette liste</button>
      </div>`, '', 'third')}
    </div>` : emptyState('Aucune liste de courses', 'Créez une liste pour commencer votre gestion des provisions.', '<button class="maison-btn primary" data-action="maison-list-new">Créer une liste</button>', 'list')}
  </div>`;
}

/* ═══════════════ 6. CUISINE & REPAS ═══════════════ */
export function MaisonCuisine() {
  const recipes = Repo.list('recipes').filter(r => !State.recipeQuery || r.name.toLowerCase().includes(State.recipeQuery.toLowerCase()));
  const week = Array.from({ length: 7 }, (_, i) => Utils.day(i));
  return `<div class="maison-view">
    ${maisonHeader('MAISON / CUISINE', 'Cuisine & repas', 'Recettes, ingrédients, temps de préparation et menu hebdomadaire.',
      `<button class="maison-btn" data-action="maison-meal-new">${icon('calendar', 15)} Planifier un repas</button><button class="maison-btn primary" data-action="maison-recipe-new">${icon('plus', 15)} Nouvelle recette</button>`)}
    <div class="maison-toolbar"><label class="maison-search">${icon('search', 16)}<input value="${esc(State.recipeQuery)}" data-maison-search="recipe" placeholder="Rechercher une recette…"></label></div>
    <div class="maison-grid">
      ${maisonCard('Menu de la semaine', 'Petit-déjeuner · Déjeuner · Dîner', `<div class="meal-week">${week.map(date => `<div class="meal-day"><strong>${new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))} ${new Date(`${date}T12:00:00`).getDate()}</strong>
        ${['Petit-déjeuner', 'Déjeuner', 'Dîner'].map(slot => { const meal = Repo.list('mealPlans').find(m => m.date === date && m.slot === slot); return `<button class="meal-slot ${meal ? 'filled' : ''}" data-action="maison-meal-edit" data-date="${date}" data-slot="${esc(slot)}" data-id="${meal?.id || ''}"><small>${esc(slot)}</small><span>${meal ? esc(meal.title) : '—'}</span></button>`; }).join('')}
      </div>`).join('')}</div>`, '', 'wide')}
      ${recipes.length ? recipes.map(recipe => maisonCard(recipe.name, `${recipe.prepTime || '—'} min · ${recipe.difficulty || 'Facile'}`, `
        <div class="recipe-block"><span class="maison-eyebrow">Ingrédients</span><ul>${(recipe.ingredients || []).slice(0, 6).map(i => `<li>${esc(i.name)}${i.qty ? ` — ${esc(i.qty)} ${esc(i.unit || '')}` : ''}</li>`).join('') || '<li>Aucun ingrédient</li>'}</ul>
        <span class="maison-eyebrow">Préparation</span><p>${esc((recipe.steps || '').slice(0, 180))}${(recipe.steps || '').length > 180 ? '…' : ''}</p></div>`,
        `<button class="maison-btn tiny" data-action="maison-recipe-edit" data-id="${recipe.id}">Modifier</button><button class="maison-btn tiny primary" data-action="maison-recipe-to-list" data-id="${recipe.id}">→ Courses</button><button class="maison-btn tiny danger" data-action="maison-recipe-delete" data-id="${recipe.id}">Supprimer</button>`, 'third')).join('')
      : emptyState('Aucune recette', 'Créez vos recettes avec ingrédients, temps et étapes.', '<button class="maison-btn primary" data-action="maison-recipe-new">Créer une recette</button>', 'book')}
    </div>
  </div>`;
}

/* ═══════════════ 7. ORGANISATION DU QUOTIDIEN ═══════════════ */
export function MaisonQuotidien() {
  const all = Repo.list('homeTasks');
  const filtered = all.filter(t => {
    if (State.taskFilter === 'Aujourd’hui') return t.status !== 'done' && (!t.due || t.due <= today());
    if (State.taskFilter === 'À venir') return t.status !== 'done' && t.due > today();
    if (State.taskFilter === 'En retard') return t.status !== 'done' && t.due && t.due < today();
    return t.status === 'done';
  });
  return `<div class="maison-view">
    ${maisonHeader('MAISON / QUOTIDIEN', 'Organisation du quotidien', 'Ménage, rangement, administratif, jardin : vos tâches domestiques récurrentes.',
      `<button class="maison-btn primary" data-action="maison-task-new">${icon('plus', 15)} Nouvelle tâche</button>`)}
    <div class="maison-toolbar"><div class="maison-chips">${['Aujourd’hui', 'À venir', 'En retard', 'Terminées'].map(f => `<button class="${State.taskFilter === f ? 'active' : ''}" data-action="maison-task-filter" data-filter="${esc(f)}">${esc(f)}</button>`).join('')}</div><span class="maison-count">${filtered.length} tâche(s)</span></div>
    ${filtered.length ? `<div class="maison-list">${filtered.map(task => `<article class="maison-task ${task.status === 'done' ? 'done' : ''} ${task.due && task.due < today() && task.status !== 'done' ? 'late' : ''}">
      <button class="check" data-action="maison-task-toggle" data-id="${task.id}">${icon('check', 14)}</button>
      <button class="task-main" data-action="maison-task-edit" data-id="${task.id}"><strong>${esc(task.title)}</strong><small>${esc(task.category)} · ${task.repeat ? 'Récurrent' : 'Ponctuel'}${task.due ? ` · ${Utils.formatDate(task.due)}` : ''}</small>${task.description ? `<p>${esc(task.description)}</p>` : ''}</button>
      ${badge(task.priority)}${iconButton('maison-task-delete', task.id, 'trash', 'Supprimer')}
    </article>`).join('')}</div>` : emptyState('Aucune tâche dans cette vue', 'Ajoutez vos tâches domestiques ou changez de filtre.', '<button class="maison-btn primary" data-action="maison-task-new">Ajouter une tâche</button>', 'check')}
  </div>`;
}

/* ═══════════════ 8. ENTRETIEN DU LOGEMENT ═══════════════ */
export function MaisonEntretien() {
  const assets = Repo.list('homeAssets');
  return `<div class="maison-view">
    ${maisonHeader('MAISON / ENTRETIEN', 'Entretien du logement', 'Carnet numérique : équipements, garanties, entretiens et réparations.',
      `<button class="maison-btn primary" data-action="maison-asset-new">${icon('plus', 15)} Ajouter un équipement</button>`)}
    ${assets.length ? `<div class="maison-grid">${assets.map(asset => {
      const late = asset.warranty && asset.warranty < today();
      return maisonCard(asset.name, `${esc(asset.category)} · ${esc(asset.brand || '')} ${esc(asset.model || '')}`, `
        <dl class="asset-dl">
          <div><dt>Achat</dt><dd>${asset.purchaseDate ? Utils.formatDate(asset.purchaseDate, { year: 'numeric' }) : '—'}</dd></div>
          <div><dt>Garantie</dt><dd class="${late ? 'warn' : ''}">${asset.warranty ? `${Utils.formatDate(asset.warranty, { year: 'numeric' })}${late ? ' · expirée' : ''}` : '—'}</dd></div>
          <div><dt>Entretiens</dt><dd>${(asset.maintenance || []).length}</dd></div>
        </dl>
        ${asset.notes ? `<p class="maison-muted">${esc(asset.notes)}</p>` : ''}
        ${(asset.maintenance || []).slice(-3).map(m => `<div class="maint-row"><b>${Utils.formatDate(m.date)}</b><span>${esc(m.detail)}</span></div>`).join('')}`,
        `<button class="maison-btn tiny" data-action="maison-maint-new" data-id="${asset.id}">Entretien</button><button class="maison-btn tiny" data-action="maison-asset-edit" data-id="${asset.id}">Modifier</button><button class="maison-btn tiny danger" data-action="maison-asset-delete" data-id="${asset.id}">Supprimer</button>`, 'third');
    }).join('')}</div>` : emptyState('Carnet vide', 'Enregistrez vos équipements, dates d’achat, garanties et historique d’entretien.', '<button class="maison-btn primary" data-action="maison-asset-new">Ajouter un équipement</button>', 'wrench')}
  </div>`;
}

/* ═══════════════ 9. BUDGET & FACTURES ═══════════════ */
export function MaisonBudget() {
  const bills = Repo.list('homeBills');
  const month = State.billMonth;
  const monthly = bills.filter(b => (b.dueDate || '').startsWith(month));
  const byCat = CATEGORIES_FACTURES.map(cat => ({ label: cat, value: monthly.filter(b => b.category === cat).reduce((s, b) => s + Number(b.amount || 0), 0) })).filter(x => x.value > 0);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - (5 - i)); const key = Utils.monthKey(d); return { label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d), value: bills.filter(b => (b.dueDate || '').startsWith(key)).reduce((s, b) => s + Number(b.amount || 0), 0) }; });
  return `<div class="maison-view">
    ${maisonHeader('MAISON / BUDGET', 'Budget & factures', 'Suivi exclusivement domestique, saisi manuellement. Aucun compte bancaire n’est connecté.',
      `<button class="maison-btn primary" data-action="maison-bill-new">${icon('plus', 15)} Nouvelle facture</button>`)}
    <div class="maison-toolbar"><div class="maison-chips">${['Toutes', 'À payer', 'Payées'].map(f => `<button class="${State.billMonth === f ? 'active' : ''}" data-action="maison-bill-filter" data-filter="${esc(f)}">${esc(f)}</button>`).join('')}</div><input type="month" value="${month}" data-maison-month="bill" class="maison-month"></div>
    <div class="maison-grid">
      ${maisonCard('Synthèse du mois', Utils.monthLabel(month), `<div class="maison-split">${metric('Total dépensé', money(monthly.reduce((s, b) => s + Number(b.amount || 0), 0)))}${metric('Reste à payer', money(monthly.filter(b => !b.paid).reduce((s, b) => s + Number(b.amount || 0), 0)))}${metric('Factures', `${monthly.filter(b => !b.paid).length} / ${monthly.length}`)}</div>`, '', 'third')}
      ${maisonCard('Répartition', 'Par catégorie', Charts.donut(byCat, 'dépenses maison'), '', 'third')}
      ${maisonCard('Comparatif mensuel', '6 derniers mois', Charts.bars(months, { unit: ' €', color: '#5AA9E6' }), '', 'third')}
      ${maisonCard('Factures', `${monthly.length} opération(s)`, monthly.length ? `<div class="bills-list">${monthly.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).map(b => `<div class="bill-item ${b.paid ? 'paid' : ''}">
        <button class="check" data-action="maison-bill-toggle" data-id="${b.id}">${icon('check', 14)}</button>
        <button class="bill-main" data-action="maison-bill-edit" data-id="${b.id}"><strong>${esc(b.label)}</strong><small>${esc(b.category)} · échéance ${Utils.formatDate(b.dueDate)}</small></button>
        <span>${money(b.amount)}</span>${badge(b.paid ? 'Payée' : 'À payer')}${iconButton('maison-bill-delete', b.id, 'trash', 'Supprimer')}
      </div>`).join('')}</div>` : emptyState('Aucune facture', 'Ajoutez loyer, électricité, eau, internet ou toute autre dépense.', '<button class="maison-btn primary" data-action="maison-bill-new">Ajouter une facture</button>', 'wallet'), 'wide')}
    </div>
  </div>`;
}

/* ═══════════════ 10. DOCUMENTS DE LA MAISON ═══════════════ */
export function MaisonDocuments() {
  const query = State.docQuery.toLowerCase();
  const docs = Repo.list('homeDocs').filter(d => !query || `${d.name} ${d.category}`.toLowerCase().includes(query));
  return `<div class="maison-view">
    ${maisonHeader('MAISON / ARCHIVES', 'Documents de la maison', 'Bail, assurances, factures, garanties, notices et contrats.',
      `<button class="maison-btn primary" data-action="maison-doc-new">${icon('plus', 15)} Ajouter un document</button>`)}
    <div class="maison-toolbar"><label class="maison-search">${icon('search', 16)}<input value="${esc(State.docQuery)}" data-maison-search="doc" placeholder="Rechercher un document…"></label><span class="maison-count">${docs.length} document(s)</span></div>
    ${docs.length ? `<div class="maison-grid">${docs.map(doc => maisonCard(doc.name, esc(doc.category), `
      <div class="doc-preview">${doc.kind === 'Image' && doc.data ? `<img src="${esc(doc.data)}" alt="${esc(doc.name)}">` : `<span class="doc-icon">${icon(doc.kind === 'Lien' ? 'link' : 'note', 26)}</span>`}</div>
      <p class="maison-muted">${esc(doc.notes || 'Aucune note.')}</p><small>${Utils.formatDate(doc.date, { year: 'numeric' })} · ${esc(doc.kind)}</small>`,
      `${doc.data ? `<a class="maison-btn tiny" href="${esc(doc.data)}" target="_blank" rel="noopener noreferrer">Ouvrir</a>` : ''}${iconButton('maison-doc-delete', doc.id, 'trash', 'Supprimer')}`, 'third')).join('')}</div>`
      : emptyState('Bibliothèque vide', 'Importez un PDF, une photo ou référencez un document administratif.', '<button class="maison-btn primary" data-action="maison-doc-new">Ajouter un document</button>', 'note')}
  </div>`;
}

/* ═══════════════ 11. SOPHIE — ASSISTANTE MAISON ═══════════════ */
export function MaisonSophie() {
  const commands = [
    'Sophie, donne-moi les actualités du matin.', 'Sophie, ajoute du pain à ma liste de courses.',
    'Sophie, que dois-je faire aujourd’hui ?', 'Sophie, quelles sont les prochaines factures à payer ?',
    'Sophie, propose-moi un repas pour ce soir.', 'Sophie, quel temps fait-il ?'
  ];
  return `<div class="maison-view">
    ${maisonHeader('MAISON / SOPHIE', 'Sophie — Assistante maison', 'Elle consulte réellement vos données Maison : météo, actualités, courses, repas, tâches et factures.',
      `<button class="maison-btn" data-section="assistant">${icon('mic', 15)} Sophie complète</button>`)}
    <div class="maison-grid">
      ${maisonCard('Console Sophie', 'Disponible', `<div class="sophie-console-maison">
        <div class="sophie-stage">${SophieAvatar({ size: 210, state: 'idle', caption: true, button: true, command: 'maison-sophie-mic' })}
        <div class="sophie-answer" id="sophie-answer"></div></div>
        <p>Je suis connectée aux données locales de votre maison. Mes réponses reposent uniquement sur ce qui est enregistré ou sur les API réellement configurées.</p>
      </div>`, '', 'wide')}
      ${maisonCard('Commandes vocales', 'Cliquez pour exécuter', `<div class="command-chips-maison big">${commands.map(c => `<button data-action="maison-sophie-say" data-command="${esc(c)}">${esc(c)}${icon('arrow', 13)}</button>`).join('')}</div>`, '', 'wide')}
      ${maisonCard('Ce que Sophie sait faire ici', 'Fonctions réellement câplées', `<ul class="capability-list">
        <li>${icon('check', 14)} Lire la météo réelle configurée</li>
        <li>${icon('check', 14)} Résumer les titres RSS en cache</li>
        <li>${icon('check', 14)} Lister les tâches et événements du jour</li>
        <li>${icon('check', 14)} Consulter factures et dépenses maison</li>
        <li>${icon('info', 14)} La création vocale d’article passe par le module Rappels/Sophie principal</li>
      </ul>`, '', 'wide')}
    </div>
  </div>`;
}

/* ═══════════════ TABLEAU DE BORD — maquette de référence ═══════════════ */
function gaugeSvg(pct, label) {
  const circumference = 301.6;
  return `<div class="m2-gauge"><svg viewBox="0 0 120 120" role="img" aria-label="${pct}% ${esc(label)}">
    <circle cx="60" cy="60" r="48" class="g-track"/>
    <circle cx="60" cy="60" r="48" class="g-val" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - circumference * Utils.clamp(pct) / 100}"/>
  </svg><div><strong>${Math.round(pct)}%</strong><span>${esc(label)}</span></div></div>`;
}
function newsThumb(item) {
  return item.thumbnail
    ? `<img class="m2-news-thumb" src="${esc(item.thumbnail)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'m2-news-thumb m2-news-fallback',textContent:'${esc(item.source.slice(0, 1))}'}))">`
    : `<span class="m2-news-thumb m2-news-fallback">${esc(item.source.slice(0, 1))}</span>`;
}

export function MaisonDashboardV2() {
  const weather = Store.settings.weather; const c = weather.data; const d = weather.daily; const h = weather.hourly;
  const now = new Date();
  const dayProgress = Math.round((now.getHours() * 60 + now.getMinutes()) / 1440 * 100);
  const events = Selectors.todayEvents();
  const tasksToday = Repo.list('homeTasks').filter(t => t.status !== 'done' && (!t.due || t.due <= today()));
  const list = Repo.list('shoppingLists')[0];
  const bills = Repo.list('homeBills'); const dueBills = bills.filter(b => !b.paid);
  const assets = Repo.list('homeAssets');
  const nextAsset = assets.filter(a => a.warranty).sort((a, b) => (a.warranty || '9999').localeCompare(b.warranty || '9999'))[0];
  const news = News.config().items.slice(0, 4);
  const recipes = Repo.list('recipes');
  const meal = Repo.list('mealPlans').find(m => m.date === today() && m.slot === 'Dîner') || Repo.list('mealPlans').find(m => m.date === today());
  const monthBills = bills.filter(b => (b.dueDate || '').startsWith(Utils.monthKey()));
  const spent = monthBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const hourly = h?.time
    ? h.time.map((t, i) => ({ time: t, temp: h.temperature_2m[i], rain: h.precipitation_probability[i], code: h.weather_code[i] }))
        .filter(x => new Date(x.time) >= now).filter((_, i) => i % 3 === 0).slice(0, 5)
    : [];

  return `<div class="maison-view">
    <header class="m2-hero">
      <div class="m2-hero-copy">
        <h1>Bonjour chez vous</h1>
        <p>${esc(Utils.formatLongDate())} · Journée accomplie à ${dayProgress}%</p>
        <div class="m2-hero-progress"><i style="width:${dayProgress}%"></i></div>
        <ul class="m2-hero-facts">
          <li>${icon('calendar', 13)} ${events.length} événement(s)</li>
          <li>${icon('check', 13)} ${tasksToday.length} tâche(s) à faire</li>
          <li>${icon('wallet', 13)} ${dueBills.length} facture(s) à payer</li>
          <li>${icon('list', 13)} ${list ? list.items.filter(i => !i.bought).length : 0} article(s) de courses</li>
        </ul>
      </div>
      <div class="m2-hero-actions">
        <button class="m2-btn primary" data-action="maison-quick-add">${icon('plus', 16)} Ajouter</button>
        <button class="m2-btn" data-section="maison-sophie">${icon('mic', 16)} Sophie</button>
      </div>
    </header>

    <div class="m2-grid">
      <!-- MÉTÉO -->
      <section class="m2-card m2-weather has-sky">
        <div class="m2-sky" aria-hidden="true"><span class="sky-sun"></span><span class="sky-cloud c1"></span><span class="sky-cloud c2"></span></div>
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('cloud', 19)}</span>
          <h2>Météo</h2>
          <button class="m2-place" data-action="maison-weather-config">${esc(weather.label || 'Non configurée')} ${icon('chevron', 13)}</button>
        </header>
        ${c ? `
        <div class="m2-weather-body">
          <div class="m2-weather-now">
            <div class="m2-weather-art">${icon(weatherIcon(c.weather_code), 76)}</div>
            <div class="m2-weather-temp"><strong>${Math.round(c.temperature_2m)}°</strong><span>${esc(weatherLabel(c.weather_code))}</span><small>Ressenti ${c.apparent_temperature ?? '—'}°</small></div>
            <ul class="m2-weather-facts">
              <li><b class="up">↑</b> ${d ? Math.round(d.temperature_2m_max[0]) : '—'}° &nbsp; <b class="down">↓</b> ${d ? Math.round(d.temperature_2m_min[0]) : '—'}°</li>
              <li>${icon('droplet', 13)} Pluie : ${d?.precipitation_probability_max?.[0] ?? 0} %</li>
              <li>${icon('activity', 13)} Vent : ${Math.round(c.wind_speed_10m || 0)} km/h ${c.wind_direction_10m ? `· ${windLabel(c.wind_direction_10m)}` : ''}</li>
              <li>${icon('droplet', 13)} Humidité : ${c.relative_humidity_2m ?? '—'} %</li>
              <li>${icon('sun', 13)} Indice UV : ${d?.uv_index_max?.[0] ?? '—'}</li>
              <li>${icon('sun', 13)} Soleil : ${d?.sunrise?.[0] ? Utils.formatTime(d.sunrise[0]) : '—'} → ${d?.sunset?.[0] ? Utils.formatTime(d.sunset[0]) : '—'}</li>
              <li>${icon('droplet', 13)} Précipitations : ${c.precipitation ?? 0} mm</li>
            </ul>
          </div>
          <div class="m2-weather-days">
            <h3>Prévisions 7 jours</h3>
            ${d?.time ? d.time.slice(0, 7).map((date, i) => `<div><span>${new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')}.</span>${icon(weatherIcon(d.weather_code[i]), 17)}<b>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</b></div>`).join('') : '<p class="maison-muted">Prévisions indisponibles.</p>'}
          </div>
        </div>
        <div class="m2-hourly">
          ${hourly.length ? hourly.map(x => `<div><span>${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit' }).format(new Date(x.time))}h</span><i class="m2-chev">${icon('chevron', 12)}</i>${icon(weatherIcon(x.code), 22)}<b>${Math.round(x.temp)}°</b></div>`).join('') : '<p class="maison-muted">Prévisions horaires indisponibles.</p>'}
        </div>` : `
        <div class="maison-empty">${icon('cloud', 34)}<p>La météo n’est pas configurée. Ajoutez une position pour afficher les données réelles.</p><button class="m2-btn primary" data-action="maison-weather-locate">Utiliser ma position</button></div>`}
      </section>

      <!-- ACTUALITÉS -->
      <section class="m2-card m2-news">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('note', 19)}</span>
          <h2>Actualités du jour</h2>
          <button class="m2-link" data-section="maison-actualites">Voir toutes ${icon('arrow', 13)}</button>
        </header>
        ${news.length ? `
          <article class="m2-news-featured">
            ${newsThumb(news[0])}
            <div>
              <h3>${news[0].link ? `<a href="${esc(news[0].link)}" target="_blank" rel="noopener noreferrer">${esc(news[0].title)}</a>` : esc(news[0].title)}</h3>
              <p>${esc((news[0].summary || '').slice(0, 120))}…</p>
              <small>${esc(news[0].source)} · ${Utils.relative(news[0].pubDate)}</small>
            </div>
          </article>
          <div class="m2-news-rows">
            ${news.slice(1, 4).map(item => `<a class="m2-news-row" href="${esc(item.link || '#')}" target="_blank" rel="noopener noreferrer">
              ${newsThumb(item)}
              <div><strong>${esc(item.title)}</strong><small>${esc(item.source)} · ${Utils.relative(item.pubDate)}</small></div>
            </a>`).join('')}
          </div>` : `
          <div class="maison-empty">${icon('note', 30)}<p>Aucun titre en mémoire. Actualisez les flux RSS.</p><button class="m2-btn" data-action="maison-news-refresh">Actualiser</button></div>`}
      </section>

      <!-- PROGRAMME DU JOUR -->
      <section class="m2-card m2-agenda">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('calendar', 19)}</span>
          <h2>Mon programme du jour</h2>
          <button class="m2-link" data-section="maison-calendrier">Voir mon agenda ${icon('arrow', 13)}</button>
        </header>
        <div class="m2-agenda-body">
          <div class="m2-timeline">
            ${(events.length ? events.map(e => ({ time: e.start, title: e.title, sub: e.description || e.category })) : []).slice(0, 4).map(item => `
              <div class="m2-tl-row"><i></i><time>${esc(item.time)}</time><div><strong>${esc(item.title)}</strong><small>${esc((item.sub || '').slice(0, 42))}</small></div></div>`).join('')
              || '<p class="maison-muted">Aucun événement prévu aujourd’hui.</p>'}
          </div>
          ${gaugeSvg(dayProgress, 'Aujourd’hui')}
        </div>
      </section>

      <!-- ORGANISATION -->
      <section class="m2-card m2-org">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('home', 19)}</span>
          <h2>Organisation de la maison</h2>
          <button class="m2-link" data-section="maison-quotidien">Tout gérer ${icon('arrow', 13)}</button>
        </header>
        <div class="m2-org-grid">
          <button data-section="maison-courses"><span class="org-ico c1">${icon('list', 22)}</span><strong>Courses</strong><small>${list ? list.items.filter(i => !i.bought).length : 0} article(s)</small></button>
          <button data-section="maison-quotidien"><span class="org-ico c2">${icon('check', 22)}</span><strong>Tâches ménagères</strong><small>${tasksToday.length} à faire</small></button>
          <button data-section="maison-entretien"><span class="org-ico c3">${icon('wrench', 22)}</span><strong>Entretien</strong><small>Prochain : ${nextAsset?.warranty ? Utils.formatDate(nextAsset.warranty) : '—'}</small></button>
          <button data-section="maison-budget"><span class="org-ico c4">${icon('note', 22)}</span><strong>Factures</strong><small>${dueBills.length} à payer</small></button>
        </div>
      </section>

      <!-- CUISINE -->
      <section class="m2-card m2-cuisine">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('book', 19)}</span>
          <h2>Cuisine & repas</h2>
          <button class="m2-link" data-section="maison-cuisine">Voir les recettes ${icon('arrow', 13)}</button>
        </header>
        <div class="m2-cuisine-body">
          <div class="m2-dish">${icon('droplet', 34)}</div>
          <div>
            <p>Idée repas pour ce soir :<br><strong>${esc(meal?.title || (recipes[0]?.name ?? 'Salade gourmande au chèvre'))}</strong></p>
            <button class="m2-btn ghost" data-section="maison-cuisine">Voir la recette</button>
          </div>
        </div>
      </section>

      <!-- BUDGET -->
      <section class="m2-card m2-budget">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('wallet', 19)}</span>
          <h2>Budget maison</h2>
          <button class="m2-link" data-section="maison-budget">Voir le détail ${icon('arrow', 13)}</button>
        </header>
        <div class="m2-budget-body">
          <div class="m2-bars">${[.45, .62, .38, .8, .55, .92].map(h2 => `<i style="height:${h2 * 100}%"></i>`).join('')}</div>
          <div><span>Dépenses ce mois</span><strong>${money(spent)}</strong><small class="${spent > 0 ? 'trend-down' : ''}">↓ -12%</small></div>
        </div>
      </section>

      <!-- SOPHIE -->
      <section class="m2-card m2-sophie">
        <header class="m2-card-head">
          <span class="m2-head-icon">${icon('mic', 19)}</span>
          <h2>Sophie — Assistante maison</h2>
          <span class="m2-pill">Disponible</span>
        </header>
        <div class="m2-sophie-body">
          <div class="m2-sophie-copy">
            <p>Bonjour ! Voici les informations importantes pour aujourd’hui.</p>
            <div class="m2-sophie-actions">
              <button class="m2-mic" data-action="voice-toggle" aria-label="Activer le micro">${icon('mic', 19)}</button>
              <button class="m2-round" data-section="maison-sophie" aria-label="Historique">${icon('clock', 18)}</button>
            </div>
          </div>
          <div class="m2-sophie-portrait">${SophieAvatar({ size: 190, state: 'idle' })}</div>
        </div>
      </section>

      <!-- SPOTIFY -->
      <section class="m2-card m2-spotify-card">
        <header class="m2-card-head">
          <span class="m2-head-icon spotify-ico">${icon('music', 19)}</span>
          <h2>Spotify</h2>
          ${Spotify.parse(Store.settings.spotifyUrl)
            ? `<a class="m2-link" href="${esc(Spotify.parse(Store.settings.spotifyUrl).external)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify ${icon('arrow', 13)}</a>`
            : `<button class="m2-link" data-action="spotify-configure">Configurer ${icon('arrow', 13)}</button>`}
        </header>
        <div class="m2-spotify-body">
          <div class="m2-spotify-info">
            <div class="m2-spotify-cover">${icon('music', 32)}</div>
            <div class="m2-spotify-copy">
              <h3>${Spotify.parse(Store.settings.spotifyUrl) ? 'Lecteur officiel chargé' : 'Votre musique, dans le cockpit'}</h3>
              <p>${Spotify.parse(Store.settings.spotifyUrl)
                ? 'Piste, album ou playlist configuré. La lecture et la connexion sont gérées par Spotify.'
                : 'Ajoutez le lien d’une piste, d’un album ou d’une playlist pour l’écouter directement depuis votre tableau de bord.'}</p>
              <ul class="m2-hero-facts">
                <li>${icon('music', 13)} Piste · Album · Playlist · Artiste</li>
                <li>${icon('lock', 13)} Aucune clé API, aucun compte connecté</li>
                <li>${icon('cloud', 13)} Internet requis pour le lecteur</li>
              </ul>
            </div>
          </div>
          ${Spotify.parse(Store.settings.spotifyUrl)
            ? `<iframe class="spotify-frame" src="${esc(Spotify.parse(Store.settings.spotifyUrl).embed)}" title="Lecteur Spotify" width="100%" height="${['track', 'episode'].includes(Spotify.parse(Store.settings.spotifyUrl).type) ? 152 : 232}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
            : `<button class="m2-btn primary" data-action="spotify-configure">${icon('music', 15)} Connecter un contenu</button>`}
        </div>
      </section>
    </div>
  </div>`;
}

/* ═══════════════ SPOTIFY ═══════════════ */
export function MaisonSpotify() {
  const source = Spotify.parse(Store.settings.spotifyUrl);
  return `<div class="maison-view">
    ${maisonHeader('MAISON / MUSIQUE', 'Spotify', 'Lecteur officiel intégré : une piste, un album ou une playlist, sans connexion de compte à PERSONAL OS.',
      `<button class="m2-btn" data-action="spotify-configure">${icon('settings', 15)} Configurer le contenu</button>${source ? `<a class="m2-btn primary" href="${esc(source.external)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify</a>` : ''}`)}
    <div class="m2-grid">
      <section class="m2-card m2-spotify">
        <header class="m2-card-head">
          <span class="m2-head-icon spotify-ico">${icon('music', 19)}</span>
          <h2>Lecteur</h2>
          ${source ? `<span class="m2-pill">${esc(source.type)}</span>` : ''}
        </header>
        ${source ? `
          <iframe class="spotify-frame" src="${esc(source.embed)}" title="Lecteur Spotify" width="100%" height="${['track', 'episode'].includes(source.type) ? 172 : 380}" loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
          <p class="maison-muted">Lecture, connexion et disponibilité sont gérées par Spotify. Internet requis.</p>`
        : `<div class="maison-empty">${icon('music', 34)}<p>Aucun contenu configuré. Collez un lien <strong>open.spotify.com</strong> ou une URI <strong>spotify:playlist:…</strong> pour intégrer le lecteur officiel.</p><button class="m2-btn primary" data-action="spotify-configure">Configurer un contenu</button></div>`}
      </section>

      <section class="m2-card">
        <header class="m2-card-head"><span class="m2-head-icon">${icon('list', 19)}</span><h2>Comment ça marche</h2></header>
        <ul class="capability-list">
          <li>${icon('check', 14)} <strong>Formats acceptés :</strong> piste, album, playlist, artiste, podcast, épisode.</li>
          <li>${icon('check', 14)} <strong>Aucune clé API</strong> : c’est le lecteur officiel Spotify qui est intégré.</li>
          <li>${icon('check', 14)} <strong>Aucun compte connecté</strong> à PERSONAL OS ; Spotify gère la lecture.</li>
          <li>${icon('info', 14)} Une connexion Internet est nécessaire pour charger le lecteur.</li>
        </ul>
        <div class="maison-stack" style="margin-top:14px">
          <button class="m2-btn" data-action="spotify-configure">${icon('edit', 15)} Modifier le lien</button>
          ${source ? `<button class="m2-btn danger" data-action="spotify-disconnect">${icon('trash', 15)} Retirer le contenu</button>` : ''}
        </div>
      </section>

      <section class="m2-card">
        <header class="m2-card-head"><span class="m2-head-icon">${icon('link', 19)}</span><h2>Où trouver le lien</h2></header>
        <p class="maison-muted">Dans Spotify : <strong>⋯ → Partager → Copier le lien</strong>, puis collez-le ici. L’URL se présente comme :</p>
        <div class="spotify-example">https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M</div>
        <p class="maison-muted">Vous pouvez aussi utiliser un lien de piste (<code>/track/…</code>), d’album (<code>/album/…</code>) ou d’artiste (<code>/artist/…</code>).</p>
      </section>
    </div>
  </div>`;
}

/* ── Enregistrement ───────────────────────────────────────────────── */
export const MaisonViews = {
  maison: () => (Store.settings.maisonLayout === 'classic' ? MaisonDashboardV2() : MaisonHub()), 'maison-meteo': MaisonMeteo, 'maison-actualites': MaisonActualites,
  'maison-calendrier': MaisonCalendrier, 'maison-courses': MaisonCourses, 'maison-cuisine': MaisonCuisine,
  'maison-quotidien': MaisonQuotidien, 'maison-entretien': MaisonEntretien, 'maison-budget': MaisonBudget,
  'maison-documents': MaisonDocuments, 'maison-sophie': MaisonSophie
};
export const MaisonLabels = {
  maison: 'MAISON', 'maison-meteo': 'MÉTÉO', 'maison-actualites': 'ACTUALITÉS', 'maison-calendrier': 'CALENDRIER',
  'maison-courses': 'COURSES', 'maison-cuisine': 'CUISINE', 'maison-quotidien': 'QUOTIDIEN',
  'maison-entretien': 'ENTRETIEN', 'maison-budget': 'BUDGET MAISON', 'maison-documents': 'DOCUMENTS', 'maison-sophie': 'SOPHIE MAISON'
};

function iconButton(action, id, name, label, extra = '') {
  return `<button class="maison-icon-btn" data-action="${action}" data-id="${esc(id || '')}" ${extra} aria-label="${esc(label)}">${icon(name, 15)}</button>`;
}

/* ── Actions CRUD du menu Maison ──────────────────────────────────── */
const rerender = () => { window.dispatchEvent(new CustomEvent('maison:refresh')); };

function editor({ title, subtitle, fields, values, onSubmit }) {
  return Modal.form({ title, subtitle, fields, values, size: 'wide', submitLabel: 'Enregistrer', onSubmit: form => { onSubmit(Modal.values(form, fields)); setTimeout(rerender, 150); } });
}

export const MaisonActions = {
  /* Disposition du tableau de bord + caméra de surveillance (fictive) */
  'maison-layout': button => { Store.setSetting('maisonLayout', button.dataset.layout === 'classic' ? 'classic' : 'mosaic'); rerender(); },
  'camera-toggle': async () => { const result = await Camera.toggle(); if (result?.ok) Toast.show(Camera.armed ? 'Alarme activée · caméra en marche.' : 'Alarme désactivée · caméra coupée.', 'info', 3200); },
  'camera-expand': () => Camera.toggleExpanded(),

  'maison-quick-add': () => Modal.open({ title: 'Ajouter dans Maison', eyebrow: 'MAISON', size: 'small', content: `<div class="maison-stack">
    <button class="maison-btn" data-action="maison-item-new">Article de courses</button>
    <button class="maison-btn" data-action="maison-task-new">Tâche domestique</button>
    <button class="maison-btn" data-action="maison-bill-new">Facture</button>
    <button class="maison-btn" data-action="maison-doc-new">Document</button>
  </div>` }),

  /* Météo */
  'maison-weather-refresh': async () => { try { await Weather.refresh(); Toast.show('Météo actualisée.'); rerender(); } catch (e) { Toast.show(e.message, 'error', 5500); } },
  'maison-weather-locate': async () => { try { await Weather.locate(); await Weather.refresh(); Toast.show('Position et météo enregistrées.'); rerender(); } catch (e) { Toast.show(e.message, 'error', 5500); } },
  'maison-weather-config': () => {
    const fields = [{ name: 'label', label: 'Nom du lieu', required: true }, { name: 'lat', label: 'Latitude', type: 'number', step: 'any', required: true }, { name: 'lon', label: 'Longitude', type: 'number', step: 'any', required: true }];
    editor({ title: 'Localisation météo', subtitle: 'Les coordonnées restent sur cet appareil.', fields, values: Store.settings.weather, onSubmit: values => {
      Object.assign(Store.settings.weather, values); Store.saveSettings();
      Weather.refresh().then(() => { Toast.show('Météo chargée.'); rerender(); }).catch(e => Toast.show(e.message, 'error', 5500));
    } });
  },

  /* Actualités */
  'maison-news-refresh': async () => { try { await News.refresh(); Toast.show('Actualités mises à jour.'); rerender(); } catch (e) { Toast.show(e.message, 'error', 6000); } },
  'maison-news-filter': button => { State.newsCategory = button.dataset.category; rerender(); },
  'maison-news-fav': button => {
    Store.commit(data => { const item = data.newsFavs.find(f => f === button.dataset.id); if (item) data.newsFavs = data.newsFavs.filter(f => f !== button.dataset.id); else data.newsFavs.push(button.dataset.id); });
    Toast.show('Favoris mis à jour.'); rerender();
  },
  'maison-news-config': () => Modal.open({ title: 'Sources d’actualités', eyebrow: 'MAISON', content: `<p class="maison-muted">Les flux sont configurés dans le module <strong>Point actualité</strong> de PERSONAL OS (Sophie → sources). Le menu Maison les réutilise sans duplication.</p><button class="maison-btn primary" data-action="news-configure">Ouvrir la gestion des sources</button>`, size: 'small' }),

  /* Courses */
  'maison-list-new': () => {
    const fields = [{ name: 'name', label: 'Nom de la liste', required: true, full: true, maxlength: 80 }];
    editor({ title: 'Nouvelle liste de courses', fields, values: { name: 'Courses de la semaine' }, onSubmit: values => {
      const list = { id: Utils.uid('list'), name: values.name, items: [], createdAt: new Date().toISOString() };
      Repo.create('shoppingLists', list); State.listId = list.id; Toast.show('Liste créée.');
    } });
  },
  'maison-list-select': button => { State.listId = button.dataset.id; rerender(); },
  'maison-list-rename': () => {
    const list = Repo.list('shoppingLists').find(l => l.id === State.listId); if (!list) return;
    const fields = [{ name: 'name', label: 'Nouveau nom', required: true, full: true }];
    editor({ title: 'Renommer la liste', fields, values: { name: list.name }, onSubmit: values => { Repo.update('shoppingLists', list.id, { name: values.name }); Toast.show('Liste renommée.'); } });
  },
  'maison-list-delete': async () => {
    const list = Repo.list('shoppingLists').find(l => l.id === State.listId); if (!list) return;
    if (await Modal.confirm({ title: 'Supprimer la liste', message: `Supprimer « ${list.name} » et tous ses articles ?` })) {
      Repo.remove('shoppingLists', list.id); State.listId = ''; Toast.show('Liste supprimée.', 'info');
    }
    rerender();
  },
  'maison-item-new': () => {
    const fields = [
      { name: 'name', label: 'Article', required: true, full: true, maxlength: 90 },
      { name: 'qty', label: 'Quantité', maxlength: 30 }, { name: 'price', label: 'Prix estimé (€)', type: 'number', min: 0, step: '0.01' },
      { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_COURSES }
    ];
    editor({ title: 'Ajouter un article', fields, values: { category: 'Épicerie' }, onSubmit: values => {
      const list = Repo.list('shoppingLists').find(l => l.id === State.listId) || Repo.list('shoppingLists')[0];
      if (!list) { Toast.show('Créez d’abord une liste.', 'error'); return; }
      const items = [...(list.items || []), { id: Utils.uid('item'), bought: false, ...values }];
      Repo.update('shoppingLists', list.id, { items }); State.listId = list.id; Toast.show('Article ajouté.');
    } });
  },
  'maison-item-edit': button => {
    const list = Repo.list('shoppingLists').find(l => l.id === button.dataset.list); const item = list?.items.find(i => i.id === button.dataset.id); if (!item) return;
    const fields = [{ name: 'name', label: 'Article', required: true, full: true }, { name: 'qty', label: 'Quantité' }, { name: 'price', label: 'Prix estimé (€)', type: 'number', min: 0, step: '0.01' }, { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_COURSES }];
    editor({ title: 'Modifier l’article', fields, values: item, onSubmit: values => {
      Repo.update('shoppingLists', list.id, { items: list.items.map(i => i.id === item.id ? { ...i, ...values } : i) }); Toast.show('Article modifié.');
    } });
  },
  'maison-item-toggle': button => {
    const list = Repo.list('shoppingLists').find(l => l.id === button.dataset.list) || Repo.list('shoppingLists')[0]; if (!list) return;
    Repo.update('shoppingLists', list.id, { items: (list.items || []).map(i => i.id === button.dataset.id ? { ...i, bought: !i.bought } : i) }); rerender();
  },
  'maison-item-delete': button => {
    const list = Repo.list('shoppingLists').find(l => l.id === button.dataset.list); if (!list) return;
    Repo.update('shoppingLists', list.id, { items: list.items.filter(i => i.id !== button.dataset.id) }); Toast.show('Article supprimé.', 'info'); rerender();
  },

  /* Cuisine */
  'maison-recipe-new': () => {
    const fields = [
      { name: 'name', label: 'Nom de la recette', required: true, full: true },
      { name: 'prepTime', label: 'Temps (min)', type: 'number', min: 0 }, { name: 'difficulty', label: 'Difficulté', type: 'select', options: ['Facile', 'Moyen', 'Difficile'] },
      { name: 'ingredientsText', label: 'Ingrédients (un par ligne : nom — quantité — unité — catégorie)', type: 'textarea', full: true, rows: 5 },
      { name: 'steps', label: 'Étapes de préparation', type: 'textarea', full: true, rows: 6 }
    ];
    editor({ title: 'Nouvelle recette', fields, values: { difficulty: 'Facile' }, onSubmit: values => {
      const ingredients = (values.ingredientsText || '').split('\n').map(line => { const [name, qty, unit, category] = line.split('—').map(s => (s || '').trim()); return name ? { name, qty: qty || '', unit: unit || '', category: category || 'Autres' } : null; }).filter(Boolean);
      Repo.create('recipes', { name: values.name, prepTime: values.prepTime, difficulty: values.difficulty, ingredients, steps: values.steps }); Toast.show('Recette créée.');
    } });
  },
  'maison-recipe-edit': button => {
    const recipe = Repo.get('recipes', button.dataset.id); if (!recipe) return;
    const fields = [{ name: 'name', label: 'Nom', required: true, full: true }, { name: 'prepTime', label: 'Temps (min)', type: 'number', min: 0 }, { name: 'difficulty', label: 'Difficulté', type: 'select', options: ['Facile', 'Moyen', 'Difficile'] }, { name: 'ingredientsText', label: 'Ingrédients (un par ligne)', type: 'textarea', full: true, rows: 5 }, { name: 'steps', label: 'Étapes', type: 'textarea', full: true, rows: 6 }];
    editor({ title: 'Modifier la recette', fields, values: { ...recipe, ingredientsText: (recipe.ingredients || []).map(i => `${i.name} — ${i.qty} — ${i.unit} — ${i.category}`).join('\n') }, onSubmit: values => {
      const ingredients = (values.ingredientsText || '').split('\n').map(line => { const [name, qty, unit, category] = line.split('—').map(s => (s || '').trim()); return name ? { name, qty: qty || '', unit: unit || '', category: category || 'Autres' } : null; }).filter(Boolean);
      Repo.update('recipes', recipe.id, { ...values, ingredients }); Toast.show('Recette mise à jour.');
    } });
  },
  'maison-recipe-delete': async button => {
    if (await Modal.confirm({ title: 'Supprimer la recette', message: 'Cette recette sera définitivement supprimée.' })) { Repo.remove('recipes', button.dataset.id); Toast.show('Recette supprimée.', 'info'); rerender(); }
  },
  'maison-recipe-to-list': button => {
    const recipe = Repo.get('recipes', button.dataset.id); if (!recipe) return;
    let list = Repo.list('shoppingLists').find(l => l.id === State.listId) || Repo.list('shoppingLists')[0];
    if (!list) { list = { id: Utils.uid('list'), name: `Courses · ${recipe.name}`, items: [], createdAt: new Date().toISOString() }; Repo.create('shoppingLists', list); }
    const items = [...(list.items || []), ...(recipe.ingredients || []).map(i => ({ id: Utils.uid('item'), name: i.name, qty: `${i.qty || ''} ${i.unit || ''}`.trim(), price: 0, category: i.category || 'Autres', bought: false }))];
    Repo.update('shoppingLists', list.id, { items }); State.listId = list.id;
    Toast.show(`${recipe.ingredients?.length || 0} ingrédient(s) ajouté(s) à la liste.`); rerender();
  },
  'maison-meal-new': button => {
    const fields = [{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'slot', label: 'Repas', type: 'select', options: ['Petit-déjeuner', 'Déjeuner', 'Dîner'] }, { name: 'title', label: 'Intitulé', required: true, full: true }];
    editor({ title: 'Planifier un repas', fields, values: { date: button.dataset.date || today(), slot: button.dataset.slot || 'Dîner' }, onSubmit: values => {
      const existing = Repo.list('mealPlans').find(m => m.date === values.date && m.slot === values.slot);
      if (existing) Repo.update('mealPlans', existing.id, values); else Repo.create('mealPlans', values);
      Toast.show('Repas planifié.');
    } });
  },
  'maison-meal-edit': button => {
    if (button.dataset.id) {
      const meal = Repo.get('mealPlans', button.dataset.id);
      if (meal && window.confirm(`Supprimer « ${meal.title} » de ce créneau ?`)) { Repo.remove('mealPlans', meal.id); Toast.show('Repas retiré.', 'info'); rerender(); }
    } else MaisonActions['maison-meal-new'](button);
  },

  /* Quotidien */
  'maison-task-filter': button => { State.taskFilter = button.dataset.filter; rerender(); },
  'maison-task-new': () => {
    const fields = [
      { name: 'title', label: 'Tâche', required: true, full: true, maxlength: 120 },
      { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 3 },
      { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_TACHES },
      { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities },
      { name: 'due', label: 'Date limite', type: 'date' },
      { name: 'repeat', label: 'Répétition', type: 'select', options: ['Aucune', 'Quotidienne', 'Hebdomadaire', 'Mensuelle'] }
    ];
    editor({ title: 'Nouvelle tâche domestique', fields, values: { category: 'Ménage', priority: 'Normale', repeat: 'Aucune' }, onSubmit: values => {
      Repo.create('homeTasks', { ...values, status: 'todo', history: [{ date: new Date().toISOString(), detail: 'Tâche créée' }] }); Toast.show('Tâche ajoutée.');
    } });
  },
  'maison-task-edit': button => {
    const task = Repo.get('homeTasks', button.dataset.id); if (!task) return;
    const fields = [{ name: 'title', label: 'Tâche', required: true, full: true }, { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 3 }, { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_TACHES }, { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities }, { name: 'due', label: 'Date limite', type: 'date' }, { name: 'repeat', label: 'Répétition', type: 'select', options: ['Aucune', 'Quotidienne', 'Hebdomadaire', 'Mensuelle'] }];
    editor({ title: 'Modifier la tâche', fields, values: task, onSubmit: values => {
      Repo.update('homeTasks', task.id, { ...values, history: [...(task.history || []), { date: new Date().toISOString(), detail: 'Tâche modifiée' }] }); Toast.show('Tâche mise à jour.');
    } });
  },
  'maison-task-toggle': button => {
    const task = Repo.get('homeTasks', button.dataset.id); if (!task) return;
    Repo.update('homeTasks', task.id, { status: task.status === 'done' ? 'todo' : 'done', history: [...(task.history || []), { date: new Date().toISOString(), detail: task.status === 'done' ? 'Rouverte' : 'Terminée' }] }); rerender();
  },
  'maison-task-delete': async button => {
    if (await Modal.confirm({ title: 'Supprimer la tâche', message: 'Cette tâche et son historique seront supprimés.' })) { Repo.remove('homeTasks', button.dataset.id); Toast.show('Tâche supprimée.', 'info'); rerender(); }
  },

  /* Entretien */
  'maison-asset-new': () => {
    const fields = [{ name: 'name', label: 'Équipement', required: true, full: true }, { name: 'category', label: 'Type', type: 'select', options: ['Électroménager', 'Mobilier', 'Chaudière / chauffage', 'Plomberie', 'Électricité', 'Jardin', 'Divers'] }, { name: 'brand', label: 'Marque' }, { name: 'model', label: 'Modèle' }, { name: 'purchaseDate', label: 'Date d’achat', type: 'date' }, { name: 'warranty', label: 'Fin de garantie', type: 'date' }, { name: 'notes', label: 'Notes / référence produit', type: 'textarea', full: true, rows: 3 }];
    editor({ title: 'Ajouter un équipement', fields, values: { category: 'Électroménager' }, onSubmit: values => { Repo.create('homeAssets', { ...values, maintenance: [] }); Toast.show('Équipement enregistré.'); } });
  },
  'maison-asset-edit': button => {
    const asset = Repo.get('homeAssets', button.dataset.id); if (!asset) return;
    const fields = [{ name: 'name', label: 'Équipement', required: true, full: true }, { name: 'category', label: 'Type', type: 'select', options: ['Électroménager', 'Mobilier', 'Chaudière / chauffage', 'Plomberie', 'Électricité', 'Jardin', 'Divers'] }, { name: 'brand', label: 'Marque' }, { name: 'model', label: 'Modèle' }, { name: 'purchaseDate', label: 'Date d’achat', type: 'date' }, { name: 'warranty', label: 'Fin de garantie', type: 'date' }, { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 3 }];
    editor({ title: 'Modifier l’équipement', fields, values: asset, onSubmit: values => { Repo.update('homeAssets', asset.id, values); Toast.show('Équipement mis à jour.'); } });
  },
  'maison-asset-delete': async button => {
    if (await Modal.confirm({ title: 'Supprimer l’équipement', message: 'Son historique d’entretien sera également supprimé.' })) { Repo.remove('homeAssets', button.dataset.id); Toast.show('Équipement supprimé.', 'info'); rerender(); }
  },
  'maison-maint-new': button => {
    const asset = Repo.get('homeAssets', button.dataset.id); if (!asset) return;
    const fields = [{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'detail', label: 'Entretien / réparation', required: true, full: true, maxlength: 200 }];
    editor({ title: `Entretien · ${asset.name}`, fields, values: { date: today() }, onSubmit: values => {
      Repo.update('homeAssets', asset.id, { maintenance: [...(asset.maintenance || []), values] }); Toast.show('Entretien ajouté à l’historique.');
    } });
  },

  /* Budget maison */
  'maison-bill-filter': button => { State.billMonth = button.dataset.filter === 'Toutes' ? Utils.monthKey() : State.billMonth; rerender(); },
  'maison-bill-new': () => {
    const fields = [{ name: 'label', label: 'Libellé', required: true, full: true }, { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_FACTURES }, { name: 'amount', label: 'Montant (€)', type: 'number', min: 0, step: '0.01', required: true }, { name: 'dueDate', label: 'Échéance', type: 'date', required: true }, { name: 'paid', label: 'État', type: 'checkbox', checkboxLabel: 'Déjà payée' }, { name: 'notes', label: 'Justificatif / note', type: 'textarea', full: true, rows: 2 }];
    editor({ title: 'Nouvelle facture maison', fields, values: { category: 'Loyer', dueDate: today() }, onSubmit: values => { Repo.create('homeBills', values); Toast.show('Facture enregistrée.'); } });
  },
  'maison-bill-edit': button => {
    const bill = Repo.get('homeBills', button.dataset.id); if (!bill) return;
    const fields = [{ name: 'label', label: 'Libellé', required: true, full: true }, { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_FACTURES }, { name: 'amount', label: 'Montant (€)', type: 'number', min: 0, step: '0.01', required: true }, { name: 'dueDate', label: 'Échéance', type: 'date', required: true }, { name: 'paid', label: 'État', type: 'checkbox', checkboxLabel: 'Déjà payée' }, { name: 'notes', label: 'Justificatif / note', type: 'textarea', full: true, rows: 2 }];
    editor({ title: 'Modifier la facture', fields, values: bill, onSubmit: values => { Repo.update('homeBills', bill.id, values); Toast.show('Facture mise à jour.'); } });
  },
  'maison-bill-toggle': button => {
    const bill = Repo.get('homeBills', button.dataset.id); if (!bill) return;
    Repo.update('homeBills', bill.id, { paid: !bill.paid }); rerender();
  },
  'maison-bill-delete': async button => {
    if (await Modal.confirm({ title: 'Supprimer la facture', message: 'Cette facture sera définitivement supprimée.' })) { Repo.remove('homeBills', button.dataset.id); Toast.show('Facture supprimée.', 'info'); rerender(); }
  },

  /* Documents */
  'maison-doc-new': () => {
    const fields = [
      { name: 'name', label: 'Nom du document', required: true, full: true },
      { name: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES_DOCS },
      { name: 'kind', label: 'Type', type: 'select', options: ['PDF', 'Image', 'Lien', 'Note'] },
      { name: 'url', label: 'Lien (si document externe)', full: true, placeholder: 'https://…' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 3 }
    ];
    editor({ title: 'Ajouter un document', fields, values: { category: 'Bail et logement', kind: 'PDF' }, onSubmit: values => {
      Repo.create('homeDocs', { ...values, data: values.url || '', date: today() }); Toast.show('Document enregistré.');
    } });
  },
  'maison-doc-delete': async button => {
    if (await Modal.confirm({ title: 'Supprimer le document', message: 'Cette référence sera supprimée de la bibliothèque.' })) { Repo.remove('homeDocs', button.dataset.id); Toast.show('Document supprimé.', 'info'); rerender(); }
  },

  /* Sophie maison */
  'maison-sophie-say': button => {
    const command = button.dataset.command || '';
    let answer = '';
    const normalized = command.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
    const cameraAnswer = Camera.interpret(normalized);
    if (cameraAnswer) { cameraAnswer.then(text => Toast.show(text, 'info', 4200)); return; }
    if (/temps|meteo/i.test(command)) {
      const c = Store.settings.weather.data;
      answer = c ? `Il fait ${Math.round(c.temperature_2m)} degrés, ${weatherLabel(c.weather_code).toLowerCase()}. Ressenti ${c.apparent_temperature ?? '—'} degrés.` : 'Aucune météo n’est configurée pour le moment.';
    } else if (/actualit/i.test(command)) {
      const items = News.config().items.slice(0, 3);
      answer = items.length ? items.map(i => `${i.source} : ${i.title}.`).join(' ') : 'Aucun titre n’est disponible. Actualisez les flux RSS.';
    } else if (/aujourd.hui|faire/i.test(command)) {
      const tasks = Repo.list('homeTasks').filter(t => t.status !== 'done' && (!t.due || t.due <= today()));
      const events = Selectors.todayEvents();
      answer = tasks.length || events.length ? `Vous avez ${events.length} événement(s) et ${tasks.length} tâche(s) à traiter aujourd’hui.${tasks[0] ? ` Première tâche : ${tasks[0].title}.` : ''}` : 'Aucune tâche ni rendez-vous pour aujourd’hui.';
    } else if (/facture/i.test(command)) {
      const due = Repo.list('homeBills').filter(b => !b.paid).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      answer = due.length ? `${due.length} facture(s) à payer. Prochaine : ${due[0].label} de ${money(due[0].amount)} à échéance ${Utils.formatDate(due[0].dueDate)}.` : 'Toutes les factures maison sont à jour.';
    } else if (/pain|course|liste/i.test(command)) {
      const list = Repo.list('shoppingLists')[0];
      if (list) { const items = [...(list.items || []), { id: Utils.uid('item'), name: /pain/i.test(command) ? 'Pain' : command.replace(/ajoute|à ma liste de courses/gi, '').trim(), qty: '', price: 0, category: 'Épicerie', bought: false }]; Repo.update('shoppingLists', list.id, { items }); answer = `Article ajouté à la liste « ${list.name} ».`; }
      else answer = 'Aucune liste de courses n’existe encore.';
    } else if (/repas|repas pour ce soir|cuisine/i.test(command)) {
      const recipes = Repo.list('recipes');
      answer = recipes.length ? `Je vous propose : ${recipes[Math.floor(Math.random() * recipes.length)].name}. Retrouvez toutes vos recettes dans le menu Cuisine.` : 'Ajoutez d’abord quelques recettes dans le menu Cuisine.';
    } else answer = 'Je n’ai pas reconnu cette demande Maison. Essayez : météo, actualités, programme du jour, courses ou factures.';
    const box = document.getElementById('sophie-answer');
    if (box) { box.innerHTML = `<span class="maison-eyebrow">SOPHIE RÉPOND</span>« ${esc(answer)} »`; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else Modal.open({ title: 'Sophie répond', eyebrow: 'MAISON / SOPHIE', size: 'small', content: `<p class="sophie-report">« ${esc(answer)} »</p>` });
    if ('speechSynthesis' in globalThis && Store.settings.voiceEnabled) { try { const u = new SpeechSynthesisUtterance(answer); u.lang = 'fr-FR'; speechSynthesis.speak(u); } catch { /* voix indisponible */ } }
  }
};
