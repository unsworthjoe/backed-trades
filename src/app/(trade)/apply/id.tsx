import { router } from 'expo-router';
import { useState } from 'react';

import { FilePickerField } from '@/components/file-picker-field';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { friendlyError } from '@/lib/errors';
import { pickPhoto } from '@/lib/pickers';
import { supabase } from '@/lib/supabase';
import { uploadPickedFile, type PickedFile } from '@/lib/upload';
import { useApplication } from '@/lib/use-application';

/**
 * Manual ID check (for now): a photo of the trade's ID and a selfie, which a founder compares.
 * The images are deleted 30 days after approval; only the result is kept.
 */
export default function IdCheckScreen() {
  const { application } = useApplication();
  const [document, setDocument] = useState<PickedFile | null>(null);
  const [selfie, setSelfie] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!application?.trade) return <LoadingScreen />;
  const trade = application.trade;
  const current = application.idCheck;

  async function choose(pick: () => Promise<PickedFile | null>, set: (file: PickedFile) => void) {
    setError(null);
    try {
      const picked = await pick();
      if (picked) set(picked);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function save() {
    if (!document || !selfie) return;
    setBusy(true);
    setError(null);
    try {
      const paths = await Promise.all([
        uploadPickedFile('id-checks', trade.id, 'id', document),
        uploadPickedFile('id-checks', trade.id, 'selfie', selfie),
      ]);
      const { error } = await supabase.from('id_checks').insert({ trade_id: trade.id, image_paths: paths });
      if (error) throw error;
      router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  if (current?.result === 'passed') {
    return (
      <Screen edges={['left', 'right']}>
        <Notice tone="success" title="ID check passed" message="Thanks, there’s nothing more to do here." />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        <Button label={busy ? 'Uploading…' : 'Send for checking'} size="large" disabled={busy || !document || !selfie} onPress={save} />
      }>
      <ThemedText themeColor="textSecondary">
        So customers know who’s turning up, a founder checks your photo ID against a selfie. Your photos are kept
        private and deleted 30 days after we’ve made a decision on your application.
      </ThemedText>

      {current?.result === 'failed' && (
        <Notice tone="warning" title="Please try again" message="We couldn’t match your photos. Make sure both are clear, well lit and not cropped." />
      )}
      {current?.result === 'pending' && current.images_purged_at && (
        <Notice tone="info" title="Please upload your photos again" message="Your earlier photos were deleted after 30 days, so a founder can’t check them now." />
      )}
      {current?.result === 'pending' && !current.images_purged_at && (
        <Notice tone="info" title="Uploaded, waiting for review" message="You only need to upload again if a founder asks you to." />
      )}

      <Card>
        <FilePickerField
          label="Photo ID"
          hint="Passport or UK driving licence. All four corners in shot, no glare."
          file={document}
          onTakePhoto={() => choose(() => pickPhoto('camera'), setDocument)}
          chooseLabel="Choose a photo"
          onChoose={() => choose(() => pickPhoto('library'), setDocument)}
        />
      </Card>
      <Card>
        <FilePickerField
          label="Selfie"
          hint="Your face, straight on, in good light. No hat or sunglasses."
          file={selfie}
          onTakePhoto={() => choose(() => pickPhoto('camera', { selfie: true }), setSelfie)}
          chooseLabel="Choose a photo"
          onChoose={() => choose(() => pickPhoto('library'), setSelfie)}
        />
      </Card>

      {error && <Notice message={error} />}
    </Screen>
  );
}
