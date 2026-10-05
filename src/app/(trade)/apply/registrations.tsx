import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { SCHEME_NAMES } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useApplication } from '@/lib/use-application';
import type { Enums } from '@/types/database';

type Scheme = Enums<'registration_scheme'>;

const SCHEME_HINTS: Record<Scheme, string> = {
  gas_safe: 'Gas work. Your licence number.',
  niceic: 'Electrical work. Your registration number.',
  napit: 'Electrical, heating or plumbing. Your membership number.',
  fensa: 'Windows and doors. Your registration number.',
  certass: 'Windows and doors. Your registration number.',
  oftec: 'Oil heating. Your registration number.',
  other: 'Any other trade body. Include its name and your number.',
};

export default function RegistrationsScreen() {
  const { application, reload } = useApplication();
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!application?.trade) return <LoadingScreen />;
  const trade = application.trade;
  const added = application.registrations.map((r) => r.scheme);

  async function add() {
    if (!scheme || !number.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('trade_registrations')
      .insert({ trade_id: trade.id, scheme, registration_number: number.trim() });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setScheme(null);
    setNumber('');
    reload();
  }

  return (
    <Screen edges={['left', 'right']}>
      <ThemedText themeColor="textSecondary">
        If your work needs a registration by law, like Gas Safe for gas work, add it here. We check each one on the
        official register. Skip this if none apply to you.
      </ThemedText>

      {application.registrations.length > 0 && (
        <View style={styles.list}>
          {application.registrations.map((registration) => (
            <Card key={registration.id} style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{SCHEME_NAMES[registration.scheme]}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {registration.registration_number}
                </ThemedText>
              </View>
              <Chip
                label={registration.status === 'approved' ? 'Checked' : registration.status === 'rejected' ? 'Not found' : 'Waiting'}
                tone={registration.status === 'approved' ? 'success' : registration.status === 'rejected' ? 'danger' : 'neutral'}
              />
            </Card>
          ))}
        </View>
      )}

      <Card>
        <ThemedText type="heading">Add a registration</ThemedText>
        <View style={styles.chips}>
          {(Object.keys(SCHEME_HINTS) as Scheme[])
            .filter((option) => !added.includes(option))
            .map((option) => (
              <ChoiceChip key={option} label={SCHEME_NAMES[option]} selected={scheme === option} onPress={() => setScheme(option)} />
            ))}
        </View>
        {scheme && (
          <>
            <TextField label="Number" hint={SCHEME_HINTS[scheme]} value={number} onChangeText={setNumber} autoCapitalize="characters" />
            <Button label={busy ? 'Adding…' : 'Add'} disabled={busy || !number.trim()} onPress={add} />
          </>
        )}
      </Card>

      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
