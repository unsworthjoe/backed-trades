import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Fonts, MaxContentWidth, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTime } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Message = Tables<'messages'>;

type MessageThreadProps = {
  matchId: string;
  /** The signed-in user. */
  myId: string;
  /** Who the messages are with, e.g. "Cathy" or "Reliable Plumbing". */
  otherName: string;
  /** False once the match has ended: the history stays readable. */
  canSend: boolean;
  /** Shown above the messages, e.g. the website header. */
  header?: React.ReactNode;
};

/** A live conversation between a customer and their trade. New messages arrive as they're sent. */
export function MessageThread({ matchId, myId, otherName, canSend, header }: MessageThreadProps) {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const markRead = useCallback(async () => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .neq('sender_id', myId)
      .is('read_at', null);
  }, [matchId, myId]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at');
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setMessages(data);
    markRead();
  }, [matchId, markRead]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // New messages from either side, as they're sent.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const message = payload.new as Message;
          setMessages((current) =>
            current && !current.some((m) => m.id === message.id) ? [...current, message] : current,
          );
          if (message.sender_id !== myId) markRead();
        },
      )
      // Live updates take a moment to start; reload then, in case a message arrived in between.
      .on('system', {}, (event: { extension?: string; status?: string }) => {
        if (event.extension === 'postgres_changes' && event.status === 'ok') load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, myId, markRead, load]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase.from('messages').insert({ match_id: matchId, body }).select().single();
    setSending(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setDraft('');
    setMessages((current) => (current && !current.some((m) => m.id === data.id) ? [...current, data] : current));
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {header}
            {messages === null ? (
              error ? <Notice message={error} /> : <ActivityIndicator color={theme.primary} />
            ) : messages.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No messages yet. Say hello to {otherName}.
              </ThemedText>
            ) : (
              messages.map((message, index) => {
                const mine = message.sender_id === myId;
                const newDay =
                  index === 0 ||
                  formatDate(messages[index - 1].created_at) !== formatDate(message.created_at);
                return (
                  <View key={message.id}>
                    {newDay && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.day}>
                        {formatDate(message.created_at)}
                      </ThemedText>
                    )}
                    <View
                      accessible
                      accessibilityLabel={`${mine ? 'You' : otherName} at ${formatTime(message.created_at)}: ${message.body}`}
                      style={[
                        styles.bubble,
                        mine
                          ? [styles.mine, { backgroundColor: theme.primary }]
                          : [styles.theirs, { backgroundColor: theme.surface }],
                      ]}>
                      <ThemedText style={{ color: mine ? theme.onPrimary : theme.text }}>{message.body}</ThemedText>
                      <ThemedText
                        type="small"
                        style={[styles.time, { color: mine ? theme.onPrimary : theme.textSecondary }]}>
                        {formatTime(message.created_at)}
                        {mine && message.read_at ? ' · Read' : ''}
                      </ThemedText>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <View style={[styles.composerBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.composer}>
            {error && messages !== null && <Notice message={error} />}
            {canSend ? (
              <View style={styles.row}>
                <TextInput
                  accessibilityLabel={`Message ${otherName}`}
                  placeholder={`Message ${otherName}`}
                  placeholderTextColor={theme.textSecondary}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={4000}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
                <Button label={sending ? '…' : 'Send'} disabled={sending || !draft.trim()} onPress={send} />
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                This job has ended, so you can’t send new messages.
              </ThemedText>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  day: {
    textAlign: 'center',
    marginVertical: Spacing.two,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  mine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: Radius.small,
  },
  theirs: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Radius.small,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
  },
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: TouchTarget,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
});
