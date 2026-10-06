import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { ordinal } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

async function loadQueues() {
  const [places, settings] = await Promise.all([
    supabase.rpc('my_queue_places'),
    supabase.from('app_settings').select('offers_per_wave, decline_limit').single(),
  ]);
  const failed = [places, settings].find((r) => r.error);
  if (failed) throw failed.error;
  return { places: places.data ?? [], settings: settings.data! };
}

type Loaded = Awaited<ReturnType<typeof loadQueues>>;
type Place = Loaded['places'][number];

export default function QueuesScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await loadQueues());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) {
    return error ? (
      <Screen edges={['left', 'right']}>
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  async function tuneBackIn(queueId: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('tune_back_in', { p_queue_id: queueId });
    if (error) setError(friendlyError(error));
    await reload();
    setBusy(false);
  }

  return (
    <Screen edges={['left', 'right']} onRefresh={reload}>
      <ThemedText themeColor="textSecondary">
        There’s a queue for each trade in each town. Each new job goes to the front {data.settings.offers_per_wave} in
        the queue. Win a job and you move to the back of that queue. Your other queues don’t change.
      </ThemedText>

      {error && <Notice message={error} />}

      {data.places.length === 0 && (
        <Card>
          <ThemedText themeColor="textSecondary">
            You’re not in any queues. Check the trades and towns you picked on your application.
          </ThemedText>
        </Card>
      )}

      {data.places.map((place) => (
        <QueueCard
          key={place.queue_id}
          place={place}
          frontCount={data.settings.offers_per_wave}
          declineLimit={data.settings.decline_limit}
          busy={busy}
          onTuneBackIn={() => tuneBackIn(place.queue_id)}
        />
      ))}
    </Screen>
  );
}

function QueueCard({
  place,
  frontCount,
  declineLimit,
  busy,
  onTuneBackIn,
}: {
  place: Place;
  frontCount: number;
  declineLimit: number;
  busy: boolean;
  onTuneBackIn: () => void;
}) {
  const waiting = place.status === 'waiting';
  const atFront = !waiting && place.place <= frontCount;

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {place.category_name} · {place.town_name}
        </ThemedText>
        {place.tuned_out ? (
          <Chip label="Switched off" tone="neutral" />
        ) : waiting ? (
          <Chip label="Waiting list" tone="info" />
        ) : atFront ? (
          <Chip label="At the front" tone="success" />
        ) : null}
      </View>

      <ThemedText type="subtitle">
        {waiting ? `${ordinal(place.place)} on the waiting list` : `${ordinal(place.place)} of ${place.list_size}`}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {waiting
          ? `This queue is full (${place.cap} members). You’ll join it when a place opens up.`
          : atFront
            ? 'You’ll be offered the next job that comes in.'
            : `${place.place - 1} trades ahead of you. You move up each time one of them wins a job.`}
        {` ${place.jobs_last_30_days} job${place.jobs_last_30_days === 1 ? '' : 's'} in the last 30 days.`}
      </ThemedText>

      {!waiting && place.consecutive_declines > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {`You’ve declined ${place.consecutive_declines} in a row here. ${declineLimit} in a row moves you to the back; accepting one resets it.`}
        </ThemedText>
      )}

      {place.tuned_out && (
        <>
          <Notice
            tone="info"
            message="You said “not my kind of work” to several of these jobs, so we’ve stopped sending them. You’ve kept your place."
          />
          <Button label="Send me these jobs again" variant="outline" disabled={busy} onPress={onTuneBackIn} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
