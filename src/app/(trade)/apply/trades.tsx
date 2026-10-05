import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { ToggleRow } from '@/components/ui/toggle-row';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { saveChoices } from '@/lib/save-choices';
import { supabase } from '@/lib/supabase';
import { useApplication, useReferenceData, type Application } from '@/lib/use-application';
import type { Tables } from '@/types/database';

export default function TradesScreen() {
  const { application } = useApplication();
  const reference = useReferenceData();
  if (!reference || !application?.trade) return <LoadingScreen />;
  return <TradesForm application={application} trade={application.trade} categories={reference.categories} />;
}

function TradesForm({
  application,
  trade,
  categories,
}: {
  application: Application;
  trade: Tables<'trades'>;
  categories: Tables<'trade_categories'>[];
}) {
  const [chosen, setChosen] = useState<number[]>(application.categoryIds);
  const [largeJobs, setLargeJobs] = useState(trade.can_take_large_jobs);
  const [callouts, setCallouts] = useState(trade.accepts_callouts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setChosen((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  async function save() {
    if (!chosen.length) return setError('Pick at least one trade.');
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('trades')
        .update({ can_take_large_jobs: largeJobs, accepts_callouts: callouts })
        .eq('id', trade.id);
      if (error) throw error;
      await saveChoices('trade_category_links', trade.id, application.categoryIds, chosen, trade.status === 'approved');
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right']} footer={<Button label={busy ? 'Saving…' : 'Save'} size="large" disabled={busy} onPress={save} />}>
      <View style={styles.group}>
        <ThemedText themeColor="textSecondary">
          Pick every trade you do. You’ll join a queue for each one, in each town you cover.
        </ThemedText>
        <View style={styles.chips}>
          {categories.map((category) => (
            <ChoiceChip
              key={category.id}
              label={category.name}
              selected={chosen.includes(category.id)}
              onPress={() => toggle(category.id)}
            />
          ))}
        </View>
      </View>

      <Card>
        <ToggleRow
          label="I can take on larger projects"
          hint="Jobs bigger than one person can do, like extensions or full rewires. If not, you’ll skip those and keep your place in the queue."
          value={largeJobs}
          onValueChange={setLargeJobs}
        />
      </Card>
      <Card>
        <ToggleRow
          label="I’ll take emergency call-outs"
          hint="Urgent jobs like burst pipes or lock-outs. You get 30 minutes to reply, at any time of day."
          value={callouts}
          onValueChange={setCallouts}
        />
      </Card>

      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
