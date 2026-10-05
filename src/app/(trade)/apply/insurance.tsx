import { router } from 'expo-router';
import { useState } from 'react';

import { FilePickerField } from '@/components/file-picker-field';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { formatDate, parseUkDate, todayInUk } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { pickDocument, pickPhoto } from '@/lib/pickers';
import { supabase } from '@/lib/supabase';
import { uploadPickedFile, type PickedFile } from '@/lib/upload';
import { useApplication } from '@/lib/use-application';

export default function InsuranceScreen() {
  const { application } = useApplication();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!application?.trade) return <LoadingScreen />;
  const trade = application.trade;
  const current = application.insurance;

  async function choose(pick: () => Promise<PickedFile | null>) {
    setError(null);
    try {
      const picked = await pick();
      if (picked) setFile(picked);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function save() {
    const expiresOn = parseUkDate(expiry);
    if (!file) return setError('Add a photo or file of your certificate.');
    if (!expiresOn) return setError('Enter the expiry date as day/month/year, like 31/03/2027.');
    if (expiresOn <= todayInUk()) return setError('That certificate has expired. Please upload your current one.');

    setBusy(true);
    setError(null);
    try {
      const path = await uploadPickedFile('trade-documents', trade.id, 'insurance', file);
      const { error } = await supabase
        .from('trade_documents')
        .insert({ trade_id: trade.id, doc_type: 'public_liability_insurance', storage_path: path, expires_on: expiresOn });
      if (error) throw error;
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Screen
      edges={['left', 'right']}
      footer={<Button label={busy ? 'Uploading…' : 'Save'} size="large" disabled={busy || !file} onPress={save} />}>
      <ThemedText themeColor="textSecondary">
        Every trade on Backed. needs public liability insurance. Upload the certificate or schedule showing your
        business name, the cover amount and the end date.
      </ThemedText>

      {current && (
        <Notice
          tone={current.status === 'approved' ? 'success' : current.status === 'rejected' ? 'warning' : 'info'}
          title={
            current.status === 'approved'
              ? 'Approved'
              : current.status === 'rejected'
                ? 'We couldn’t accept your last certificate'
                : 'Uploaded, waiting for review'
          }
          message={
            current.status === 'rejected' && current.notes
              ? current.notes
              : `Expires ${formatDate(current.expires_on!)}. Upload a new one below if it has changed.`
          }
        />
      )}

      <Card>
        <FilePickerField
          label="Your certificate"
          hint="A clear photo, or the PDF from your insurer."
          file={file}
          onTakePhoto={() => choose(() => pickPhoto('camera'))}
          chooseLabel="Choose a file"
          onChoose={() => choose(pickDocument)}
        />
        <TextField
          label="Expiry date"
          hint="Day/month/year, e.g. 31/03/2027. We’ll remind you before it runs out."
          value={expiry}
          onChangeText={setExpiry}
          keyboardType="numbers-and-punctuation"
          placeholder="DD/MM/YYYY"
          maxLength={10}
        />
      </Card>

      {error && <Notice message={error} />}
    </Screen>
  );
}
