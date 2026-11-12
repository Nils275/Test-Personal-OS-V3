/* PERSONAL OS — Disposition : menu latéral repliable en rail d'icônes.
   Module autonome (aucune dépendance) : ne touche ni aux données ni à la voix.
   - Bouton « replier » dans l'en-tête du menu, raccourci Ctrl/Cmd + B.
   - Replié, le rail se déplie au survol ou au focus clavier.
   - Le choix est mémorisé sur cet appareil (localStorage). */
const KEY = 'personal-os.rail';

function read() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
function write(value) { try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* stockage indisponible : le choix vaut pour cette session */ } }

function apply(collapsed) {
  document.body.classList.toggle('rail', collapsed);
  const button = document.querySelector('[data-rail-toggle]');
  if (button) {
    button.setAttribute('aria-pressed', String(collapsed));
    button.setAttribute('aria-label', collapsed ? 'Épingler le menu (le déplier en permanence)' : 'Replier le menu');
    button.title = collapsed ? 'Épingler le menu (Ctrl+B)' : 'Replier le menu (Ctrl+B)';
  }
}

function toggle() { const next = !document.body.classList.contains('rail'); apply(next); write(next); }

function init() {
  apply(read());
  document.querySelector('[data-rail-toggle]')?.addEventListener('click', toggle);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'b') {
      const tag = (event.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || event.target.isContentEditable) return;
      event.preventDefault(); toggle();
    }
  });
  // Libellés accessibles pour le rail replié (lecteurs d'écran, appui long tactile).
  document.querySelectorAll('.nav-item').forEach(item => {
    const label = item.querySelector('span:nth-child(2)')?.textContent?.trim();
    if (label && !item.title) item.title = label;
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
