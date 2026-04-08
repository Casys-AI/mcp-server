# EXPLORATION.md — MCP Bridge: hypothèses ouvertes

Document de réflexion. Rien n'est décidé. Tout est ouvert à discussion.

---

## Contexte

mcp-bridge sert les UIs MCP (`ui://` resources) dans des environnements qui ne
les rendent pas nativement. Aujourd'hui : Telegram Mini Apps, LINE LIFF. Demain
: potentiellement d'autres plateformes messaging.

Les clients MCP natifs (Claude Desktop, ChatGPT, VS Code, Cursor) rendent déjà
les `ui://` en iframe sandboxée. Pour eux, le bridge n'a pas de valeur ajoutée.

---

## Hypothèse 1 — Le bridge est un plugin OpenClaw, pas un produit standalone

**Observation :** si tu es sur Telegram avec du MCP, c'est que tu utilises
OpenClaw (ou un framework similaire). Les utilisateurs de Claude Desktop n'ont
pas besoin du bridge.

**Question ouverte :** est-ce qu'il existe un use case hors OpenClaw ? Un bot
Telegram custom qui parle MCP sans passer par OpenClaw ? Si oui, le bridge
standalone a du sens. Sinon, c'est un plugin.

**Argument pour plugin :** OpenClaw gère déjà les connexions MCP (stdio + HTTP),
l'auth, les sessions, le routing vers Telegram. Dupliquer ça dans un package
séparé = maintenance double.

**Argument pour standalone :** garder la lib réutilisable permet à d'autres
frameworks (pas seulement OpenClaw) de l'utiliser. Le code est propre, testé
(120 tests), découplé.

**Position intermédiaire :** lib standalone sur npm/jsr + plugin OpenClaw qui
l'utilise.

---

## Hypothèse 2 — Self-hosted vs. bridge hébergé

### Option A — Self-hosted (chaque user sert son bridge)

- Le bridge tourne sur la machine de l'utilisateur
- L'utilisateur doit exposer un port HTTPS public (Caddy, nginx, tunnel)
- Avantage : tout reste chez lui, pas de dépendance externe
- Inconvénient : surface d'attaque (WebSocket, sessions, proxy JSON-RPC),
  scaling = son problème

### Option B — Bridge hébergé (on gère le bridge pour les users)

- Le bridge tourne sur une infra séparée (Deno Deploy, Deno Subhosting, VPS
  dédié)
- OpenClaw appelle le bridge hébergé quand il détecte un `ui://` dans un
  résultat MCP
- URL type : `bridge.casys.ai/render?uri=ui://einvoice/viewer&session=xxx`
- Avantage : la machine de l'utilisateur n'expose rien de plus
- Inconvénient : dépendance à un service tiers, latence réseau, coût

### Option C — Hybride

- Bridge hébergé par défaut
- Option self-hosted pour ceux qui préfèrent garder le contrôle
- Le plugin OpenClaw sait router vers l'un ou l'autre

**Question ouverte :** est-ce que les utilisateurs OpenClaw sont prêts à exposer
un port supplémentaire ? Ou est-ce que la facilité d'un bridge hébergé l'emporte
?

---

## Hypothèse 3 — Deno Subhosting pour le multi-tenant

**Idée :** utiliser Deno Subhosting pour que chaque client (Kelly, Boris, etc.)
ait son propre worker bridge isolé, sans rien toucher à la machine principale.

**Ce que ça permettrait :**

- Provisioning via API :
  `POST /provision { template: "einvoice", config: {...} }`
- Chaque client = un worker Deno sandboxé avec ses credentials
- URL HTTPS automatique
- Isolation native (pas de fuite entre clients)

**Questions ouvertes :**

- Est-ce que le coût Deno Subhosting (tier Builder ~$100/mois?) est justifié
  pour le volume ?
- Est-ce que le bridge est assez léger pour tourner dans les limites Subhosting
  (512MB RAM, 50ms CPU/req) ?
