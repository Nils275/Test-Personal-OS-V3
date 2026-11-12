# PERSONAL OS — Architecture technique

Ce document décrit l’architecture cible (React + TypeScript + Supabase + Capacitor) et l’état réel de la livraison actuelle, qui est une **application web modulaire exécutable immédiatement**, sans build ni serveur. Aucune fonctionnalité affichée n’est simulée.

---

## 1. Architecture cible

```
┌────────────────────────────────────────────────────────────┐
│  TABLETTE ANDROID (Capacitor) · NAVIGATEUR · WINDOWS       │
│  React 18 + TypeScript · Tailwind · Framer Motion          │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Modules UI   │ │ SOPHIE UI    │ │ IndexedDB (cache)  │  │
│  └──────┬───────┘ └──────┬───────┘ └─────────┬──────────┘  │
│         │   Store local (optimistic UI + file d'attente)   │
└─────────┼────────────────┼─────────────────────┼───────────┘
          │                │                     │
          ▼                ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Supabase         │ │ API LLM sécurisée│ │ Proxy TTS        │
│ Postgres + RLS   │ │ (function calls  │ │ ElevenLabs       │
│ Auth · Storage   │ │ validés serveur) │ │ clé côté serveur │
│ Realtime         │ └──────────────────┘ └──────────────────┘
└──────────────────┘
```

**Règle d’or** : aucune clé API n’est jamais dans le frontend. Le client appelle des endpoints sécurisés qui détiennent les secrets en variables d’environnement.

## 2. Arborescence de la livraison actuelle

```
index.html            Coque, navigation, modale, racines d'interface
style.css             Design system cockpit (console de supervision)
script.js             Contrôleur, actions, éditeurs, recherche, mode concentration
manifest.json         PWA et raccourcis
service-worker.js     Cache applicatif hors ligne
icon.svg              Icône applicative
README.md             Installation, configuration, périmètre réel
ARCHITECTURE.md       Ce document
js/
  core.js             Persistance, dépôt CRUD, sélecteurs, notifications, automatisations, météo, Spotify
  ui.js               Icônes SVG, modales, formulaires, confirmations, toasts, graphiques
  sophie.js           Moteur d'intentions, outils (function calling), mémoire, briefings, recherche
  tts.js              ElevenLabs (proxy sécurisé) + repli voix native + circuit breaker
  voice.js            Wake word local, STT, états visuels, annonces
  news.js             Flux RSS réels, résumé extractif, briefing vocal
  alarms.js           Réveils, sonnerie Web Audio, report
  focus.js            Focus / minuteur persistant
  views.js            Registre des espaces
  view-state.js       État volatil des filtres
  views-primary.js    Dashboard, Objectifs, Sport & SPV, Projets
  views-operations.js Finances, Calendrier, Appareils, Notifications, Sophie, Journal, Paramètres
```

Pour une migration React, chaque fichier `js/*.js` devient un dossier `src/features/<module>/` avec `hooks`, `components`, `types` et `api`. Le dépôt `Repo` devient un service typé partagé.

## 3. Schéma de base PostgreSQL (Supabase)

```sql
-- Profil étendu
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accent text default '#FF7A1A', theme text default 'nocturne',
  voice_provider text default 'auto', elevenlabs_voice_id text,
  quiet_start time default '22:00', quiet_end time default '07:00',
  wake_word_enabled boolean default false, payload jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text not null, description text, category text, status text, priority text,
  icon text, color text, progress numeric default 0 check (progress between 0 and 100),
  budget numeric default 0, deadline date, created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  project_id uuid references projects(id) on delete set null, goal_id uuid,
  title text not null, status text default 'todo', priority text default 'Normale',
  due date, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on tasks(user_id, due);
create index on tasks(project_id);

create table goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text not null, category text, priority text, start date, deadline date,
  current numeric default 0, target numeric default 1, unit text, description text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table goal_milestones (
  id uuid primary key default gen_random_uuid(), goal_id uuid references goals(id) on delete cascade,
  title text not null, done boolean default false, position int default 0
);

create table sport_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  type text, started_at timestamptz, duration int, distance numeric, reps int,
  feeling int check (feeling between 0 and 10), performance text, status text default 'Terminée'
);
create table sport_metrics (
  id uuid primary key default gen_random_uuid(), session_id uuid references sport_sessions(id) on delete cascade,
  key text, value numeric, unit text
);

create table transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  type text check (type in ('income','expense')), label text not null,
  category text, amount numeric not null check (amount >= 0), tx_date date not null, notes text
);
create index on transactions(user_id, tx_date);

create table budgets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  month char(7), category text, planned numeric, unique(user_id, month, category)
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  title text not null, event_date date, start time, end time, category text,
  description text, reminder_minutes int default 30, repeat_rule text,
  project_id uuid references projects(id) on delete set null, goal_id uuid
);

create table devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text, brand text, model text, category text, status text,
  purchase_date date, warranty_until date, value numeric, notes text, last_check timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  title text, body text, type text, priority text, source text,
  read boolean default false, announced_at timestamptz, dedupe_key text, created_at timestamptz default now()
);
create index on notifications(user_id, created_at desc);

create table automation_rules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text, kind text, config jsonb, enabled boolean default true
);
create table automation_logs (
  id bigserial primary key, user_id uuid, rule_id uuid, detail text, created_at timestamptz default now()
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  kind text, title text, content text, tags text[], entry_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  project_id uuid references projects(id) on delete cascade,
  name text, path text, url text, size bigint
);

create table assistant_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  title text, created_at timestamptz default now()
);
create table assistant_messages (
  id bigserial primary key, conversation_id uuid references assistant_conversations(id) on delete cascade,
  role text check (role in ('user','assistant','tool')), content text, created_at timestamptz default now()
);
create table assistant_memory (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  kind text check (kind in ('Permanente','Temporaire','Préférence')), content text,
  tags text[], created_at timestamptz default now()
);
create table assistant_actions (
  id bigserial primary key, user_id uuid, tool text, args jsonb,
  status text check (status in ('pending','confirmed','cancelled','failed')), created_at timestamptz default now()
);
create table integrations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  provider text, status text, meta jsonb, updated_at timestamptz default now()
);
```

