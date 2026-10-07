import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type BlockUserProps = {
  matchId: string;
  /** The other person on the job. */
  otherId: string;
  /** Who's blocking, which sets the wording. */
  from: 'customer' | 'trade';
  /** True while the job is still in progress (it goes back out if they block). */
  inProgress: boolean;
  onBlocked: () => void;
};

/**
 * "Block": stops messages both ways and the two being matched again (see the blocking migration).
 * The other person isn't told. Apple requires it for apps where people message each other.
 */
export function BlockUser({ matchId, otherId, from, inProgress, onBlocked }: BlockUserProps) {
  const [blocked, setBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const other = from === 'trade' ? 'customer' : 'trade';

  useEffect(() => {
    supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocked_id', otherId)
      .maybeSingle()
      .then(({ data }) => setBlocked(!!data));
  }, [otherId]);

  async function block() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('block_from_match', { p_match_id: matchId });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setBlocked(true);
    setOpen(false);
    onBlocked();
  }

  if (blocked) {
    return (
      <Notice
        tone="info"
        title={`You’ve blocked this ${other}`}
        message={`You can’t message each other, and ${from === 'trade' ? 'you won’t be sent their jobs' : 'they won’t be sent your jobs'} again.`}
      />
    );
  }

  if (!open) {
    return <Button label={`Block this ${other}`} variant="outline" onPress={() => setOpen(true)} style={styles.inline} />;
  }

  const consequences = [
    'You won’t be able to message each other.',
    from === 'trade' ? 'You’ll never be sent their jobs again.' : 'They’ll never be sent your jobs again.',
    inProgress &&
      (from === 'trade'
        ? 'This job goes to another trade, so you won’t be doing it.'
        : 'We’ll find you another trade for this job.'),
    `The ${other} isn’t told they’ve been blocked. The Backed. team is.`,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <ThemedText type="heading">Block this {other}?</ThemedText>
      {consequences.map((line) => (
        <ThemedText key={line} type="small" themeColor="textSecondary">
          • {line}
        </ThemedText>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        This can’t be undone in the {from === 'trade' ? 'app' : 'website'}. If something serious happened, please report
        it too.
      </ThemedText>
      {error && <Notice message={error} />}
      <View style={styles.buttons}>
        <Button label={busy ? 'Blocking…' : `Block this ${other}`} disabled={busy} onPress={block} />
        <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  inline: {
    alignSelf: 'flex-start',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
