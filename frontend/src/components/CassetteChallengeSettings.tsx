import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCassetteChallenge, setCassetteChallengeOff, setChallengeMuted, type Cassette } from '@/lib/api';
import { useApp } from '@/store/appStore';
import SwitchRow from './SwitchRow';

/**
 * Die Wochen-Challenge einer Runde (CassetteInfo.tsx): fuer alle ein- und
 * ausschalten duerfen nur die Admins — die Gruenderin und wen sie ernennt.
 * Stummschalten kann jede Person nur fuer sich; das erfaehrt niemand.
 */
export default function CassetteChallengeSettings({ cassette }: { cassette: Cassette }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['challenge', cassette.id, me],
    queryFn: () => fetchCassetteChallenge(cassette.id, me),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['challenge'] });
    void qc.invalidateQueries({ queryKey: ['cassettes', me] });
    void qc.invalidateQueries({ queryKey: ['feed', cassette.id] });
  };
  const toggleOff = useMutation({
    mutationFn: (off: boolean) => setCassetteChallengeOff(cassette.id, me, off),
    onSuccess: refresh,
  });
  const toggleMute = useMutation({
    mutationFn: (muted: boolean) => setChallengeMuted(cassette.id, me, muted),
    onSuccess: refresh,
  });

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="mb-1 text-xs font-semibold" style={{ color: 'var(--dim)' }}>
        Wochen-Challenge
      </h3>
      <SwitchRow
        title="In dieser Runde"
        hint={
          data?.iAmAdmin
            ? 'Gilt für alle hier. Ausgeschaltet verschwinden Beiträge, die noch nicht aufgelöst sind, wieder aus dem Band.'
            : 'Für alle ein- und ausschalten dürfen die Admins der Runde.'
        }
        on={!(data?.off ?? false)}
        disabled={!data || !data.iAmAdmin || toggleOff.isPending}
        onToggle={(on) => {
          if (on || confirm(`Wochen-Challenge auf „${cassette.name}“ für alle ausschalten?`)) toggleOff.mutate(!on);
        }}
      />
      {!data?.off && (
        <SwitchRow
          title="Für mich stummschalten"
          hint="Du siehst die Challenge hier nicht und legst nichts hinein. Niemand erfährt davon."
          on={data?.muted ?? false}
          disabled={!data || toggleMute.isPending}
          onToggle={(muted) => toggleMute.mutate(muted)}
        />
      )}
    </section>
  );
}
