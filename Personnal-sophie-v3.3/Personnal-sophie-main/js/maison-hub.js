/* ═══════════════════════════════════════════════════════════════════════
   PERSONAL OS — MAISON · disposition « MOSAÏQUE »
   Tableau de bord en tuiles, pensé pour la tablette (paysage et portrait) et le PC.
   La grille s'adapte à la largeur RÉELLE de la zone de contenu (container queries) :
   menu déplié ou replié, tablette ou écran large, la mosaïque se réorganise seule.

     ≥ 900 px : 6 colonnes · 600–899 px : 4 colonnes · < 600 px : 2 colonnes

   Aucune donnée inventée : tout provient des collections locales, de la météo
   Open-Meteo et des flux RSS déjà configurés.
   ═══════════════════════════════════════════════════════════════════════ */
import { Store, Repo, Selectors, Utils, Weather, Spotify } from './core.js';
import { News } from './news.js';
import { icon } from './ui.js';
import { SophieAvatar } from './sophie-avatar.js';

const esc = Utils.esc;
const money = value => Utils.money(value);
const today = () => Utils.iso();

const weatherIcon = code => [0, 1].includes(code) ? 'sun' : [2, 3, 45, 48].includes(code) ? 'cloud' : 'droplet';
const weatherLabel = code => Weather.codes?.[code] || `Conditions ${code}`;
const windLabel = deg => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((Number(deg) || 0) / 45) % 8];

function head(iconName, title, link = '') {
  return `<header class="tile-head"><span class="tile-ico">${icon(iconName, 17)}</span><h2>${esc(title)}</h2>${link}</header>`;
}
const linkTo = (section, label) => `<button class="tile-link" data-section="${section}">${esc(label)} ${icon('arrow', 12)}</button>`;

/* Six derniers mois de factures (données réelles : somme des échéances par mois). */
function billsByMonth(bills) {
  const base = new Date(); base.setDate(1); base.setHours(12, 0, 0, 0);
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(base); month.setMonth(base.getMonth() - (5 - index));
    const key = Utils.monthKey(month);
    return {
      key, current: index === 5,
      label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(month).replace('.', ''),
      total: bills.filter(b => (b.dueDate || '').startsWith(key)).reduce((sum, b) => sum + Number(b.amount || 0), 0)
    };
  });
}

/* ───────── Tuiles ───────── */
function tileClock(ctx) {
  const { now, dayProgress, events, tasksToday, dueBills, list } = ctx;
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(now);
  return `<section class="tile t-clock" style="--tile:55,214,160">
    <span class="tile-kicker">${esc(weekday)}</span>
    <strong class="clock-big" id="maison-clock">${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now)}</strong>
    <span class="clock-date">${esc(Utils.formatLongDate(now))}</span>
    <div class="day-bar" role="img" aria-label="Journée écoulée à ${dayProgress} %"><i style="width:${dayProgress}%"></i></div>
    <ul class="chips">
      <li>${icon('calendar', 13)}<b>${events.length}</b> événement${events.length > 1 ? 's' : ''}</li>
      <li>${icon('check', 13)}<b>${tasksToday.length}</b> tâche${tasksToday.length > 1 ? 's' : ''}</li>
      <li>${icon('wallet', 13)}<b>${dueBills.length}</b> facture${dueBills.length > 1 ? 's' : ''}</li>
      <li>${icon('list', 13)}<b>${list ? list.items.filter(i => !i.bought).length : 0}</b> course${list && list.items.filter(i => !i.bought).length > 1 ? 's' : ''}</li>
    </ul>
  </section>`;
}

