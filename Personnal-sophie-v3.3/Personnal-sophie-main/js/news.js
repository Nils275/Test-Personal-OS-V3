/* PERSONAL OS — Actualités RSS réelles et briefing vocal extractif.
   Aucun résumé génératif : titre + première description publiée par la source. */
import { Store, Bus, Utils } from './core.js';

const cleanText = (html = '', max = 500) => {
  const node = document.createElement('div'); node.innerHTML = String(html || '');
  return (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max);
};
const validUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
const defaults = () => ({
  feeds: [
    { id: 'franceinfo', name: 'Franceinfo', url: 'https://www.franceinfo.fr/titres.rss', enabled: true },
    { id: 'lemonde', name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml', enabled: true }
  ],
  items: [], updatedAt: '', lastError: '', briefingEnabled: true, briefingTime: '07:00', lastBriefingDate: ''
});

export const News = {
  speak: null, timer: null, refreshing: null,
  config() {
    const base = defaults(); const saved = Store.settings.news || {};
    Store.settings.news = { ...base, ...saved };
    Store.settings.news.feeds = Array.isArray(saved.feeds) ? saved.feeds : base.feeds;
    Store.settings.news.items = Array.isArray(saved.items) ? saved.items.slice(0, 30) : [];
    return Store.settings.news;
  },
  init({ speak }) {
    this.speak = speak; this.config(); this.checkBriefing();
    this.timer = setInterval(() => this.checkBriefing(), 30000);
  },
  async fetchText(url, timeout = 12000) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
    try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.text(); }
    finally { clearTimeout(timer); }
  },
  parseXml(xml, feed) {
    const documentXml = new DOMParser().parseFromString(xml, 'text/xml');
    if (documentXml.querySelector('parsererror')) throw new Error('Flux RSS/XML invalide.');
    const nodes = [...documentXml.querySelectorAll('item, entry')].slice(0, 15);
    return nodes.map((node, index) => {
      const title = cleanText(node.querySelector('title')?.textContent, 240);
      const atomLink = [...node.querySelectorAll('link')].find(link => link.getAttribute('href'))?.getAttribute('href');
      const link = node.querySelector('link')?.textContent?.trim() || atomLink || '';
      const description = node.querySelector('description, summary, content')?.textContent || '';
      const pubDate = node.querySelector('pubDate, published, updated, date')?.textContent || '';
      const enclosure = node.querySelector('enclosure[type^="image"]')?.getAttribute('url')
        || node.querySelector('media\\:thumbnail, media\\:content')?.getAttribute('url') || '';
      return { id: Utils.uid('news'), feedId: feed.id, source: feed.name, title, summary: cleanText(description, 420),
        thumbnail: validUrl(enclosure) ? enclosure : '', link: validUrl(link) ? link : '',
        pubDate: Number.isNaN(new Date(pubDate).getTime()) ? new Date().toISOString() : new Date(pubDate).toISOString(), order: index };
    }).filter(item => item.title);
  },
  async fetchFeed(feed) {
    try {
      const xml = await this.fetchText(feed.url);
      const items = this.parseXml(xml, feed); if (items.length) return items;
      throw new Error('Flux vide.');
    } catch (directError) {
      // Repli de conversion RSS public : seule l'URL du flux public est transmise.
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`${feed.name} indisponible (${directError.message} / proxy ${response.status}).`);
      const payload = await response.json();
      if (payload.status !== 'ok' || !Array.isArray(payload.items)) throw new Error(payload.message || `${feed.name} : conversion RSS impossible.`);
      return payload.items.slice(0, 15).map((item, index) => ({ id: Utils.uid('news'), feedId: feed.id, source: feed.name,
        title: cleanText(item.title, 240), summary: cleanText(item.description || item.content, 420), link: validUrl(item.link) ? item.link : '',
        thumbnail: validUrl(item.thumbnail) ? item.thumbnail : '',
        pubDate: item.pubDate && !Number.isNaN(new Date(item.pubDate.replace(' ', 'T')).getTime()) ? new Date(item.pubDate.replace(' ', 'T')).toISOString() : new Date().toISOString(), order: index })).filter(item => item.title);
    }
  },
  async refresh() {
    if (this.refreshing) return this.refreshing;
    const config = this.config(); const feeds = config.feeds.filter(feed => feed.enabled && validUrl(feed.url));
    if (!feeds.length) throw new Error('Activez au moins un flux RSS valide.');
    this.refreshing = (async () => {
      const results = await Promise.allSettled(feeds.map(feed => this.fetchFeed(feed)));
      const items = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value);
      if (!items.length) {
        const error = new Error('Actualités indisponibles. Les flux ont refusé la connexion ou le service de conversion est injoignable.');
        config.lastError = error.message; Store.saveSettings(); Bus.emit('news:changed', { error }); throw error;
      }
      const seen = new Set();
      config.items = items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate) || a.order - b.order).filter(item => {
        const key = `${item.source}:${item.title.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true;
      }).slice(0, 30).map(({ order, ...item }) => item);
      config.updatedAt = new Date().toISOString(); config.lastError = results.some(result => result.status === 'rejected') ? 'Certains flux sont indisponibles ; les sources accessibles sont affichées.' : '';
      Store.saveSettings(); Bus.emit('news:changed', { items: config.items }); return config.items;
    })();
    try { return await this.refreshing; } finally { this.refreshing = null; }
  },
  spokenSummary(limit = 3) {
    const items = this.config().items.slice(0, limit);
    if (!items.length) return 'Je n’ai aucun titre d’actualité récent en mémoire. Actualise les flux RSS quand tu es connecté.';
    const intro = `Bonjour Nils. Voici ton point actualité en résumé, du ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date())}.`;
    const body = items.map((item, index) => {
      const firstSentence = (item.summary || '').match(/^.{40,180}?[.!?](?:\s|$)/)?.[0] || item.summary || '';
      const detail = firstSentence && !firstSentence.toLowerCase().includes(item.title.toLowerCase().slice(0, 35)) ? ` ${firstSentence.slice(0, 180)}` : '';
      return `Actualité ${index + 1}, ${item.source}. ${item.title}.${detail}`;
    }).join(' ');
    return `${intro} ${body} Fin du point actualité. Les résumés reprennent les descriptions RSS des sources.`;
  },
  async deliver(manual = false) {
    if (!this.config().items.length && navigator.onLine) { try { await this.refresh(); } catch { /* le texte honnête est utilisé */ } }
    const accepted = this.speak?.(this.spokenSummary(3), { automatic: manual ? false : 'briefing' });
    if (accepted && !manual) { const config = this.config(); config.lastBriefingDate = Utils.iso(); Store.saveSettings(); }
    return accepted;
  },
  checkBriefing() {
    const config = this.config(); if (!config.briefingEnabled || config.lastBriefingDate === Utils.iso() || !navigator.onLine && !config.items.length) return;
    const [hour, minute] = String(config.briefingTime || '07:00').split(':').map(Number); const now = new Date();
    const scheduled = new Date(now); scheduled.setHours(hour, minute, 0, 0);
    if (now >= scheduled && now - scheduled <= 60 * 60000) {
      const stale = !config.updatedAt || Date.now() - new Date(config.updatedAt).getTime() > 6 * 3600000;
      const ready = stale && navigator.onLine ? this.refresh().catch(() => []) : Promise.resolve(config.items);
      ready.then(() => this.deliver(false));
    }
  },
  addFeed(name, url) {
    if (!name.trim()) throw new Error('Donnez un nom à cette source.');
    if (!validUrl(url)) throw new Error('Le flux doit commencer par http:// ou https://.');
    const config = this.config(); config.feeds.push({ id: Utils.uid('feed'), name: name.trim(), url: url.trim(), enabled: true }); Store.saveSettings();
  },
  removeFeed(id) { const config = this.config(); config.feeds = config.feeds.filter(feed => feed.id !== id); config.items = config.items.filter(item => item.feedId !== id); Store.saveSettings(); }
};
