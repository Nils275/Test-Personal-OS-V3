# PERSONAL OS — Guide d’installation et de configuration

## 1. Présentation

PERSONAL OS est un centre de pilotage personnel en HTML5, CSS3 et JavaScript ES6+ natif. Aucun framework, aucune compilation et aucune dépendance JavaScript ne sont nécessaires. L’interface est conçue pour une tablette Android paysage, un smartphone et un ordinateur Windows.

L’application fonctionne avec **deux espaces strictement séparés** :

- **Démonstration** : jeu entièrement fictif, identifié par un bandeau et par les libellés « fictif » des opérations financières. Il permet de tester tous les modules.
- **Données réelles** : espace initialement vide. Aucun enregistrement fictif n’y est copié.

Les changements sont conservés dans le LocalStorage du navigateur. Une exportation JSON permet les sauvegardes et les transferts.

## 2. Arborescence

- `index.html` : coque accessible, navigation, barre supérieure, modale et racines d’interface.
- `style.css` : design system, cockpit, responsive et animations.
- `script.js` : contrôleur, navigation, formulaires, actions et intégration PWA.
- `js/core.js` : adaptateur de persistance, dépôt CRUD, sélecteurs, notifications, automatisations et météo.
- `js/ui.js` : icônes SVG, modales, formulaires, confirmations, toasts et graphiques SVG.
- `js/view-state.js` : état volatil des filtres et vues.
- `js/views-primary.js` : Dashboard, Objectifs, Sport & SPV, Projets.
- `js/views-operations.js` : Finances, Calendrier, Appareils, Notifications, Assistant, Journal, Paramètres.
- `js/views.js` : registre des espaces.
- `js/voice.js` : Web Speech API et moteur de commandes locales.
- `js/focus.js` : minuteur Focus et minuteur libre persistants, cycles travail/pause et notification de fin.
- `js/news.js` : flux RSS réels, résumé extractif et briefing vocal programmé.
- `js/alarms.js` : réveils récurrents, sonnerie Web Audio, report et réveils « travail ».
- `manifest.json` : installation PWA et raccourcis.
- `service-worker.js` : cache de l’interface pour le mode hors ligne.
- `icon.svg` : icône de l’application.

Cette séparation évite un fichier JavaScript monolithique et prépare l’ajout de futurs modules.

## 3. Installation locale sur Windows

Les modules ES et le service worker doivent être servis en HTTP, et non ouverts avec `file://`.

### Option A — Python

1. Installer Python 3 si nécessaire.
2. Ouvrir un terminal dans le dossier du projet.
3. Lancer `python -m http.server 8080`.
4. Ouvrir `http://localhost:8080` dans Chrome ou Edge.

### Option B — extension de serveur local

Utiliser un serveur statique comme « Live Server » dans l’éditeur, puis ouvrir l’URL locale fournie. Aucune commande `npm install` ou étape de build n’est requise.

## 4. Installation sur tablette Android

1. Héberger le dossier sur un serveur HTTPS (hébergement statique, NAS avec HTTPS, ou réseau de développement approprié).
2. Ouvrir l’URL dans Chrome Android.
3. Charger une première fois toutes les vues principales pour laisser le service worker mettre la coque en cache.
4. Dans le menu Chrome, choisir **Installer l’application** ou **Ajouter à l’écran d’accueil**.
5. Ouvrir PERSONAL OS depuis la nouvelle icône.
6. Utiliser le bouton plein écran pour un poste mural ou de bureau.

`localhost` est accepté pour le développement. En production, HTTPS est indispensable au service worker, à la géolocalisation et généralement au microphone.

## 5. Configuration recommandée

### Première utilisation

1. Explorer l’espace **Démonstration**.
2. Dans **Paramètres → Données & PWA**, sélectionner **Mes données réelles**.
3. Définir le budget mensuel dans **Finances → Budget & épargne** si souhaité.
4. Exporter une première sauvegarde après les saisies importantes.

### Rappels intelligents de Sophie

Espace dédié **Rappels** dans la navigation.