### Tables du module Rappels

```sql
create table reminders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  title text not null, description text, category text, priority text,
  voice_message text, style text default 'Amical',
  reminder_date date, reminder_time time not null,
  channels jsonb default '{"inApp":true,"vocal":true,"system":true}'::jsonb,
  enabled boolean default true, status text default 'active',
  source text default 'Manuel', link_type text, link_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on reminders(user_id, enabled, reminder_date);

create table reminder_schedules (
  id uuid primary key default gen_random_uuid(), reminder_id uuid references reminders(id) on delete cascade,
  freq text check (freq in ('once','hourly','daily','weekdays','weekly','monthly')),
  days int[], day_of_month int, anchor date, timezone text default 'Europe/Paris',
  next_occurrence timestamptz, fired_keys text[] default '{}'
);
create index on reminder_schedules(next_occurrence);

create table reminder_history (
  id bigserial primary key, reminder_id uuid references reminders(id) on delete cascade,
  action text check (action in ('triggered','done','snooze','postpone','missed','cancelled')),
  detail text, created_at timestamptz default now()
);

create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  quiet_start time default '22:00', quiet_end time default '07:00',
  max_announce_per_interval int default 1, interval_minutes int default 5,
  priority_floor text default 'Normale', payload jsonb default '{}'::jsonb
);

create table voice_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text default 'auto', voice_id text, style text default 'Amical',
  repeat_enabled boolean default false, repeat_delay_minutes int default 5,
  fallback_provider text default 'native'
);
```

**Anti-doublons multi-appareils** : `reminder_schedules.fired_keys` + `device_id` horodaté ; toute occurrence déjà présente dans la table est ignorée par les autres appareils. Le fuseau horaire est stocké par planification ; les changements d’heure sont recalculés sur `next_occurrence`.

**Capacitor Local Notifications** (`@capacitor/local-notifications`) planifie la notification Android à chaque occurrence, indépendamment de l’ouverture de l’application. La **lecture vocale** en arrière-plan passe par un service natif Kotlin (TTS Android ou streaming ElevenLabs) : une page web ne peut pas lancer un audio librement application fermée.

### Politiques RLS (exemple)

```sql
alter table projects enable row level security;
create policy "owner" on projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Répéter pour chaque table utilisateur.
-- assistant_actions : le serveur valide le tool et le statut avant insertion.
```

## 4. API et services nécessaires

| Service | Usage | Clé | Statut livraison |
|---|---|---|---|
| Open-Meteo | Météo et prévisions | aucune | **Intégré et fonctionnel** |
| Flux RSS / rss2json | Point actualité | aucune | **Intégré et fonctionnel** |
| Spotify Embed | Widget média | aucune | **Intégré et fonctionnel** |
| ElevenLabs | TTS voix Sophie | côté serveur | **Architecture livrée** : appelle `elevenlabsEndpoint`, repli natif automatique |
| API LLM | Compréhension libre | côté serveur | **Connecteur prévu** (`llmEndpoint`) ; moteur local fonctionnel |
| Supabase | Sync, auth, storage | anon + RLS | **Schéma livré**, adapter `Store` vers l’API Supabase |
| Google Calendar / Outlook | Sync agenda | OAuth | Futur, non simulé |
| Agrégateur bancaire | Transactions | OAuth + DSP2 | Futur, jamais simulé |

## 5. SOPHIE — fonctionnement détaillé

