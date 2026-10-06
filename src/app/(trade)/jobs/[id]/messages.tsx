import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { MessageThread } from '@/components/message-thread';
import { LoadingScreen } from '@/components/screen';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** The trade's messages with the customer on one job (id = match id). */
export default function TradeMessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [match, setMatch] = useState<{ name: string; live: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('job_matches').select('ended_at').eq('id', id).single(),
      supabase.rpc('get_match_contact', { p_match_id: id }),
    ]).then(([m, contact]) => {
      setMatch({
        name: contact.data?.[0]?.customer_name.split(' ')[0] || 'the customer',
        live: !!m.data && !m.data.ended_at,
      });
    });
  }, [id]);

  if (!match || !session) return <LoadingScreen />;

  return (
    <>
      <Stack.Screen options={{ title: match.name === 'the customer' ? 'Messages' : match.name }} />
      <MessageThread matchId={id} myId={session.user.id} otherName={match.name} canSend={match.live} />
    </>
  );
}
