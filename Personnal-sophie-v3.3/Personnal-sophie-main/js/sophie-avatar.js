/* ═══════════════════════════════════════════════════════════════════════
   SOPHIE — Identité visuelle réutilisable
   Portrait vectoriel original (femme professionnelle, cheveux bruns attachés,
   veste sombre, casque micro, éclairage bleu doux).

   ► VOTRE PROPRE PORTRAIT : déposez une image (par ex. sophie-portrait.png)
     et renseignez son URL dans Paramètres → Sophie → Portrait,
     ou remplacez directement DEFAULT_PORTRAIT ci-dessous.
     Formats conseillés : carré, 512×512 minimum, fond transparent ou clair.
   ═══════════════════════════════════════════════════════════════════════ */
import { Store } from './core.js';

export const DEFAULT_PORTRAIT = ''; // ← URL de votre image ici (facultatif)

/* Portrait vectoriel — équilibre dessiné pour rester lisible de 32 px à 320 px. */
function portraitSvg(uid = 's') {
  return `<svg class="sophie-portrait-svg" viewBox="0 0 200 200" role="img" aria-label="Portrait de Sophie, assistante personnelle">
  <defs>
    <linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E4F3FD"/><stop offset=".52" stop-color="#CFE9F7"/><stop offset="1" stop-color="#D7F1E7"/>
    </linearGradient>
    <linearGradient id="skin-${uid}" x1=".18" y1="0" x2=".92" y2="1">
      <stop offset="0" stop-color="#F8DCC5"/><stop offset=".55" stop-color="#EFC8A9"/><stop offset="1" stop-color="#DCAF8B"/>
    </linearGradient>
    <linearGradient id="hair-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5C3B2B"/><stop offset=".5" stop-color="#42291E"/><stop offset="1" stop-color="#2B1913"/>
    </linearGradient>
    <linearGradient id="jacket-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#31414F"/><stop offset=".55" stop-color="#202B36"/><stop offset="1" stop-color="#141C24"/>
    </linearGradient>
    <linearGradient id="rim-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4FC3F0" stop-opacity=".8"/><stop offset="1" stop-color="#4FC3F0" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow-${uid}" cx=".5" cy=".42" r=".55">
      <stop offset="0" stop-color="#8FD8F7" stop-opacity=".55"/><stop offset="1" stop-color="#8FD8F7" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Fond et halo -->
  <rect width="200" height="200" rx="200" fill="url(#bg-${uid})"/>
  <circle cx="100" cy="86" r="82" fill="url(#glow-${uid})"/>
  <circle cx="100" cy="100" r="99" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2"/>

  <!-- Cheveux : masse arrière + chignon -->
  <ellipse cx="100" cy="41" rx="18" ry="13" fill="url(#hair-${uid})"/>
  <ellipse cx="100" cy="83" rx="43" ry="48" fill="url(#hair-${uid})"/>

  <!-- Cou -->
  <path d="M84 108 L116 108 L119 148 L81 148 Z" fill="url(#skin-${uid})"/>
  <path d="M84 108 L116 108 L114 128 Q100 138 86 128 Z" fill="#D3A182" opacity=".55"/>

  <!-- Veste professionnelle sombre -->
  <path d="M24 200 C27 165 50 141 79 132 L121 132 C150 141 173 165 176 200 Z" fill="url(#jacket-${uid})"/>
  <path d="M82 133 L100 172 L118 133 L110 130 L100 152 L90 130 Z" fill="#EAF2F6"/>
  <path d="M82 133 L100 172 L84 176 L64 145 Z" fill="#2A3846"/>
  <path d="M118 133 L100 172 L116 176 L136 145 Z" fill="#22303C"/>
  <path d="M24 200 C28 168 48 145 74 135 L82 141 C58 152 40 172 34 200 Z" fill="#FFFFFF" opacity=".07"/>

  <!-- Cheveux : contour du visage -->
  <path d="M64 84 C60 104 63 122 71 133 C64 112 63 96 66 84 Z" fill="url(#hair-${uid})"/>
  <path d="M136 84 C140 104 137 122 129 133 C136 112 137 96 134 84 Z" fill="url(#hair-${uid})"/>

  <!-- Visage -->
  <ellipse cx="100" cy="87" rx="35" ry="43" fill="url(#skin-${uid})"/>
  <ellipse cx="65" cy="92" rx="6" ry="9" fill="#E7BB99"/>
  <ellipse cx="135" cy="92" rx="6" ry="9" fill="#E7BB99"/>

  <!-- Traits du visage -->
  <ellipse cx="83" cy="109" rx="9" ry="5.5" fill="#E09B80" opacity=".18"/>
  <ellipse cx="117" cy="109" rx="9" ry="5.5" fill="#E09B80" opacity=".18"/>
  <path d="M77 80 Q87 75 96 79" stroke="#3B2519" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M104 79 Q113 75 123 80" stroke="#3B2519" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="87" cy="92" rx="7" ry="4.7" fill="#FFFFFF"/>
  <ellipse cx="113" cy="92" rx="7" ry="4.7" fill="#FFFFFF"/>
  <circle cx="87.5" cy="92.4" r="3.2" fill="#5B3A26"/>
  <circle cx="113.5" cy="92.4" r="3.2" fill="#5B3A26"/>
  <circle cx="88.6" cy="91.1" r="1.1" fill="#FFFFFF"/>
  <circle cx="114.6" cy="91.1" r="1.1" fill="#FFFFFF"/>
  <path d="M80 88.5 Q87 85 94 88.5" stroke="#3B2519" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M106 88.5 Q113 85 120 88.5" stroke="#3B2519" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M100 97 Q104 107 99.5 109 Q96.6 109.4 97.6 106.6" stroke="#C99474" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M88 117 Q100 127 112 117" stroke="#B4695A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M92 119.5 Q100 123.5 108 119.5" fill="#C77E6D" opacity=".35"/>

  <!-- Cheveux : front et frange tirée -->
  <path d="M65 84 C66 55 81 41 100 41 C119 41 134 55 135 84 C130 68 118 60 100 60 C82 60 70 68 65 84 Z" fill="url(#hair-${uid})"/>
  <path d="M72 62 C82 52 96 48 108 50" stroke="#7A5039" stroke-width="1.4" fill="none" opacity=".55"/>

  <!-- Casque et micro -->
  <path d="M61 86 C61 53 139 53 139 86" stroke="#26343E" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M61 86 C61 53 139 53 139 86" stroke="#4FC3F0" stroke-width="1.2" fill="none" opacity=".35"/>
  <rect x="128" y="78" width="17" height="27" rx="8.5" fill="#26343E"/>
  <rect x="131" y="82" width="11" height="19" rx="5.5" fill="#33454F"/>
  <rect x="55" y="78" width="17" height="27" rx="8.5" fill="#26343E"/>
  <rect x="58" y="82" width="11" height="19" rx="5.5" fill="#33454F"/>
  <path d="M134 104 Q126 117 112 119" stroke="#26343E" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <circle cx="110" cy="119.4" r="3.4" fill="#26343E"/>
  <circle cx="110" cy="119.4" r="1.3" fill="#4FC3F0"/>

  <!-- Éclairage bleu doux -->
  <path d="M67 70 C63 92 65 114 76 130" stroke="url(#rim-${uid})" stroke-width="3.4" fill="none" opacity=".6"/>
  <path d="M46 200 C50 172 62 152 80 141" stroke="url(#rim-${uid})" stroke-width="3" fill="none" opacity=".45"/>
  <circle cx="100" cy="100" r="99" fill="none" stroke="#4FC3F0" stroke-opacity=".18" stroke-width="3"/>
</svg>`;
}