- **Création** : interface, commande vocale (« rappelle-moi de faire la machine à 18 heures », « rappelle-moi dans 15 minutes »), suggestion de Sophie ou depuis une tâche/événement.
- **Planification** : une fois, toutes les heures, tous les jours, certains jours de la semaine, chaque semaine, chaque mois.
- **Personnalité des annonces** : Professionnel, Amical, Humoristique, Direct — ou message vocal personnalisé par rappel. L’humour reste bienveillant.
- **Au déclenchement** : notification + affichage dans PERSONAL OS + lecture vocale (ElevenLabs puis repli natif), avec boutons **C’est fait / +15 min / Décale à demain / Annuler**.
- **Interactions vocales** : « c’est fait », « rappelle-moi dans 15 minutes », « décale à demain », « annule ce rappel ».
- **Suggestions** : proposées d’après tâches, habitudes et échéances, jamais en double.
- **Historique complet** : déclenchements, reports, annulations, rappels manqués (signalés une seule fois).

Fonctionnement pendant que PERSONAL OS est ouvert. Les notifications Android planifiées application fermée utilisent Capacitor Local Notifications et un service natif pour la lecture vocale — voir `ARCHITECTURE.md`.

### Dépannage — écran d’ouverture figé

Si l’application reste sur « Initialisation du centre de commande… » :

1. **Vous ouvrez `index.html` en double‑clic (`file://`)** : le navigateur bloque les modules de `js/`. Servez le dossier en local — `node server.js` puis `http://localhost:8080`, ou utilisez un serveur Live Server.
2. **Un message de diagnostic s’affiche automatiquement** au bout de 5 secondes : il montre l’erreur exacte (fichier et ligne) et propose **Recharger** ou **Réinitialiser les données locales** si vos réglages sont corrompus.
3. Vérifiez que le dossier `js/` complet est bien présent : `core.js`, `ui.js`, `view-state.js`, `views.js`, `views-primary.js`, `views-operations.js`, `views-reminders.js`, `voice.js`, `sophie.js`, `tts.js`, `news.js`, `alarms.js`, `focus.js`, `reminders.js`.
4. Les modules ES exigent **HTTP ou HTTPS** — jamais l’ouverture directe du fichier.

### Démarrage direct (option B)

Dans **Paramètres → Affichage** :

- **Vue chargée au démarrage** : dernière vue ouverte (par défaut), Dashboard compact, Calendrier, Sophie ou Journal. L’application monte cette vue immédiatement, sans écran d’ouverture ni animation d’entrée.
- **Démarrage direct sans ouverture** : active le rendu instantané du cockpit.
- **Affichage permanent** : maintient l’écran actif via la Screen Wake Lock API, utile pour une tablette fixe ou murale. Le verrou est repris automatiquement quand l’application revient au premier plan.
- Le **plein écran** complète ce dispositif pour un rendu kiosque.

Un lancement automatique au démarrage de l’appareil, application fermée, exige une application native Android (launcher/boot receiver) : voir `ARCHITECTURE.md`, section permissions.

### Apparence

Dans **Paramètres → Général** : variantes Nocturne ou Contraste renforcé, couleurs principales et secondaires, préréglages, animations, halos réduits et densité. Le thème reste sombre. Le réglage système « réduire les animations » est toujours respecté.

### Widgets

- Sur le Dashboard, utiliser la poignée pour glisser-déposer un widget.
- Le bouton de dimensions fait défiler trois tailles.
- Le bouton œil masque le widget.
- **Paramètres → Widgets** permet aussi de modifier l’ordre, la taille et la visibilité, utile sur écran tactile sans glisser-déposer.

### Météo réelle

Dans **Paramètres → Général → Position Open-Meteo** :

- soit saisir latitude/longitude et un nom de lieu ;
- soit cliquer sur **Utiliser ma position** et autoriser la géolocalisation.

Cliquer ensuite sur **Actualiser la météo**. Le relevé provient de l’API publique Open-Meteo (`current=temperature_2m, apparent_temperature, weather_code, wind_speed_10m`). Aucune clé n’est requise. Hors connexion, le dernier relevé reste identifiable par sa date ; aucune météo de remplacement n’est inventée.

### Voix et annonces

Dans **Paramètres → Voix & alertes** :

- activer les réponses vocales et/ou les annonces automatiques ;
- choisir vitesse, hauteur et niveau de priorité annoncé ;
- configurer la plage silencieuse, y compris une plage traversant minuit ;
- demander séparément l’autorisation des notifications système si souhaité.