function tileWeather() {
  const weather = Store.settings.weather; const c = weather.data; const d = weather.daily;
  if (!c) {
    return `<section class="tile t-meteo" style="--tile:64,160,255">${head('cloud', 'Météo')}
      <div class="tile-empty">${icon('cloud', 34)}<p>Aucune position configurée. La météo réelle demande une localisation et une connexion.</p>
      <button class="hub-btn primary" data-action="maison-weather-locate">Utiliser ma position</button>
      <button class="hub-btn" data-action="maison-weather-config">Saisir un lieu</button></div></section>`;
  }
  const days = d?.time ? d.time.slice(0, 7).map((date, i) => `<li><span>${i === 0 ? 'Auj.' : esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', ''))}</span>${icon(weatherIcon(d.weather_code[i]), 20)}<b>${Math.round(d.temperature_2m_max[i])}°</b><small>${Math.round(d.temperature_2m_min[i])}°</small></li>`).join('') : '';
  return `<section class="tile t-meteo" style="--tile:64,160,255">
    ${head('cloud', 'Météo', `<button class="tile-link" data-action="maison-weather-config">${esc(weather.label || 'Position configurée')} ${icon('arrow', 12)}</button>`)}
    <div class="meteo-main">
      <span class="meteo-art">${icon(weatherIcon(c.weather_code), 64)}</span>
      <div class="meteo-now"><strong>${Math.round(c.temperature_2m)}°</strong><span>${esc(weatherLabel(c.weather_code))}</span><small>Ressenti ${c.apparent_temperature ?? '—'}°${d ? ` · ↑ ${Math.round(d.temperature_2m_max[0])}° ↓ ${Math.round(d.temperature_2m_min[0])}°` : ''}</small></div>
    </div>
    <dl class="meteo-facts">
      <div><dt>Vent</dt><dd>${Math.round(c.wind_speed_10m || 0)} km/h${c.wind_direction_10m ? ` ${windLabel(c.wind_direction_10m)}` : ''}</dd></div>
      <div><dt>Humidité</dt><dd>${c.relative_humidity_2m ?? '—'} %</dd></div>
      <div><dt>Pluie</dt><dd>${d?.precipitation_probability_max?.[0] ?? 0} %</dd></div>
      <div><dt>UV</dt><dd>${d?.uv_index_max?.[0] ?? '—'}</dd></div>
      <div><dt>Soleil</dt><dd>${d?.sunrise?.[0] ? Utils.formatTime(d.sunrise[0]) : '—'} → ${d?.sunset?.[0] ? Utils.formatTime(d.sunset[0]) : '—'}</dd></div>
    </dl>
    ${days ? `<ul class="meteo-days">${days}</ul>` : ''}
    <button class="tile-refresh" data-action="maison-weather-refresh" aria-label="Actualiser la météo">${icon('refresh', 15)}</button>
  </section>`;
}

function tileCamera() {
  return `<section class="tile t-cam" style="--tile:255,82,92">
    ${head('camera', 'Caméra', `<span class="status-pill" data-cam-status aria-live="polite">Alarme désactivée</span>`)}
    <div class="cam-slot" data-camera-slot></div>
    <div class="cam-controls">
      <button class="hub-btn alarm-btn" data-action="camera-toggle" data-cam-toggle aria-pressed="false">${icon('shield', 16)}<span data-cam-toggle-label>Activer l’alarme</span></button>
      <button class="hub-btn" data-action="camera-expand">${icon('expand', 15)}<span data-cam-expand-label>Agrandir</span></button>
    </div>
    <ul class="cam-log" data-cam-log aria-label="Journal des mouvements"></ul>
    <p class="tile-note">Dites <em>« Sophie, active l’alarme »</em> ou <em>« Sophie, désactive l’alarme »</em>.<br>Aperçu en direct de la caméra avant · aucune image enregistrée ni envoyée.</p>
  </section>`;
}

function tileSophie() {
  const chips = [
    ['Quel temps fait-il ?', 'Quel temps fait-il ?'], ['Active l’alarme', 'Active l’alarme'],
    ['Désactive l’alarme', 'Désactive l’alarme'], ['Que dois-je faire ?', 'Que dois-je faire aujourd’hui ?'],
    ['Les actualités', 'Donne-moi les actualités du matin'], ['Les factures', 'Quelles sont les prochaines factures à payer ?']
  ];
  return `<section class="tile t-sophie" style="--tile:150,120,255">
    ${head('mic', 'Sophie', `<span class="status-pill ok">Disponible</span>`)}
    <div class="sophie-row">
      <div class="sophie-face">${SophieAvatar({ size: 120, state: 'idle' })}</div>
      <div class="sophie-copy"><p>Je lis la météo, les actualités et ton programme, je gère les courses… et j’arme l’alarme.</p>
        <button class="mic-btn" data-action="voice-toggle" aria-label="Parler à Sophie">${icon('mic', 22)}<span>Parler</span></button></div>
    </div>
    <div class="cmd-chips">${chips.map(([label, command]) => `<button data-action="maison-sophie-say" data-command="${esc(command)}">${esc(label)}</button>`).join('')}</div>
  </section>`;
}