/**
 * Composant Sophie réutilisable.
 * @param {number} size     largeur/hauteur en px
 * @param {string} state    idle | listening | thinking | speaking
 * @param {boolean} caption afficher prénom + statut
 * @param {boolean} button  afficher le bouton micro
 */
export function SophieAvatar({ size = 120, state = 'idle', caption = false, button = false, command = '' } = {}) {
  const photo = Store.settings.sophiePortrait || DEFAULT_PORTRAIT;
  const name = Store.settings.assistantName || 'Sophie';
  const labels = { idle: 'Disponible', listening: 'Je t’écoute', thinking: 'Je réfléchis', speaking: 'Sophie parle' };
  const media = photo
    ? `<img class="sophie-photo" src="${photo}" alt="Portrait de ${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="sophie-portrait-fallback" style="display:none">${portraitSvg()}</div>`
    : portraitSvg();
  return `<div class="sophie-avatar state-${state}" style="--avatar-size:${size}px">
    <div class="sophie-avatar-frame">
      ${media}
      <span class="sophie-ring ring-a"></span><span class="sophie-ring ring-b"></span>
      <span class="sophie-status-dot"></span>
    </div>
    ${caption ? `<div class="sophie-caption"><strong>${name}</strong><span class="sophie-state-label">${labels[state] || labels.idle}</span></div>` : ''}
    ${button ? `<button class="sophie-mic" data-action="${command || 'voice-toggle'}" aria-label="Activer ou désactiver le microphone">${iconMic()}</button>` : ''}
  </div>`;
}

function iconMic() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>';
}

/* L'état global piloté par body[data-sophie-state] anime tous les avatars. */
export function setSophieState(state) {
  document.body.dataset.sophieState = state || 'idle';
  document.querySelectorAll('.sophie-avatar').forEach(node => {
    node.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking');
    node.classList.add(`state-${state || 'idle'}`);
    const label = node.querySelector('.sophie-state-label');
    if (label) label.textContent = { idle: 'Disponible', listening: 'Je t’écoute', thinking: 'Je réfléchis', speaking: 'Sophie parle' }[state] || 'Disponible';
  });
}
