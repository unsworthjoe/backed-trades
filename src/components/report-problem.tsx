import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const REASONS = {
  customer: [
    'They didn’t turn up',
    'Poor quality work',
    'Rude or unsafe behaviour',
    'Pricing or payment problem',
    'Something else',
  ],
  trade: [
    'Customer not contactable',
    'Job different from description',
    'Rude or unsafe behaviour',
    'Payment problem',
    'Something else',
  ],
};

type ReportProblemProps = {
  jobId: string;
  /** The other person on the job. */
  aboutUserId: string;
  /** Who's reporting, which sets the reasons offered. */
  from: 'customer' | 'trade';
};

/** "Report a problem": goes to the Backed. team, never to the other person. */
export function ReportProblem({ jobId, aboutUserId, from }: ReportProblemProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('reports')
      .insert({ job_id: jobId, about_user_id: aboutUserId, reason, details: details.trim() });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Notice
        tone="success"
        title="Thanks, we’ve got your report"
        message="Someone from the Backed. team will look into it and be in touch. The other person isn’t told who reported it."
      />
    );
  }

  if (!open) {
    return <Button label="Report a problem" variant="outline" onPress={() => setOpen(true)} style={styles.inline} />;
  }

  return (
    <Card>
      <ThemedText type="heading">Report a problem</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        This goes to the Backed. team, not to the {from === 'customer' ? 'trade' : 'customer'}.
      </ThemedText>
      <View style={styles.chips}>
        {REASONS[from].map((r) => (
          <ChoiceChip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <TextField label="What happened?" value={details} onChangeText={setDetails} multiline maxLength={2000} />
      {error && <Notice message={error} />}
      <View style={styles.buttons}>
        <Button label={busy ? 'Sending…' : 'Send report'} disabled={!reason || busy} onPress={send} />
        <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  inline: {
    alignSelf: 'flex-start',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
