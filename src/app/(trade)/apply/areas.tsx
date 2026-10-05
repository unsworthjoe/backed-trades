import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { saveChoices } from '@/lib/save-choices';
import { useApplication, useReferenceData, type Application } from '@/lib/use-application';
import type { Tables } from '@/types/database';

export default function AreasScreen() {
  const { application } = useApplication();
  const reference = useReferenceData();
  if (!reference || !application?.trade) return <LoadingScreen />;
  return <AreasForm application={application} trade={application.trade} towns={reference.towns} />;
}

function AreasForm({
  application,
  trade,
  towns,
}: {
  application: Application;
  trade: Tables<'trades'>;
  towns: Tables<'towns'>[];
}) {
  const [chosen, setChosen] = useState<number[]>(application.townIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setChosen((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  async function save() {
    if (!chosen.length) return setError('Pick at least one town.');
    setBusy(true);
    setError(null);
    try {
      await saveChoices('trade_towns', trade.id, application.townIds, chosen, trade.status === 'approved');
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right']} footer={<Button label={busy ? 'Saving…' : 'Save'} size="large" disabled={busy} onPress={save} />}>
      <ThemedText themeColor="textSecondary">
        Pick the towns you’ll travel to. You can be in several. When a town has no one free, jobs are offered to
        neighbouring towns too.
      </ThemedText>
      <View style={styles.chips}>
        {towns.map((town) => (
          <ChoiceChip key={town.id} label={town.name} selected={chosen.includes(town.id)} onPress={() => toggle(town.id)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Backed. is starting in these three towns. More areas are coming.
      </ThemedText>
      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