function tileAgenda(ctx) {
  const { events, tasksToday } = ctx;
  const rows = [
    ...events.map(e => ({ time: e.start, title: e.title, sub: e.description || e.category || 'Événement' })),
    ...tasksToday.map(t => ({ time: '', title: t.title, sub: t.category || 'Tâche' }))
  ].slice(0, 6);
  return `<section class="tile t-agenda" style="--tile:255,176,64">
    ${head('calendar', 'Programme du jour', linkTo('maison-calendrier', 'Agenda'))}
    <ul class="agenda-list">${rows.length ? rows.map(r => `<li><time>${esc(r.time || '•')}</time><div><strong>${esc(r.title)}</strong><small>${esc(String(r.sub).slice(0, 48))}</small></div></li>`).join('') : '<li class="empty">Rien de prévu aujourd’hui.</li>'}</ul>
  </section>`;
}

function tileNews() {
  const items = News.config().items.slice(0, 4);
  const [first, ...rest] = items;
  const thumb = item => `<span class="news-thumb">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc((item.source || '?').slice(0, 1))}</b></span>`;
  return `<section class="tile t-news" style="--tile:64,200,210">
    ${head('note', 'Actualités du jour', linkTo('maison-actualites', 'Toutes'))}
    ${first ? `<a class="news-first" href="${esc(first.link || '#')}" target="_blank" rel="noopener noreferrer">${thumb(first)}<div><strong>${esc(first.title)}</strong><small>${esc(first.source)} · ${Utils.relative(first.pubDate)}</small></div></a>
      <ul class="news-rows">${rest.map(item => `<li><a href="${esc(item.link || '#')}" target="_blank" rel="noopener noreferrer"><strong>${esc(item.title)}</strong><small>${esc(item.source)} · ${Utils.relative(item.pubDate)}</small></a></li>`).join('')}</ul>`
      : `<div class="tile-empty">${icon('note', 30)}<p>Aucun titre en mémoire.</p><button class="hub-btn" data-action="maison-news-refresh">Actualiser les flux</button></div>`}
  </section>`;
}

function tileCourses(ctx) {
  const { list } = ctx;
  const items = list ? [...list.items].sort((a, b) => Number(a.bought) - Number(b.bought)).slice(0, 6) : [];
  const left = list ? list.items.filter(i => !i.bought).length : 0;
  return `<section class="tile t-courses" style="--tile:120,214,110">
    ${head('list', 'Courses', `<button class="tile-link" data-action="maison-item-new">${icon('plus', 12)} Article</button>`)}
    ${list ? `<div class="big-figure"><strong>${left}</strong><span>à acheter</span></div>
      <ul class="check-list">${items.map(item => `<li><button data-action="maison-item-toggle" data-list="${esc(list.id)}" data-id="${esc(item.id)}" aria-pressed="${item.bought ? 'true' : 'false'}"><i></i><span>${esc(item.name)}${item.qty ? ` · ${esc(item.qty)}` : ''}</span></button></li>`).join('') || '<li class="empty">Liste vide.</li>'}</ul>`
      : '<div class="tile-empty"><p>Aucune liste de courses.</p><button class="hub-btn" data-section="maison-courses">Créer une liste</button></div>'}
  </section>`;
}

function tileMeals() {
  const meals = Repo.list('mealPlans').filter(m => m.date === today());
  return `<section class="tile t-repas" style="--tile:255,128,100">
    ${head('book', 'Repas du jour', linkTo('maison-cuisine', 'Cuisine'))}
    <ul class="meal-list">${meals.length ? meals.map(m => `<li><span>${esc(m.slot)}</span><strong>${esc(m.title)}</strong></li>`).join('') : '<li class="empty">Aucun repas planifié aujourd’hui.</li>'}</ul>
    <p class="tile-foot"><b>${Repo.list('recipes').length}</b> recette(s) · <b>${Repo.list('mealPlans').filter(m => m.date > today() && m.date <= Utils.day(7)).length}</b> repas à venir</p>
  </section>`;
}

function tileBudget(ctx) {
  const { bills, dueBills } = ctx;
  const months = billsByMonth(bills); const max = Math.max(...months.map(m => m.total), 0);
  const spent = months[5].total;
  const next = dueBills[0];
  return `<section class="tile t-budget" style="--tile:255,214,80">
    ${head('wallet', 'Budget maison', linkTo('maison-budget', 'Détail'))}
    <div class="budget-row">
      <div class="big-figure"><strong>${money(spent)}</strong><span>factures de ${esc(new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()))}</span></div>
      ${max > 0 ? `<div class="bars" role="img" aria-label="Factures des six derniers mois">${months.map(m => `<div class="${m.current ? 'cur' : ''}"><i style="height:${Math.max(6, Math.round(m.total / max * 100))}%"></i><small>${esc(m.label)}</small></div>`).join('')}</div>` : ''}
    </div>
    <p class="tile-foot">${dueBills.length ? `<b>${dueBills.length}</b> à payer${next ? ` · prochaine le ${esc(Utils.formatDate(next.dueDate))} (${money(next.amount)})` : ''}` : 'Toutes les factures sont à jour.'}</p>
  </section>`;
}