Une voix française disponible sur l’appareil est sélectionnée automatiquement. Les voix réellement proposées dépendent d’Android, de Windows et du navigateur. Une notification ne reçoit qu’un horodatage d’annonce après une lecture effective.

### Micro

Le bouton micro demande l’autorisation du navigateur. `SpeechRecognition` n’est pas disponible partout et peut dépendre d’un service du navigateur. Si l’API est absente ou indisponible, l’assistant affiche clairement ce statut et la **commande texte exécute exactement les mêmes intentions**.

### SOPHIE — copilote personnel

L’assistante s’appelle **Sophie**. Elle est disponible en saisie texte et à la voix, avec activation locale « Hé Sophie » (détectée dans le transcript, sans serveur, pendant que l’application est ouverte).

Commandes opérationnelles : programme du jour, briefing, bilan du jour, bilan de la semaine, état d’un projet, budget restant, enregistrement de plusieurs performances sportives (« j’ai fait 20 pompes et 45 secondes de gainage »), dépense avec confirmation, idée rattachée à un projet, tâche, note, mode concentration, minuteur, réveils travail, recherche universelle, mémorisation d’informations.

- **Mémoire** : permanente, temporaire ou préférence, consultable et supprimable dans l’espace Sophie.
- **Outils** : registre de fonctions autorisées (function calling local) ; les actions sensibles exigent un « confirme » explicite.
- **Voix** : ElevenLabs via proxy sécurisé (voice ID configuré côté serveur), repli automatique sur la voix native en cas de quota, clé invalide ou panne réseau. Mode : Automatique / ElevenLabs / Native.
- **Briefings** : matinal et hebdomadaire programmables, une seule fois par période, plages silencieuses respectées.

### Installer votre clé API ElevenLabs

⚠️ **La clé ne s’intègre jamais dans le code du navigateur.** Elle va dans le proxy sécurisé, qui est déjà écrit pour vous.

**Solution 1 — sur votre PC (test immédiat, 5 minutes)**

1. Dupliquer `.env.example` en `.env` et coller la clé :
   ```
   ELEVENLABS_API_KEY=votre_cle_ici
   ELEVENLABS_VOICE_ID=Kuy2kDCiyKmA79V9BbDr
   ```
2. Lancer le serveur fourni, sans aucune installation :
   ```bash
   node server.js
   ```
   → PERSONAL OS répond sur `http://localhost:8080`, le proxy sur `POST /api/tts`.
3. Dans l’application : **Sophie → Réglages rapides → Endpoint du proxy ElevenLabs** :
   `http://localhost:8080/api/tts`
4. Choisir **Fournisseur vocal : Automatique**, puis cliquer **Tester la voix ElevenLabs**.
   Le message confirme si la voix ElevenLabs ou la voix native a été utilisée.

**Solution 2 — accessible depuis la tablette (recommandé à l’usage)**

1. Déployer `api/tts.js` sur Vercel ou Netlify (fonction serverless, prête à l’emploi).
2. Ajouter la variable d’environnement `ELEVENLABS_API_KEY` (et `ELEVENLABS_VOICE_ID`) dans le tableau de bord de l’hébergement.
3. Renseigner l’endpoint public dans Sophie : `https://votre-domaine/api/tts`
   (HTTPS obligatoire pour le microphone et Android).

**Règles de sécurité**

- Ne jamais coller la clé dans `index.html`, un fichier JS ou les paramètres de l’application.
- Ne jamais committer `.env` (ajouter `.env` à `.gitignore`).
- En cas de clé invalide, de quota épuisé ou de coupure réseau, Sophie bascule automatiquement sur la voix native et le signale — sans perdre son texte.

Le détail complet (architecture, schéma SQL, permissions Android, variables d’environnement) est dans `ARCHITECTURE.md`.

## Menu MAISON — centre de gestion domestique

Le menu **Maison** (page d’accueil) est un espace complet à thème clair glassmorphique, indépendant des autres menus :

