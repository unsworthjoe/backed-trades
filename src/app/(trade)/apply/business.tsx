import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { BUSINESS_TYPE_NAMES } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { useApplication } from '@/lib/use-application';
import type { Enums, Tables } from '@/types/database';

type BusinessType = Enums<'business_type'>;

/** Accepts 07..., 01..., 02... or +44 numbers; returns them without spaces, or null. */
function cleanUkPhone(text: string): string | null {
  const digits = text.replace(/[\s()-]/g, '').replace(/^\+44/, '0');
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}

export default function BusinessScreen() {
  const { session } = useAuth();
  const { application } = useApplication();
  if (!application || !session) return <LoadingScreen />;
  return <BusinessForm userId={session.user.id} trade={application.trade} />;
}

function BusinessForm({ userId, trade }: { userId: string; trade: Tables<'trades'> | null }) {
  const [name, setName] = useState(trade?.business_name ?? '');
  const [type, setType] = useState<BusinessType>(trade?.business_type ?? 'sole_trader');
  const [companyNumber, setCompanyNumber] = useState(trade?.company_number ?? '');
  const [phone, setPhone] = useState(trade?.contact_phone ?? '');
  const [bio, setBio] = useState(trade?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const cleanPhone = cleanUkPhone(phone);
    const cleanCompanyNumber = companyNumber.replace(/\s/g, '').toUpperCase();
    if (!name.trim()) return setError('Please enter your business name.');
    if (!cleanPhone) return setError('Please enter a UK phone number, like 07700 900123.');
    if (type === 'limited_company' && !/^[A-Z0-9]{8}$/.test(cleanCompanyNumber)) {
      return setError('Company numbers are 8 characters, like 01234567 or SC123456.');
    }

    const details = {
      business_name: name.trim(),
      business_type: type,
      company_number: type === 'limited_company' ? cleanCompanyNumber : null,
      contact_phone: cleanPhone,
      bio: bio.trim(),
    };
    setBusy(true);
    setError(null);
    const { error } = trade
      ? await supabase.from('trades').update(details).eq('id', userId)
      : await supabase.from('trades').insert({ id: userId, ...details });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else router.back();
  }

  return (
    <Screen edges={['left', 'right']} footer={<Button label={busy ? 'Saving…' : 'Save'} size="large" disabled={busy} onPress={save} />}>
      <TextField label="Business name" hint="As customers will see it." value={name} onChangeText={setName} autoComplete="organization" />

      <View style={styles.group}>
        <ThemedText type="smallBold">Type of business</ThemedText>
        <View style={styles.chips}>
          {(Object.keys(BUSINESS_TYPE_NAMES) as BusinessType[]).map((option) => (
            <ChoiceChip key={option} label={BUSINESS_TYPE_NAMES[option]} selected={type === option} onPress={() => setType(option)} />
          ))}
        </View>
      </View>

      {type === 'limited_company' && (
        <TextField
          label="Company number"
          hint="From Companies House. We check it’s active."
          value={companyNumber}
          onChangeText={setCompanyNumber}
          autoCapitalize="characters"
          maxLength={10}
        />
      )}

      <TextField
        label="Contact phone number"
        hint="Given to customers when you accept a job."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <TextField
        label="About your business"
        hint="Optional. A few lines for customers: experience, what you’re known for."
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={600}
      />

      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
