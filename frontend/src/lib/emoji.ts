/**
 * Eigene Emoji-Grafiken statt der reinen Unicode-Zeichen.
 *
 * Ein rohes "😀" im Text ueberlaesst die Darstellung komplett dem
 * Betriebssystem — fehlt dort ein neueres Zeichen (z.B. 🫶, erst seit 2022),
 * zeigt der Browser ein leeres Kaestchen statt eines Bilds, und selbst
 * vorhandene Zeichen sehen je nach Geraet unterschiedlich aus. WhatsApp,
 * Telegram & Co. umgehen das, indem sie ihre eigenen Emoji-Bilder mitliefern
 * — bei jeder Person exakt gleich, unabhaengig vom Geraet. Hier genauso,
 * nur mit einer kleinen kuratierten Auswahl statt tausenden.
 *
 * Bilder: Twemoji (jdecked/twemoji), Lizenz CC-BY 4.0 — Twitter, Inc und
 * Mitwirkende.
 */

export const EMOJI_LIST = [
  '😀', '😂', '🥲', '😅', '😍', '🥰', '😘', '😜', '🤔', '🙄',
  '😴', '😭', '😮', '😡', '🥳', '😎', '🙃', '😇', '🤗', '😬',
  '👍', '👎', '👏', '🙏', '🙌', '✌️', '🤝', '💪', '👀', '🫶',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯', '🔥', '✨',
  '🎉', '🎂', '🎵', '🎧', '📸', '☕', '🍕', '🚀',
] as const;

/** Zeichen -> Dateiname unter /public/emoji. Manche Zeichen bestehen aus
 *  mehreren Codepoints (Basis + Variationsselektor) — Twemoji fuehrt die
 *  Datei dann nur unter dem Basis-Codepoint, deshalb hier von Hand statt
 *  automatisch aus dem Zeichen berechnet. */
const FILE_BY_EMOJI: Record<string, string> = {
  '😀': '1f600', '😂': '1f602', '🥲': '1f972', '😅': '1f605', '😍': '1f60d',
  '🥰': '1f970', '😘': '1f618', '😜': '1f61c', '🤔': '1f914', '🙄': '1f644',
  '😴': '1f634', '😭': '1f62d', '😮': '1f62e', '😡': '1f621', '🥳': '1f973',
  '😎': '1f60e', '🙃': '1f643', '😇': '1f607', '🤗': '1f917', '😬': '1f62c',
  '👍': '1f44d', '👎': '1f44e', '👏': '1f44f', '🙏': '1f64f', '🙌': '1f64c',
  '✌️': '270c', '🤝': '1f91d', '💪': '1f4aa', '👀': '1f440', '🫶': '1faf6',
  '❤️': '2764', '🧡': '1f9e1', '💛': '1f49b', '💚': '1f49a', '💙': '1f499',
  '💜': '1f49c', '🖤': '1f5a4', '💯': '1f4af', '🔥': '1f525', '✨': '2728',
  '🎉': '1f389', '🎂': '1f382', '🎵': '1f3b5', '🎧': '1f3a7', '📸': '1f4f8',
  '☕': '2615', '🍕': '1f355', '🚀': '1f680',
};

export function emojiSrc(emoji: string): string | null {
  const file = FILE_BY_EMOJI[emoji];
  return file ? `/emoji/${file}.svg` : null;
}

// Laengste zuerst, damit z.B. "❤️" (zwei Codepoints) vor einem zufaelligen
// Teiltreffer geprueft wird.
const EMOJI_PATTERN = new RegExp(
  Object.keys(FILE_BY_EMOJI)
    .sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);

/** Text in Stuecke zerlegt: normale Strings und { emoji } fuer Treffer aus
 *  der kuratierten Liste — Komponenten rendern daraus Text bzw. <img>. */
export function splitEmoji(text: string): (string | { emoji: string })[] {
  const parts: (string | { emoji: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_PATTERN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ emoji: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
