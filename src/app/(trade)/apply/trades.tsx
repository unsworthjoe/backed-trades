import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { ToggleRow } from '@/components/ui/toggle-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const [chosen, setChosen] = useState<number[]>(application.categoryIds);
  const [largeJobs, setLargeJobs] = useState(trade.can_take_large_jobs);
  const [callouts, setCallouts] = useState(trade.accepts_callouts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = categories.filter((category) => chosen.includes(category.id));
  const unpicked = categories.filter((category) => !chosen.includes(category.id));

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
        {unpicked.length > 0 && (
          <SelectField
            label={picked.length ? 'Add another trade' : 'Add a trade'}
            placeholder="Choose a trade"
            options={unpicked.map((category) => ({ value: category.id, label: category.name }))}
            value={null}
            onChange={(id) => setChosen((current) => [...current, id])}
          />
        )}
        {picked.length > 0 && (
          <View style={styles.picked}>
            <ThemedText type="smallBold">Your trades</ThemedText>
            {picked.map((category) => (
              <View key={category.id} style={[styles.pickedRow, { borderColor: theme.border }]}>
                <ThemedText>{category.name}</ThemedText>
                <Button
                  label="Remove"
                  variant="outline"
                  accessibilityLabel={`Remove ${category.name}`}
                  onPress={() => setChosen((current) => current.filter((c) => c !== category.id))}
                />
              </View>
            ))}
          </View>
        )}
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
  picked: {
    gap: Spacing.two,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
});
