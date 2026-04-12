/**
 * Item-level visibility resolver for the per-item eye toggle feature (#28).
 *
 * Keypath grammar:
 *   keypath := topKey | topKey "." itemKey
 *   topKey  := [a-zA-Z][a-zA-Z0-9]*
 *   itemKey := slugFragment ("@" indexFallback)?
 *   slugFragment := url-safe slug (lowercased, kebab-cased, 60 char max)
 *   indexFallback := integer (item's index at save time)
 *
 * Examples:
 *   "impressiveWorkflows"                  → hide whole section
 *   "impressiveWorkflows.parallel-refactor" → hide one workflow
 *   "impressiveWorkflows.refactor@2"       → collision-disambiguated
 */

const SLUG_MAX_LENGTH = 60;

/**
 * Convert a natural key (e.g. workflow title) into a stable slug fragment.
 * Lowercased, kebab-cased, stripped of non-url-safe chars, max 60 chars.
 */
export function slugItemKey(natural: string): string {
  return (
    natural
      .toLowerCase()
      // Replace non-alphanumeric (including emoji/unicode) with hyphens
      .replace(/[^a-z0-9]+/g, "-")
      // Collapse multiple hyphens
      .replace(/-{2,}/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-|-$/g, "")
      // Enforce max length
      .slice(0, SLUG_MAX_LENGTH)
      // Trim trailing hyphen after slice
      .replace(/-$/, "")
  );
}

/**
 * Build the itemKey for an item in a list, appending @index only on collision.
 */
export function buildItemKey<T>(
  list: readonly T[],
  index: number,
  natural: (t: T) => string,
): string {
  const base = slugItemKey(natural(list[index]));
  if (!base) return `@${index}`;

  const duplicates = list.filter((item) => slugItemKey(natural(item)) === base);
  if (duplicates.length <= 1) return base;
  return `${base}@${index}`;
}

/**
 * Parse a keypath into its topKey and optional itemKey.
 * Returns null if malformed.
 */
export function parseKeypath(keypath: string): {
  topKey: string;
  itemKey: string | null;
} | null {
  if (!keypath || typeof keypath !== "string") return null;

  const dotIndex = keypath.indexOf(".");
  if (dotIndex === -1) {
    // Top-level key only
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(keypath)) return null;
    return { topKey: keypath, itemKey: null };
  }

  const topKey = keypath.slice(0, dotIndex);
  const itemKey = keypath.slice(dotIndex + 1);

  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(topKey)) return null;
  if (!itemKey) return null;
  // itemKey must be a valid slug fragment optionally followed by @number
  if (!/^[a-z0-9][a-z0-9-]*(@\d+)?$/.test(itemKey)) return null;

  return { topKey, itemKey };
}

/**
 * Build a Set from the hiddenHarnessSections string array.
 */
export function hideSetFromArray(arr: readonly string[]): Set<string> {
  return new Set(arr);
}

/**
 * Check if a whole section is hidden (top-level key present in set).
 */
export function isSectionHidden(
  hidden: Set<string>,
  sectionKey: string,
): boolean {
  return hidden.has(sectionKey);
}

/**
 * Check if a specific item is hidden.
 * Returns true if either the section-level key OR the item-level keypath is in the set.
 */
export function isItemHidden(
  hidden: Set<string>,
  sectionKey: string,
  itemKey: string,
): boolean {
  // Section-level hide trumps — if the whole section is hidden, every item is hidden
  if (hidden.has(sectionKey)) return true;
  return hidden.has(`${sectionKey}.${itemKey}`);
}

/**
 * Filter a list, removing items whose keypath is in the hidden set.
 * If the whole section is hidden, returns an empty array.
 */
export function filterList<T>(
  list: readonly T[],
  hidden: Set<string>,
  sectionKey: string,
  natural: (t: T) => string,
): T[] {
  if (isSectionHidden(hidden, sectionKey)) return [];

  // Check if there are any item-level hides for this section
  const hasItemHides = Array.from(hidden).some(
    (k) => k.startsWith(`${sectionKey}.`),
  );
  if (!hasItemHides) return [...list];

  return list.filter((_, index) => {
    const itemKey = buildItemKey(list, index, natural);
    return !hidden.has(`${sectionKey}.${itemKey}`);
  });
}

/**
 * Filter a record (object), removing entries whose key-slug is in the hidden set.
 * If the whole section is hidden, returns an empty object.
 */
export function filterRecord<T>(
  rec: Record<string, T>,
  hidden: Set<string>,
  sectionKey: string,
): Record<string, T> {
  if (isSectionHidden(hidden, sectionKey)) return {} as Record<string, T>;

  // Check if there are any item-level hides for this section
  const hasItemHides = Array.from(hidden).some(
    (k) => k.startsWith(`${sectionKey}.`),
  );
  if (!hasItemHides) return { ...rec };

  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(rec)) {
    const itemKey = slugItemKey(key);
    if (!hidden.has(`${sectionKey}.${itemKey}`)) {
      result[key] = value;
    }
  }
  return result;
}
