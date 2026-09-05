/** Small, renderer-neutral message dictionaries. Never translates domain data. */
export type MessageValues = Readonly<Record<string, string | number>>;

export type Translator<Key extends string> = (key: Key, values?: MessageValues) => string;

/** Callable message selector plus the dictionary locale actually chosen for a host locale. */
export interface TranslatorSelector<Key extends string> {
  (locale?: string): Translator<Key>;
  /** Exact registered locale, else the matched parent, else the canonical default. */
  locale(hostLocale?: string): string;
}

export interface MessageCatalog<Key extends string> {
  readonly defaultLocale?: string;
  readonly messages: Readonly<Record<Key, string>>;
  readonly translations?: Readonly<Record<string, Partial<Readonly<Record<Key, string>>>>>;
}

/**
 * Select messages by exact locale, then language parents, then the base dictionary.
 * Missing entries fall back independently. Invalid host locales use the base locale.
 * Interpolation is plain text; render the returned value as text, never as HTML.
 * `.locale(hostLocale)` uses that same chain and names the dictionary actually selected.
 */
export function createTranslator<Key extends string>(
  catalog: MessageCatalog<Key>,
): TranslatorSelector<Key> {
  const fallback = canonicalLocale(catalog.defaultLocale ?? "en");
  if (!fallback) throw new RangeError("Invalid default message locale");
  const base = { ...catalog.messages };
  const translations = new Map<string, Partial<Readonly<Record<Key, string>>>>();
  for (const [locale, messages] of Object.entries(catalog.translations ?? {})) {
    const normalized = canonicalLocale(locale);
    if (!normalized) throw new RangeError(`Invalid message locale: ${locale}`);
    if (translations.has(normalized)) throw new RangeError(`Duplicate message locale: ${locale}`);
    translations.set(normalized, { ...messages });
  }
  const select: TranslatorSelector<Key> = (locale) => {
    const candidates: Partial<Readonly<Record<Key, string>>>[] = [];
    for (const current of localeChain(locale, fallback)) {
      const messages = translations.get(current);
      if (messages) candidates.push(messages);
    }
    return (key, values) => {
      if (!Object.hasOwn(base, key)) throw new RangeError(`Unknown message key: ${key}`);
      const translated = candidates.find((messages) =>
        Object.hasOwn(messages, key) && typeof messages[key] === "string"
      )?.[key];
      const message = translated ?? base[key];
      return message.replace(
        /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
        (placeholder, name: string) =>
          values && Object.hasOwn(values, name) ? String(values[name]) : placeholder,
      );
    };
  };
  select.locale = (hostLocale) => {
    for (const current of localeChain(hostLocale, fallback)) {
      if (translations.has(current)) return current;
    }
    return fallback;
  };
  return select;
}

function localeChain(locale: string | undefined, fallback: string): string[] {
  const chain: string[] = [];
  let current = canonicalLocale(locale ?? "") ?? fallback;
  while (current) {
    chain.push(current);
    const separator = current.lastIndexOf("-");
    current = separator < 0 ? "" : current.slice(0, separator);
  }
  return chain;
}

function canonicalLocale(locale: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(locale)[0]?.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Interface wording only: contract states and caller messages remain untouched. */
export const MCP_VIEW_MESSAGES_EN = {
  loadingTitle: "Loading",
  loadingMessage: "Waiting for data…",
  emptyTitle: "Empty",
  emptyMessage: "No structured data received.",
  errorTitle: "Error",
  sessionRejectedTitle: "Session rejected",
  resultRejectedTitle: "Result rejected",
  surfaceRequiredTitle: "Surface required",
  surfaceRequiredMessage: "This App exposes components and requires a host-selected surface.",
  surfaceInvalidTitle: "Surface invalid",
  surfaceInvalidMessage: "The {owner} component surface is invalid: {error}",
  surfaceFailedTitle: "Surface failed",
  surfaceFailedMessage: "Component surface failed: {error}",
} as const;

export type McpViewMessages = { readonly [Key in keyof typeof MCP_VIEW_MESSAGES_EN]: string };

export const MCP_VIEW_MESSAGES_FR: McpViewMessages = {
  loadingTitle: "Chargement",
  loadingMessage: "En attente des données…",
  emptyTitle: "Aucune donnée",
  emptyMessage: "Aucune donnée structurée reçue.",
  errorTitle: "Erreur",
  sessionRejectedTitle: "Session rejetée",
  resultRejectedTitle: "Résultat rejeté",
  surfaceRequiredTitle: "Composition requise",
  surfaceRequiredMessage: "Cette App expose des composants et attend une composition de l’hôte.",
  surfaceInvalidTitle: "Composition invalide",
  surfaceInvalidMessage: "La composition {owner} est invalide : {error}",
  surfaceFailedTitle: "Échec de l’affichage",
  surfaceFailedMessage: "Échec de l’affichage des composants : {error}",
};

/** Extend a locale dictionary through createTranslator; no global locale or mutable registry. */
export const mcpViewMessages: TranslatorSelector<keyof McpViewMessages> = createTranslator({
  messages: MCP_VIEW_MESSAGES_EN,
  translations: { fr: MCP_VIEW_MESSAGES_FR },
});
