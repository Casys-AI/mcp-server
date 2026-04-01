# TODO — SDK 1.27 features à exposer dans @casys/mcp-server

Issu de l'audit collaboratif Claude + Codex sur mcp-einvoice (2026-03-22).
Ces features nécessitent des changements dans le framework mcp-server
pour que les consumers (mcp-einvoice, mcp-erpnext) puissent les adopter.

## 1. structuredContent — séparer data modèle vs data viewer

**Problème actuel :** les tools retournent tout dans `content` (texte JSON).
Le LLM reçoit le dataset complet dans son contexte, même quand seul le viewer en a besoin.

**Ce que SDK 1.27 apporte :**
- `CallToolResult.structuredContent` — data optimisée pour le viewer, hors contexte LLM
- `CallToolResult.content` — résumé texte pour le LLM

**Ce que mcp-server doit faire :**
- `registerTools()` doit accepter un handler qui retourne `{ content, structuredContent }`
- Le wrapper doit mapper ça vers le format `CallToolResult` du SDK
- Backward-compatible : si le handler retourne un objet simple, le wrapper le met dans `content` comme avant

**Impact :** High — réduit le contexte LLM, accélère les réponses, permet des datasets plus gros.

## 2. outputSchema — typer les retours de tools

**Problème actuel :** les tools déclarent `inputSchema` mais pas de schema de sortie.
Le host ne peut pas valider les retours.

**Ce que SDK 1.27 apporte :**
- `registerTool()` accepte un `outputSchema` (Zod ou JSON Schema)
- Le host peut valider et le viewer peut typer

**Ce que mcp-server doit faire :**
- Ajouter `outputSchema` optionnel dans la config de `registerTools()`
- Le passer au SDK lors de l'enregistrement

**Impact :** Medium — améliore la fiabilité, pas critique immédiatement.

## 3. Tool visibility ["app"] — tools privés pour les viewers

**Problème actuel :** tous les tools sont visibles par le LLM ET par les viewers.
Le refresh, la pagination, et les actions UI polluent le tool list du modèle.

**Ce que SDK 1.27 + ext-apps 1.1+ apporte :**
- `_meta.ui.visibility: ["app"]` — tool caché du LLM, appelable uniquement par le viewer
- `isToolVisibilityAppOnly()` helper

**Ce que mcp-server doit faire :**
- `registerTools()` doit supporter `_meta.ui.visibility` dans la config du tool
- Le `registerViewers()` actuel met déjà `_meta.ui.resourceUri` — ajouter `visibility`
- Ajouter un helper `registerAppOnlyTool()` pour simplifier

**Impact :** Medium-High — nettoie le tool list LLM, réduit la confusion.

## 4. Tool annotations (title, readOnlyHint, destructiveHint)

**Problème actuel :** les tools n'ont que `name` et `description`.
Pas de metadata pour le host (read-only, destructif, titre court).

**Ce que SDK 1.11+ apporte :**
- `annotations.title` — titre court pour l'UI
- `annotations.readOnlyHint` — indique que le tool ne modifie rien
- `annotations.destructiveHint` — indique une action destructive

**Ce que mcp-server doit faire :**
- Accepter `annotations` dans la config de `registerTools()`
- Le passer au SDK

**Impact :** Low-Medium — cosmétique mais professionnel.

## 5. Centralized error → isError mapping

**Problème actuel :** mcp-einvoice a dû créer son propre `withErrorHandler`.
Le framework devrait le faire.

**Ce que le SDK attend :**
- `CallToolResult.isError: true` pour les erreurs business
- `content` avec le message d'erreur

**Ce que mcp-server doit faire :**
- Wrapper automatique autour des handlers : si le handler throw, retourner `isError: true`
- Configurable : le consumer peut fournir son propre error mapper
- Distinguer NotSupportedError (capability issue) vs API error vs validation error

**Impact :** Medium — DRY, tous les consumers en bénéficient.
