import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Detail, Section } from '@/components/admin-detail';
import { AdminHeader } from '@/components/admin-header';
import { personName, REPORT_LIST_SELECT, REPORT_STATUS, ReportList, type ReportRow } from '@/components/admin-report-list';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTime } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { JOB_STATUS } from '@/lib/labels';
import { formatUkPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

type Person = { id: string; full_name: string; role: 'customer' | 'trade' | 'admin'; email: string | null; phone: string | null };
const PERSON = 'id, full_name, role, email, phone';

async function loadReport(id: string) {
  const { data: report, error } = await supabase
    .from('reports')
    .select(
      `*, reporter:profiles!reports_reporter_id_fkey(${PERSON}), about:profiles!reports_about_user_id_fkey(${PERSON}),
       jobs(id, title, description, status, created_at, towns(name), trade_categories(name))`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const reporter = report.reporter as Person | null;
  const about = report.about as Person | null;
  const people = [reporter, about].filter((p): p is Person => !!p);
  const tradeIds = people.filter((p) => p.role === 'trade').map((p) => p.id);

  const [trades, otherReports, match, resolver] = await Promise.all([
    // Trades give a contact number on their application; their profile phone may be empty.
    tradeIds.length
      ? supabase.from('trades').select('id, business_name, contact_phone, status').in('id', tradeIds)
      : Promise.resolve({ data: [], error: null }),
    about
      ? supabase
          .from('reports')
          .select(REPORT_LIST_SELECT)
          .eq('about_user_id', about.id)
          .neq('id', id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    report.job_id
      ? supabase
          .from('job_matches')
          .select('id, trade_id, matched_at, done_at, signed_off_at, ended_at')
          .eq('job_id', report.job_id)
          .order('matched_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report.resolved_by
      ? supabase.from('profiles').select('full_name').eq('id', report.resolved_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const failed = [trades, otherReports, match, resolver].find((r) => r.error);
  if (failed) throw failed.error;

  const messages = match.data
    ? await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('match_id', match.data.id)
        .order('created_at')
        .limit(200)
    : { data: [], error: null };
  if (messages.error) throw messages.error;

  return {
    report,
    reporter,
    about,
    resolverName: resolver.data?.full_name ?? null,
    trades: new Map((trades.data ?? []).map((t) => [t.id, t])),
    otherReports: (otherReports.data ?? []) as unknown as ReportRow[],
    match: match.data,
    messages: messages.data ?? [],
  };
}

type Loaded = Awaited<ReturnType<typeof loadReport>>;

export default function AdminReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await loadReport(id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function setStatus(status: ReportRow['status']) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('resolve_report', {
      p_report_id: id,
      p_status: status,
      p_note: status === 'open' ? undefined : note.trim(),
    });
    if (error) setError(friendlyError(error));
    else setNote('');
    await reload();
    setBusy(false);
  }

  if (!data) {
    return error ? (
      <Screen>
        <AdminHeader />
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { report, reporter, about, trades, otherReports, match, messages, resolverName } = data;
  const job = report.jobs;
  const nameOf = (userId: string) =>
    userId === reporter?.id ? personName(reporter) : userId === about?.id ? personName(about) : 'Someone else';

  return (
    <Screen>
      <AdminHeader />

      <View style={styles.title}>
        <ThemedText type="subtitle">{report.reason}</ThemedText>
        <Chip {...REPORT_STATUS[report.status]} />
      </View>
      {error && <Notice message={error} />}

      <Section title="What they said">
        <ThemedText selectable>{report.details || 'No details given.'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sent {formatDate(report.created_at)} at {formatTime(report.created_at)}
        </ThemedText>
      </Section>

      <Section title={`Sent by ${reporter ? (reporter.role === 'trade' ? 'the trade' : 'the customer') : ''}`.trim()}>
        <PersonDetails person={reporter} trades={trades} />
      </Section>

      <Section title="About">
        <PersonDetails person={about} trades={trades} />
      </Section>

      {job && (
        <Section title="The job">
          <Detail label="Job" value={job.title} />
          <Detail label="Trade needed" value={job.trade_categories?.name ?? '—'} />
          <Detail label="Town" value={job.towns?.name ?? '—'} />
          <Detail label="Status" value={JOB_STATUS[job.status]?.label ?? job.status} />
          <Detail label="Posted" value={formatDate(job.created_at)} />
          {match && <Detail label="Matched" value={formatDate(match.matched_at)} />}
          {match?.done_at && <Detail label="Marked done" value={formatDate(match.done_at)} />}
          {match?.signed_off_at && <Detail label="Signed off" value={formatDate(match.signed_off_at)} />}
          {job.description ? (
            <ThemedText type="small" themeColor="textSecondary" selectable>
              {job.description}
            </ThemedText>
          ) : null}
        </Section>
      )}

      {match && (
        <Section title={`Messages (${messages.length})`}>
          {messages.length === 0 ? (
            <ThemedText themeColor="textSecondary">They haven’t messaged each other on Backed.</ThemedText>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={[styles.message, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {nameOf(message.sender_id)} · {formatDate(message.created_at)} {formatTime(message.created_at)}
                </ThemedText>
                <ThemedText selectable>{message.body}</ThemedText>
              </View>
            ))
          )}
        </Section>
      )}

      {otherReports.length > 0 && (
        <Section title={`Other reports about ${about?.full_name || 'them'} (${otherReports.length})`}>
          <ReportList reports={otherReports} />
        </Section>
      )}

      <Section title="Outcome">
        {report.status === 'open' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Get in touch with them by phone or email, then record what happened. Neither person sees this note.
            </ThemedText>
            <TextField
              label="Note"
              hint="What you did, or why no action was needed."
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={styles.buttons}>
              <Button label={busy ? 'Saving…' : 'Resolve'} disabled={busy || !note.trim()} onPress={() => setStatus('resolved')} />
              <Button label="Dismiss" variant="outline" disabled={busy || !note.trim()} onPress={() => setStatus('dismissed')} />
            </View>
          </>
        ) : (
          <>
            <ThemedText selectable>{report.resolution_note}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {REPORT_STATUS[report.status].label}
              {resolverName ? ` by ${resolverName}` : ''}
              {report.resolved_at ? ` on ${formatDate(report.resolved_at)}` : ''}
            </ThemedText>
            <Button label="Reopen" variant="outline" style={styles.inline} disabled={busy} onPress={() => setStatus('open')} />
          </>
        )}
      </Section>
    </Screen>
  );
}

function PersonDetails({ person, trades }: { person: Person | null; trades: Loaded['trades'] }) {
  if (!person) return <ThemedText themeColor="textSecondary">This account has been deleted.</ThemedText>;
  const trade = trades.get(person.id);
  const phone = trade?.contact_phone ?? person.phone;
  return (
    <>
      <Detail label="Name" value={person.full_name || '—'} />
      {trade && <Detail label="Business" value={trade.business_name} />}
      <Detail label="Account" value={trade ? `Trade (${trade.status})` : person.role === 'customer' ? 'Customer' : 'Admin'} />
      <Detail label="Phone" value={phone ? formatUkPhone(phone) : '—'} />
      <Detail label="Email" value={person.email ?? '—'} />
      {trade && (
        <Button
          label="Open their trade page"
          variant="outline"
          style={styles.inline}
          onPress={() => router.push({ pathname: '/admin/trades/[id]', params: { id: trade.id } })}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: Spacing.two,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  message: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