| Rubrique | Contenu |
|---|---|
| **Tableau de bord** | Horloge, progression de la journée, grande carte météo, programme du jour, courses, repas, organisation, factures, actualités, Sophie |
| **Météo & environnement** | Conditions actuelles, prévisions horaires (12 h) et 7 jours, UV, lever/coucher, vent, humidité |
| **Actualités** | Flux RSS réels, 8 catégories, recherche, favoris, ouverture des sources |
| **Calendrier** | Vues jour/semaine/mois + jours fériés français calculés |
| **Courses & provisions** | Listes multiples, articles, quantités, prix estimés, catégories, achat cochable, budget estimé |
| **Cuisine & repas** | Recettes, ingrédients, difficulté, menu 7 jours, recette → liste de courses |
| **Organisation du quotidien** | Tâches ménage/rangement/administratif/jardin, priorités, répétitions, filtres |
| **Entretien du logement** | Carnet d’équipements, garanties, historique d’entretiens et réparations |
| **Budget & factures** | 10 catégories domestiques, échéances, payée/à payer, répartition, comparatif 6 mois |
| **Documents de la maison** | Bail, assurances, garanties, notices, contrats, recherche et classement |
| **Sophie maison** | Commandes reliées aux données : météo, actualités, programme, courses, factures |

### Ce qui est simulé ou limité

- **Qualité de l’air** : aucune source configurée — l’information n’est jamais inventée.
- **Alertes météo officielles** : renvoi vers Vigicrues/Météo-France, PERSONAL OS n’est pas un service d’alerte.
- **Import de fichiers PDF** : référencement par lien ou note ; le stockage de fichiers binaires volumineux nécessite IndexedDB/Supabase.
- **Création vocale d’article de courses** : les commandes vocales du menu Maison répondent et affichent ; la création passe par le module Rappels/Sophie principal.

## 6. Fonctionnalités réellement opérationnelles

### Dashboard

Horloge et date en direct, statut `navigator.onLine`, météo configurée, compteurs non lus, accès plein écran et vocal. Les huit widgets calculent leurs chiffres depuis les collections actives. Les modules sont masquables, redimensionnables et réorganisables.

### Objectifs

Création, modification et suppression ; catégorie, priorité, dates, unité, cible et valeur actuelle ; progression calculée ; étapes cochables ; tâches associées ; commentaires et historique daté. Filtres par catégorie et état.

### Sport & SPV

Séances terminées ou planifiées, type, durée, distance, répétitions, performance libre, ressenti sur 10 et notes. Statistiques hebdomadaires, charge quotidienne, graphiques d’évolution et objectifs sportifs utilisant le moteur Objectifs. Les données ne constituent pas un avis médical.

### Projets et tâches

Projets illimités avec description, icône, catégorie, statut, priorité, dates, progression et budget. Vues cartes, Kanban avec changement de statut par dépôt, et chronologique. Tâches associées ou transverses, notes et références de documents/liens http(s). La suppression d’un projet conserve ses tâches dans la boîte d’arrivée.

Les documents sont des **liens ou références**, pas un téléversement de fichiers. Ce comportement est indiqué dans l’interface.

### Finances

CRUD revenus/dépenses, catégories, sélection du mois, budget, solde, taux d’épargne indicatif, répartition par catégorie et tendance sur six mois. Abonnements actifs/suspendus, rappels de renouvellement, dettes et versements plafonnés au reste dû. Tout est manuel et modifiable.

### Calendrier

Vues mois, semaine et jour ; création depuis une date ou une heure ; modification et suppression ; catégorie colorée, projet associé, description et rappel. Les rappels sont contrôlés pendant que l’application est ouverte.

### Appareils

Inventaire complet, garantie, statut déclaré et vérification manuelle horodatée. La sonde de l’appareil courant utilise uniquement les API autorisées : `navigator.onLine`, Battery API si présente et StorageManager pour le stockage **du site**. Les autres appareils affichent explicitement la télémétrie comme indisponible.

### Notifications et automatisations

Notifications internes manuelles ou générées, lecture/non-lecture, suppression, filtres et priorités. Règles activables : tâches dues/en retard, objectifs proches, séance enregistrée, dépense enregistrée, rappel d’événement, renouvellement d’abonnement et rappel sportif de fin de semaine. Historique daté et clés anti-doublon.

### Journal et assistant

