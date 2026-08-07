import { emojiSrc, splitEmoji } from '@/lib/emoji';

/** Text mit eingebetteten Emoji-Grafiken statt roher Unicode-Zeichen — siehe
 *  lib/emoji.ts fuers Warum. */
export default function EmojiText({ text }: { text: string }) {
  return (
    <>
      {splitEmoji(text).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <img
            key={i}
            src={emojiSrc(part.emoji) ?? undefined}
            alt={part.emoji}
            className="inline-block h-[1.15em] w-[1.15em] shrink-0 -translate-y-[0.12em] align-middle"
          />
        ),
      )}
    </>
  );
}