1. **Activation** : bouton, ou « Hé Sophie » détecté localement dans le transcript STT (regexp sur `hé/hey/dis/ok + sophie`). Aucune donnée vocale n’est envoyée à un serveur par PERSONAL OS lui-même.
2. **STT** : Web Speech API (`fr-FR`), reconstruite en continu en mode wake word.
3. **Compréhension** : moteur d’intentions local (`js/sophie.js`) couvrant minuteur, réveils, actualités, briefing, bilans, mode concentration, recherche, mémorisation, dépenses, performances sportives multi-exercices, idées de projet, tâches, notes, objectifs, projets, budget, notifications. Un LLM peut être branché via `llmEndpoint` pour les demandes hors vocabulaire, avec sortie structurée vers les mêmes outils.
4. **Outils** : registre `Sophie.tools` (create_task, create_event, create_sport_session, add_sport_performance, create_expense, create_note, create_goal, get_daily_schedule, get_project_details, get_weekly_report, get_notifications). Les outils `sensitive: true` exigent un « confirme » explicite ou une confirmation en interface.
5. **Mémoire** : `sophieMemory` (Permanente / Temporaire / Préférence), consultable, modifiable et supprimable par l’utilisateur. Elle est injectée dans le contexte des rapports.
6. **TTS** : ElevenLabs via proxy sécurisé (voice ID `Kuy2kDCiyKmA79V9BbDr`), puis repli voix native. Erreurs discriminées : `auth` (401/403), `quota` (402/429/503), `network`, `server`, avec circuit breaker et reprise automatique.
7. **États visuels** : veille · écoute · réflexion · réponse (orb + waveform).
8. **Annonces** : notifications, briefings, confirmations, avec plages silencieuses et fréquence maximale.

## 6. Permissions Android (Capacitor)

| Permission | Usage | Plugin |
|---|---|---|
| `RECORD_AUDIO` | STT + wake word | `@capacitor/microphone` |
| `POST_NOTIFICATIONS` | Notifications locales | `@capacitor/local-notifications` |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` | Écoute « Hé Sophie » en arrière-plan | service Kotlin `VoiceInteractionService` |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Réveils exacts | `@capacitor/local-notifications` |
| `WAKE_LOCK` | Écran veille affichage permanent | natif |
| `INTERNET` | Météo, RSS, ElevenLabs, Supabase | Capacitor |
| `POST_NOTIFICATIONS` + `BATTERY_STATS` | État batterie appareil courant | natif |

**Honnêteté technique** : une page web ne peut pas écouter lorsque l’application est fermée. Le wake word livré fonctionne pendant que PERSONAL OS est ouvert. L’écoute en arrière-plan exige le service Kotlin ci-dessus, avec notification permanente Android et consentement explicite.

## 7. Variables d’environnement (côté serveur / proxy)

```
ELEVENLABS_API_KEY=...          # jamais côté client
ELEVENLABS_VOICE_ID=Kuy2kDCiyKmA79V9BbDr
LLM_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # serveur uniquement
SUPABASE_ANON_KEY=...           # utilisable côté client, RLS actif
```

Frontend : `elevenlabsEndpoint` (URL du proxy), `llmEndpoint`, `supabaseUrl`, `supabaseAnonKey` uniquement.

## 8. Compilation Android

```bash
npm create vite@latest personal-os -- --template react-ts   # migration cible
npm i @capacitor/core @capacitor/cli @capacitor/android
npm i @capacitor/local-notifications @capacitor/microphone
npx cap init "PERSONAL OS" com.personalos.app
npm run build && npx cap add android && npx cap sync
npx cap open android      # Android Studio : permissions, service Kotlin, signature
```

Pour la livraison web actuelle : héberger le dossier en HTTPS, ouvrir `index.html`, puis « Installer l’application ».

## 9. Plan de développement par phases

| Phase | Contenu | État |
|---|---|---|
| 1 — Socle | Design system, navigation, dashboard, widgets personnalisables | **Livré** |
| 2 — Modules | Objectifs, Sport/SPV, Projets, Finances, Appareils, Calendrier, Notifications, Journal | **Livré** |
| 3 — Données | Persistance locale (2 espaces), export/import, migration schéma v2, cache PWA | **Livré** |
| 4 — Sophie V1 | Conversation, STT, TTS + fallback, outils, mémoire, briefings, bilans, recherche | **Livré** |
| 5 — Sophie V2 | Wake word local, réglages, annonces, confirmation sensible | **Livré (natif : à faire)** |
| 6 — Intelligence | Automatisations, recommandations contextuelles | **Partiellement livré** |
| 7 — Finalisation | Supabase, auth, RLS, sync multi-appareils, build Android | **Schéma et architecture livrés** |

## 10. Ce qui nécessite un service externe ou du natif

- **ElevenLabs** : abonnement payant + proxy serveur pour la clé.
- **LLM** : API payante, endpoint serveur requis.
- **Supabase** : compte, schéma ci-dessus, RLS, adaptateur de synchronisation.
- **Wake word en arrière-plan, réveils application fermée, notifications push Android, widgets écran d’accueil** : application native Kotlin.
- **Banque, Google Calendar** : OAuth et prestataires externes, jamais simulés.
