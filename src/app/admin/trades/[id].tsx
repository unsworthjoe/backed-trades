import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminHeader } from '@/components/admin-header';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, type ChipTone } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDate, todayInUk } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUSINESS_TYPE_NAMES, SCHEME_NAMES } from '@/lib/labels';
import { formatUkPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { signedUrl } from '@/lib/upload';
import type { Tables } from '@/types/database';

/** Each register's own site, where founders search for the number. */
const REGISTER_SITES: Record<string, string> = {
  gas_safe: 'https://www.gassaferegister.co.uk/',
  niceic: 'https://www.niceic.com/',
  napit: 'https://www.napit.org.uk/',
  fensa: 'https://www.fensa.org.uk/',
  certass: 'https://www.certass.co.uk/',
  oftec: 'https://www.oftec.org/',
};

async function loadApplication(id: string) {
  const [trade, categories, towns, documents, registrations, idCheck] = await Promise.all([
    supabase.from('trades').select('*, profiles(full_name, email, phone)').eq('id', id).single(),
    supabase.from('trade_category_links').select('trade_categories(name)').eq('trade_id', id),
    supabase.from('trade_towns').select('towns(name)').eq('trade_id', id),
    supabase
      .from('trade_documents')
      .select('*')
      .eq('trade_id', id)
      .eq('doc_type', 'public_liability_insurance')
      .order('created_at', { ascending: false }),
    supabase.from('trade_registrations').select('*').eq('trade_id', id).order('created_at'),
    supabase.from('id_checks').select('*').eq('trade_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const failed = [trade, categories, towns, documents, registrations, idCheck].find((r) => r.error);
  if (failed) throw failed.error;

  const idImages = await Promise.all(
    (idCheck.data?.image_paths ?? []).map((path) => signedUrl('id-checks', path).catch(() => null)),
  );

  return {
    trade: trade.data!,
    categories: (categories.data ?? []).map((c) => c.trade_categories?.name).filter(Boolean) as string[],
    towns: (towns.data ?? []).map((t) => t.towns?.name).filter(Boolean) as string[],
    documents: documents.data ?? [],
    registrations: registrations.data ?? [],
    idCheck: idCheck.data,
    idImages,
  };
}

type Loaded = Awaited<ReturnType<typeof loadApplication>>;

function reviewChip(status: string): { label: string; tone: ChipTone } {
  if (status === 'approved') return { label: 'Approved', tone: 'success' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' };
  return { label: 'To check', tone: 'warning' };
}

export default function AdminApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [docNote, setDocNote] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await loadApplication(id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /** Runs one admin action, shows any error, then reloads the page. */
  async function act(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await action();
    if (error) setError(friendlyError(error));
    await reload();
    setBusy(false);
  }

  if (!data) {
    return error ? (
      <Screen>
        <AdminHeader back />
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { trade } = data;
  const reviewer = { reviewed_by: session!.user.id, reviewed_at: new Date().toISOString() };
  const waiting = trade.status === 'applied' && !!trade.submitted_at;
  const today = todayInUk();

  async function openFile(bucket: 'trade-documents' | 'id-checks', path: string) {
    try {
      await WebBrowser.openBrowserAsync(await signedUrl(bucket, path));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function reviewDocument(doc: Tables<'trade_documents'>, status: 'approved' | 'rejected') {
    if (status === 'rejected' && !docNote.trim()) {
      setError('Add a note saying what’s wrong with the certificate. The trade will see it.');
      return;
    }
    act(() =>
      supabase
        .from('trade_documents')
        .update({ status, notes: status === 'rejected' ? docNote.trim() : null, ...reviewer })
        .eq('id', doc.id),
    ).then(() => setDocNote(''));
  }

  return (
    <Screen>
      <AdminHeader back />

      <View style={styles.title}>
        <ThemedText type="subtitle">{trade.business_name}</ThemedText>
        <Chip
          label={
            trade.status === 'approved'
              ? 'Approved'
              : trade.status === 'rejected'
                ? 'Sent back'
                : waiting
                  ? 'Waiting for review'
                  : 'Still filling in'
          }
          tone={trade.status === 'approved' ? 'success' : trade.status === 'rejected' ? 'danger' : waiting ? 'warning' : 'neutral'}
        />
      </View>

      {error && <Notice message={error} />}

      <Section title="Business">
        <Detail label="Applicant" value={trade.profiles?.full_name || '—'} />
        <Detail label="Email" value={trade.profiles?.email ?? '—'} />
        <Detail label="Phone" value={trade.contact_phone ? formatUkPhone(trade.contact_phone) : '—'} />
        <Detail label="Type" value={BUSINESS_TYPE_NAMES[trade.business_type]} />
        <Detail label="Trades" value={data.categories.join(', ') || '—'} />
        <Detail label="Towns" value={data.towns.join(', ') || '—'} />
        <Detail
          label="Takes on"
          value={
            [trade.can_take_large_jobs && 'Larger projects', trade.accepts_callouts && 'Emergency call-outs']
              .filter(Boolean)
              .join(', ') || 'Small jobs only, no call-outs'
          }
        />
        {trade.bio ? <Detail label="About" value={trade.bio} /> : null}
        {trade.submitted_at && <Detail label="Sent" value={formatDate(trade.submitted_at)} />}
      </Section>

      <Section title="Companies House">
        {trade.business_type === 'limited_company' ? (
          <>
            <Detail label="Company number" value={trade.company_number ?? '—'} />
            <ThemedText type="small" themeColor="textSecondary">
              Check the company is active and the name matches.
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Not a limited company. Optionally search the name to check it isn’t a company in disguise.
          </ThemedText>
        )}
        <View style={styles.buttons}>
          <Button
            label="Open Companies House"
            variant="outline"
            onPress={() =>
              WebBrowser.openBrowserAsync(
                trade.company_number
                  ? `https://find-and-update.company-information.service.gov.uk/company/${trade.company_number}`
                  : `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(trade.business_name)}`,
              )
            }
          />
          {trade.company_checked_at ? (
            <Chip label={`Checked ${formatDate(trade.company_checked_at)}`} tone="success" />
          ) : (
            <Button label="Mark as checked" disabled={busy} onPress={() => act(() => supabase.rpc('mark_company_checked', { p_trade_id: trade.id }))} />
          )}
        </View>
      </Section>

      <Section title="ID check">
        {!data.idCheck ? (
          <ThemedText themeColor="textSecondary">Not uploaded yet.</ThemedText>
        ) : data.idCheck.images_purged_at ? (
          <>
            <ThemedText themeColor="textSecondary">
              {data.idCheck.result === 'passed'
                ? `Passed. The photos were deleted on ${formatDate(data.idCheck.images_purged_at)}, 30 days after the decision.`
                : `The photos were deleted on ${formatDate(data.idCheck.images_purged_at)} before the ID was passed. The trade needs to upload new ones.`}
            </ThemedText>
            <View style={styles.buttons}>
              <Chip {...reviewChip(data.idCheck.result === 'passed' ? 'approved' : data.idCheck.result === 'failed' ? 'rejected' : 'pending')} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Does the selfie match the photo ID, and does the name on the ID match the applicant?
            </ThemedText>
            <View style={styles.images}>
              {data.idImages.map((url, index) =>
                url ? (
                  <View key={url} style={styles.imageBox}>
                    <ThemedText type="label" themeColor="textSecondary">
                      {index === 0 ? 'Photo ID' : 'Selfie'}
                    </ThemedText>
                    <Image source={{ uri: url }} style={styles.image} contentFit="contain" accessibilityLabel={index === 0 ? 'Photo ID' : 'Selfie'} />
                  </View>
                ) : null,
              )}
            </View>
            <View style={styles.buttons}>
              <Chip {...reviewChip(data.idCheck.result === 'passed' ? 'approved' : data.idCheck.result === 'failed' ? 'rejected' : 'pending')} />
              {data.idCheck.result !== 'passed' && (
                <Button
                  label="ID check passed"
                  disabled={busy}
                  onPress={() =>
                    act(() =>
                      supabase
                        .from('id_checks')
                        .update({ result: 'passed', checked_by: session!.user.id, checked_at: new Date().toISOString() })
                        .eq('id', data.idCheck!.id),
                    )
                  }
                />
              )}
              {data.idCheck.result === 'pending' && (
                <Button
                  label="Doesn’t match"
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    act(() =>
                      supabase
                        .from('id_checks')
                        .update({ result: 'failed', checked_by: session!.user.id, checked_at: new Date().toISOString() })
                        .eq('id', data.idCheck!.id),
                    )
                  }
                />
              )}
            </View>
          </>
        )}
      </Section>

      <Section title="Insurance">
        {data.documents.length === 0 && <ThemedText themeColor="textSecondary">Not uploaded yet.</ThemedText>}
        {data.documents.map((doc, index) => {
          const expired = !!doc.expires_on && doc.expires_on < today;
          return (
            <View key={doc.id} style={[styles.item, index > 0 && styles.older]}>
              <View style={styles.buttons}>
                <ThemedText type="smallBold">
                  {index === 0 ? 'Latest certificate' : 'Earlier certificate'} · expires {formatDate(doc.expires_on!)}
                </ThemedText>
                <Chip {...reviewChip(doc.status)} />
                {expired && <Chip label="Expired" tone="danger" />}
              </View>
              {doc.notes ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Note to trade: {doc.notes}
                </ThemedText>
              ) : null}
              <View style={styles.buttons}>
                <Button label="View certificate" variant="outline" onPress={() => openFile('trade-documents', doc.storage_path)} />
                {index === 0 && doc.status === 'pending' && (
                  <>
                    <Button label="Approve" disabled={busy || expired} onPress={() => reviewDocument(doc, 'approved')} />
                    <Button label="Reject" variant="outline" disabled={busy} onPress={() => reviewDocument(doc, 'rejected')} />
                  </>
                )}
              </View>
              {index === 0 && doc.status === 'pending' && (
                <TextField
                  label="Note if rejecting"
                  hint="Check the business name, that it’s public liability cover, and the end date matches what they typed."
                  value={docNote}
                  onChangeText={setDocNote}
                />
              )}
            </View>
          );
        })}
      </Section>

      <Section title="Registrations">
        {data.registrations.length === 0 && (
          <ThemedText themeColor="textSecondary">None added. Make sure none are needed for their trades (e.g. Gas Safe for gas work).</ThemedText>
        )}
        {data.registrations.map((registration) => (
          <View key={registration.id} style={styles.item}>
            <View style={styles.buttons}>
              <ThemedText type="smallBold">
                {SCHEME_NAMES[registration.scheme]} · {registration.registration_number}
              </ThemedText>
              <Chip {...reviewChip(registration.status)} />
            </View>
            <View style={styles.buttons}>
              {REGISTER_SITES[registration.scheme] && (
                <Button label="Open register" variant="outline" onPress={() => WebBrowser.openBrowserAsync(REGISTER_SITES[registration.scheme])} />
              )}
              {registration.status === 'pending' && (
                <>
                  <Button
                    label="Found on register"
                    disabled={busy}
                    onPress={() => act(() => supabase.from('trade_registrations').update({ status: 'approved', ...reviewer }).eq('id', registration.id))}
                  />
                  <Button
                    label="Not found"
                    variant="outline"
                    disabled={busy}
                    onPress={() => act(() => supabase.from('trade_registrations').update({ status: 'rejected', ...reviewer }).eq('id', registration.id))}
                  />
                </>
              )}
            </View>
          </View>
        ))}
      </Section>

      {waiting && (
        <Section title="Decision">
          <ThemedText type="small" themeColor="textSecondary">
            Approving needs a passed ID check and approved, in-date insurance. They join their queues in the order
            they’re approved.
          </ThemedText>
          <Button label={busy ? 'Working…' : 'Approve this trade'} size="large" disabled={busy} onPress={() => act(() => supabase.rpc('approve_trade', { p_trade_id: trade.id }))} />
          <TextField
            label="Reason, if sending back"
            hint="The trade sees this. Say what to fix, e.g. “Your insurance certificate is in a different business name.”"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
          />
          <Button
            label="Send back to the trade"
            variant="outline"
            disabled={busy || !rejectReason.trim()}
            onPress={() => act(() => supabase.rpc('reject_trade', { p_trade_id: trade.id, p_reason: rejectReason.trim() }))}
          />
        </Section>
      )}
      {trade.status === 'rejected' && trade.rejection_reason && (
        <Notice tone="warning" title="Sent back" message={trade.rejection_reason} />
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <ThemedText type="heading">{title}</ThemedText>
      {children}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.detailLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.detailValue} selectable>
        {value}
      </ThemedText>
    </View>
  );
}


const styles = StyleSheet.create({
  title: {
    gap: Spacing.two,
  },
  detail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  detailLabel: {
    width: 130,
  },
  detailValue: {
    flex: 1,
    minWidth: 180,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  item: {
    gap: Spacing.two,
  },
  older: {
    opacity: 0.7,
  },
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  imageBox: {
    flexGrow: 1,
    flexBasis: 240,
    gap: Spacing.one,
  },
  image: {
    width: '100%',
    height: 280,
    borderRadius: Radius.medium,
  },
});