Journal CRUD avec type, date/heure, contenu et étiquettes. Historique des commandes de Personal Voice conservé séparément dans chaque espace.

### Sauvegarde et PWA

Export JSON des deux espaces et des réglages ; import validé avec confirmation ; réinitialisations ciblées. Service worker pour la coque hors ligne. Les données ne sont pas effacées par une mise à jour du cache.

## 7. Stockage et évolution backend

Clés utilisées : `personal-os.v1.workspace.demo`, `personal-os.v1.workspace.real`, `personal-os.v1.settings` et `personal-os.v1.mode`.

`LocalAdapter` isole les appels `read`, `write` et `remove`. `Store` gère les espaces et `Repo` fournit les opérations CRUD communes. Pour Supabase, créer un adaptateur asynchrone conservant ce contrat, ajouter l’authentification et une file de synchronisation, puis faire appel à cet adaptateur dans `Store`. Ne jamais placer une clé secrète Supabase dans le JavaScript client ; utiliser la clé publique prévue avec Row Level Security.

LocalStorage convient à cette version monoposte et à des données textuelles. Pour de nombreuses pièces jointes ou un volume important, migrer les collections vers IndexedDB derrière le même adaptateur.

## 8. Intégrations nécessitant une API ou du natif Android

- **Supabase** : synchronisation cloud et multi-appareils, non configurée.
- **IA générative** : aucune API configurée ; l’assistant actuel est un moteur de règles locales, pas une IA distante.
- **Banque** : aucun agrégateur connecté et aucune synchronisation simulée. Un prestataire et un backend sécurisé seraient nécessaires.
- **Télémétrie d’autres appareils** : application/companion réseau ou Android natif nécessaire.
- **Notifications Android externes et arrière-plan application fermée** : push, service natif ou wrapper Android nécessaires. Les rappels actuels fonctionnent pendant l’ouverture de l’application.
- **Reconnaissance/synthèse application fermée, widgets Android** : natif nécessaire.
- **Météo** : Open-Meteo est déjà intégré et nécessite Internet seulement pour l’actualisation.

## 9. Limites et bonnes pratiques

- Les données sont locales à **ce navigateur et ce profil**. Nettoyer les données du site peut les supprimer.
- Il n’y a ni chiffrement applicatif ni authentification dans cette version. Protéger l’appareil et les fichiers de sauvegarde.
- Exporter régulièrement, en particulier avant une réinitialisation ou un changement de navigateur.
- Le mode hors ligne concerne l’interface et les données locales. Les polices distantes, la météo et certains services de reconnaissance peuvent nécessiter le réseau ; des polices système de repli sont prévues.
- Les montants de la démonstration ne doivent jamais être interprétés comme des données financières réelles.

## Mise à jour 3.3.0 — Mosaïque, tablette/PC et caméra d'alarme

**Disposition « Mosaïque »** (Maison → tableau de bord) : tuiles de tailles variées, 6 colonnes dès 900 px de contenu (PC, tablette paysage), 4 colonnes en tablette portrait, 2 sur téléphone. Le bouton **Classique** (en haut à droite) rétablit l'ancienne disposition.

**Caméra d'alarme (mise en scène)** : la caméra frontale s'affiche avec un habillage de vidéosurveillance et un détecteur de mouvement local.
- « Sophie, active l'alarme » → caméra en marche ; « Sophie, désactive l'alarme » → caméra coupée (aussi : pastille *ALARME* en haut, bouton de la tuile Caméra).
- Aucune image n'est enregistrée ni envoyée ; pas de sirène ni d'alerte externe. Ce n'est pas un système de sécurité.
- HTTPS (ou localhost) obligatoire ; la caméra n'est relancée au démarrage que si l'autorisation est déjà accordée.
- Mains libres : Paramètres → activer « Hé Sophie ».

**Voir les modifications après un dépôt GitHub** : le dépôt GitHub n'affiche que le code. Activer *Settings → Pages* (branche `main`, dossier `/ (root)`) et ouvrir `https://<compte>.github.io/<dépôt>/`. `index.html` doit être à la racine du dépôt. Le pied du menu affiche `BUILD 3.3.0` : si ce n'est pas le cas, la page est une ancienne version (actualisation forcée : Ctrl+Maj+R, ou effacer les données du site sur la tablette).
