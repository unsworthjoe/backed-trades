import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Detail } from '@/components/admin-detail';
import { AdminHeader } from '@/components/admin-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { ALERT_NAMES, JOB_STATUS } from '@/lib/labels';
import { formatUkPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

type Filter = 'open' | 'resolved';

const SELECT =
  'id, kind, details, created_at, resolved_at, job_id, user_id, profiles(full_name, role, email, phone), jobs(title, status, towns(name))';

/** Alerts that clear themselves when the founders act on the linked page. */
const CLEARED_ELSEWHERE = new Set(['report_filed', 'application_submitted']);

async function loadAlerts(filter: Filter) {
  let query = supabase.from('admin_alerts').select(SELECT);
  query =
    filter === 'open'
      ? query.is('resolved_at', null).order('created_at')
      : query.not('resolved_at', 'is', null).order('resolved_at', { ascending: false });
  const { data, error } = await query.limit(100);
  if (error) throw error;

  // Trades give a contact number on their application; their profile phone may be empty.
  const tradeIds = data.filter((a) => a.profiles?.role === 'trade').map((a) => a.user_id!);
  const trades = tradeIds.length
    ? await supabase.from('trades').select('id, business_name, contact_phone').in('id', tradeIds)
    : { data: [], error: null };
  if (trades.error) throw trades.error;
  const byId = new Map((trades.data ?? []).map((t) => [t.id, t]));

  return data.map((alert) => ({ ...alert, trade: alert.user_id ? (byId.get(alert.user_id) ?? null) : null }));
}

type Alert = Awaited<ReturnType<typeof loadAlerts>>[number];

/** What happened, in a sentence, from the alert's details. */
function explain(alert: Alert): string {
  const details = (alert.details ?? {}) as Record<string, unknown>;
  switch (alert.kind) {
    case 'job_unmatched':
      return 'No trade has accepted this job in the first 24 hours. The customer may need a call, or the area more trades.';
    case 'no_contact':
      return 'The trade accepted but hasn’t marked the customer as contacted within 24 hours. The customer was asked too.';
    case 'low_customer_rating':
      return `This customer’s average from trades is ${details.average} from ${details.ratings} ratings.`;
    case 'trade_paused':
      return 'They missed 3 offers in a row, so their offers were paused. They can switch them back on themselves.';
    case 'insurance_expiring':
      return typeof details.expires_on === 'string'
        ? `Their public liability insurance expires on ${formatDate(details.expires_on)}. They’ve been reminded to upload the new certificate.`
        : 'Their public liability insurance expires soon.';
    case 'application_submitted':
      return 'Waiting for review. This clears when you approve it or send it back.';
    case 'report_filed':
      return `${typeof details.reason === 'string' ? `“${details.reason}”. ` : ''}This clears when you resolve or dismiss the report.`;
    default:
      return '';
  }
}

/** Things the founders need to look at: unmatched jobs, paused trades, expiring insurance and so on. */
export default function AdminAlertsScreen() {
  const [filter, setFilter] = useState<Filter>('open');
  const [rows, setRows] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await loadAlerts(filter));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setRows(null);
      setError(null);
      reload();
    }, [reload]),
  );

  return (
    <Screen>
      <AdminHeader />
      <ThemedText type="subtitle">Alerts</ThemedText>
      <ThemedText themeColor="textSecondary">Every founder is emailed when one of these comes in.</ThemedText>
      <View style={styles.row}>
        <ChoiceChip label="Open" selected={filter === 'open'} onPress={() => setFilter('open')} />
        <ChoiceChip label="Dealt with" selected={filter === 'resolved'} onPress={() => setFilter('resolved')} />
      </View>

      {error && <Notice message={error} />}
      {rows && rows.length === 0 && (
        <ThemedText themeColor="textSecondary">{filter === 'open' ? 'Nothing needs looking at. Nice work.' : 'Nothing yet.'}</ThemedText>
      )}
      {rows?.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onChanged={reload} />
      ))}
    </Screen>
  );
}

function AlertCard({ alert, onChanged }: { alert: Alert; onChanged: () => Promise<void> }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const details = (alert.details ?? {}) as Record<string, unknown>;
  const person = alert.profiles;
  const phone = alert.trade?.contact_phone ?? person?.phone;

  async function resolve(done: boolean) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('admin_alerts')
      .update(done ? { resolved_at: new Date().toISOString(), resolved_by: session!.user.id } : { resolved_at: null, resolved_by: null })
      .eq('id', alert.id);
    setBusy(false);
    if (error) setError(friendlyError(error));
    else await onChanged();
  }

  return (
    <Card>
      <ThemedText type="heading">{ALERT_NAMES[alert.kind] ?? alert.kind}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(alert.created_at)} at {formatTime(alert.created_at)}
        {alert.resolved_at ? ` · dealt with ${formatDate(alert.resolved_at)}` : ''}
      </ThemedText>
      <ThemedText>{explain(alert)}</ThemedText>

      {person && (
        <>
          <Detail
            label={person.role === 'trade' ? 'Trade' : person.role === 'customer' ? 'Customer' : 'Person'}
            value={alert.trade ? `${alert.trade.business_name} (${person.full_name || 'no name'})` : person.full_name || 'No name'}
          />
          <Detail label="Phone" value={phone ? formatUkPhone(phone) : '—'} />
          {person.email && <Detail label="Email" value={person.email} />}
        </>
      )}
      {alert.jobs && (
        <Detail
          label="Job"
          value={`${alert.jobs.title}${alert.jobs.towns ? ` in ${alert.jobs.towns.name}` : ''} · ${JOB_STATUS[alert.jobs.status]?.label ?? alert.jobs.status}`}
        />
      )}

      <View style={styles.row}>
        {alert.kind === 'report_filed' && typeof details.report_id === 'string' ? (
          <Button label="Open report" onPress={() => router.push({ pathname: '/admin/reports/[id]', params: { id: details.report_id as string } })} />
        ) : alert.trade ? (
          <Button
            label={alert.kind === 'application_submitted' ? 'Open application' : 'Open trade page'}
            variant={alert.kind === 'application_submitted' ? 'primary' : 'outline'}
            onPress={() => router.push({ pathname: '/admin/trades/[id]', params: { id: alert.trade!.id } })}
          />
        ) : null}
        {!CLEARED_ELSEWHERE.has(alert.kind) &&
          (alert.resolved_at ? (
            <Button label="Reopen" variant="outline" disabled={busy} onPress={() => resolve(false)} />
          ) : (
            <Button label={busy ? 'Saving…' : 'Mark as dealt with'} disabled={busy} onPress={() => resolve(true)} />
          ))}
      </View>
      {error && <Notice message={error} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