function tileOrga(ctx) {
  const { list, tasksToday, assets, dueBills } = ctx;
  const nextAsset = assets.filter(a => a.warranty).sort((a, b) => (a.warranty || '9999').localeCompare(b.warranty || '9999'))[0];
  const shortcuts = [
    ['maison-courses', 'list', 'Courses', `${list ? list.items.filter(i => !i.bought).length : 0} article(s)`, '120,214,110'],
    ['maison-quotidien', 'check', 'Tâches', `${tasksToday.length} à faire`, '255,176,64'],
    ['maison-entretien', 'wrench', 'Entretien', nextAsset?.warranty ? `Garantie ${Utils.formatDate(nextAsset.warranty)}` : `${assets.length} équipement(s)`, '64,160,255'],
    ['maison-budget', 'note', 'Factures', `${dueBills.length} à payer`, '255,214,80']
  ];
  return `<section class="tile t-orga" style="--tile:64,160,255">
    <div class="orga-grid">${shortcuts.map(([section, ic, title, sub, rgb]) => `<button data-section="${section}" style="--tile:${rgb}"><span class="orga-ico">${icon(ic, 22)}</span><strong>${esc(title)}</strong><small>${esc(sub)}</small></button>`).join('')}</div>
  </section>`;
}

function tileSpotify() {
  const spotify = Spotify.parse(Store.settings.spotifyUrl);
  return `<section class="tile t-spotify" style="--tile:30,215,96">
    ${head('music', 'Spotify', spotify ? `<a class="tile-link" href="${esc(spotify.external)}" target="_blank" rel="noopener noreferrer">Ouvrir ${icon('arrow', 12)}</a>` : `<button class="tile-link" data-action="spotify-configure">Configurer ${icon('arrow', 12)}</button>`)}
    ${spotify
      ? `<iframe class="spotify-frame" src="${esc(spotify.embed)}" title="Lecteur Spotify" width="100%" height="${['track', 'episode'].includes(spotify.type) ? 152 : 232}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`
      : `<div class="tile-empty">${icon('music', 30)}<p>Ajoutez le lien d’une playlist ou d’un album pour l’écouter ici.</p><button class="hub-btn primary" data-action="spotify-configure">Connecter un contenu</button></div>`}
  </section>`;
}

/* ───────── Vue ───────── */
export function MaisonHub() {
  const now = new Date();
  const bills = Repo.list('homeBills');
  const ctx = {
    now,
    dayProgress: Math.round((now.getHours() * 60 + now.getMinutes()) / 1440 * 100),
    events: Selectors.todayEvents(),
    tasksToday: Repo.list('homeTasks').filter(t => t.status !== 'done' && (!t.due || t.due <= today())),
    list: Repo.list('shoppingLists')[0],
    bills,
    dueBills: bills.filter(b => !b.paid).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    assets: Repo.list('homeAssets')
  };
  return `<div class="maison-view hub-view">
    <div class="hub">
      <header class="hub-head">
        <div><span class="hub-eyebrow">MAISON / TABLEAU DE BORD</span><h1>Bonjour chez vous</h1></div>
        <div class="hub-head-actions">
          <div class="hub-switch" role="group" aria-label="Disposition du tableau de bord">
            <button class="on" data-action="maison-layout" data-layout="mosaic" aria-pressed="true">Mosaïque</button>
            <button data-action="maison-layout" data-layout="classic" aria-pressed="false">Classique</button>
          </div>
          <button class="hub-btn primary" data-action="maison-quick-add">${icon('plus', 16)} Ajouter</button>
        </div>
      </header>
      <div class="hub-grid">
        ${tileClock(ctx)}
        ${tileWeather()}
        ${tileCamera()}
        ${tileSophie()}
        ${tileAgenda(ctx)}
        ${tileNews()}
        ${tileCourses(ctx)}
        ${tileMeals()}
        ${tileBudget(ctx)}
        ${tileOrga(ctx)}
        ${tileSpotify()}
      </div>
    </div>
  </div>`;
}
