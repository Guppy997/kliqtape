import { emojiSrc, EMOJI_LIST } from '@/lib/emoji';
import Sheet from './Sheet';

export default function EmojiPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (e: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Emoji">
      <div className="grid grid-cols-8 gap-1.5">
        {EMOJI_LIST.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="grid aspect-square place-items-center rounded-lg transition-transform active:scale-90"
            style={{ background: 'var(--card)' }}
          >
            <img src={emojiSrc(e) ?? undefined} alt={e} className="size-6" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
