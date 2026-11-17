import { useQuery } from '@tanstack/react-query';
import { fetchProfiles, mediaUrl } from '@/lib/api';
import { colorFor, initialOf, type Side } from '@/store/appStore';

/** Profile einmal zentral laden — bei dieser Gruppengroesse eine winzige Liste. */
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    staleTime: 60_000,
  });
}

interface Props {
  name: string;
  side: Side;
  /** Kantenlaenge in rem. */
  size?: number;
  /** Bild-ID direkt vorgeben, statt sie aus den Profilen zu ziehen. */
  avatarId?: string | null;
}

export default function Avatar({ name, side, size = 1.5, avatarId }: Props) {
  const { data: profiles } = useProfiles();
  const id = avatarId !== undefined ? avatarId : (profiles?.find((p) => p.name === name)?.avatarId ?? null);

  const style = { width: `${size}rem`, height: `${size}rem` } as const;

  if (id) {
    return (
      <img
        src={mediaUrl(id)}
        alt={name}
        title={name}
        loading="lazy"
        className="shrink-0 rounded-full object-cover"
        style={{ ...style, boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }}
      />
    );
  }

  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-medium text-[#17130E]"
      style={{ ...style, background: colorFor(name, side), fontSize: `${size * 0.42}rem` }}
    >
      {initialOf(name)}
    </span>
  );
}