- Est-ce qu'un simple Deno Deploy (pas Subhosting) suffit si on n'a pas besoin
  de multi-tenant ?
- Est-ce que la latence Deno → MCP du client (via Internet) est acceptable pour
  du temps réel WebSocket ?

---

## Hypothèse 4 — Le hosting MCP n'appartient pas au bridge

**Observation :** déployer des instances MCP pour des users (einvoice avec leurs
credentials, erpnext avec leur config) est un problème de **serveur/infra**, pas
de bridge.

**Question :** est-ce que ça va dans `mcp-server` ? Dans un projet dédié
(`casys-cloud`, `mcp-hosting`) ? Ou est-ce que c'est un feature de la plateforme
casys.ai plus large ?

**Lien avec mcp-compose :** si les instances MCP des users sont hébergées,
mcp-compose peut les consommer pour faire des dashboards composites. Les trois
couches (hosting, bridge, compose) se complètent mais restent des projets
séparés.

---

## Hypothèse 5 — Compatibilité plateforme par plateforme

Le bridge doit adapter le rendu selon la plateforme cible. Chaque plateforme a
ses contraintes :

| Plateforme | Webview native ?       | Ce que le bridge peut faire                  |
| ---------- | ---------------------- | -------------------------------------------- |
| Telegram   | Oui (Mini App)         | Webview intégrée, auth initData, thème natif |
| LINE       | Oui (LIFF)             | Webview intégrée, auth LINE Login            |
| WhatsApp   | Non                    | Lien HTTPS dans le message, page web externe |
| Discord    | Non (embeds seulement) | Lien externe, embed riche possible           |
| Signal     | Non                    | Lien HTTPS uniquement                        |
| iMessage   | Non                    | Lien HTTPS uniquement                        |

**Question ouverte :** est-ce que ça vaut le coup de faire un travail
d'adaptation par plateforme ? Ou est-ce qu'un simple "lien vers une page web
responsive" suffit pour toutes sauf Telegram/LINE ?

---

## Hypothèse 6 — Relation avec les plateformes de hosting MCP existantes

**Smithery, Composio, Glama, etc. :** ces plateformes servent les MCP dans des
clients qui supportent déjà les UIs nativement. Elles ne résolvent pas le
problème "afficher un ui:// dans Telegram".

**Question ouverte :** est-ce que ces plateformes vont ajouter le support
messaging un jour ? Si oui, est-ce qu'on est en avance ou est-ce qu'on va se
faire rattraper ? Si non, on a un créneau durable.

**Autre angle :** est-ce qu'on pourrait se brancher SUR Smithery/Composio au
lieu de gérer nos propres instances MCP ? Le bridge comme couche de rendu
au-dessus de leur hosting.

---

## Hypothèse 7 — BackendRegistry (multi-backend dynamique)

**Idée initiale :** permettre au bridge de connecter N serveurs MCP à la volée.
`bridge.addBackend("einvoice", "http://localhost:3015")` → discovery automatique
via `tools/list`.

**Pertinence actuelle :** si le bridge est un plugin OpenClaw, OpenClaw gère
déjà les connexions MCP. Le registry devient redondant.

**Si le bridge reste aussi standalone :** le registry a du sens pour les
déploiements hors OpenClaw.

**Question ouverte :** est-ce qu'on investit du temps dessus maintenant, ou on
attend de clarifier le positionnement (plugin vs standalone) ?

---

## Prochaines questions à trancher

1. Plugin OpenClaw, lib standalone, ou les deux ?
2. Self-hosted, hébergé, ou hybride ?
3. Le hosting MCP (Subhosting) — dans quel projet ça vit ?
4. Est-ce qu'on code le BackendRegistry maintenant ou on attend ?
5. PR OpenClaw pour les `web_app` buttons Telegram — ça c'est utile dans tous
   les cas
6. Quel est le premier use case concret qu'on veut faire marcher de bout en bout
   ?

---

_Document vivant. Mis à jour au fil des discussions._ _Dernière mise à jour :
2026-03-18_
