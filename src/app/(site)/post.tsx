import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PhoneSignIn } from '@/components/phone-sign-in';
import { LoadingScreen, Screen } from '@/components/screen';
import { AgreeToTerms, SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ToggleRow } from '@/components/ui/toggle-row';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, TIMING_NAMES } from '@/lib/labels';
import { pickPhoto } from '@/lib/pickers';
import { checkPostcode, type PostcodeCheck } from '@/lib/postcodes';
import { supabase } from '@/lib/supabase';
import { uploadPickedFile, type PickedFile } from '@/lib/upload';
import { useReferenceData } from '@/lib/use-application';
import type { Enums, Tables } from '@/types/database';

const MAX_PHOTOS = 5;

export default function PostJobScreen() {
  const reference = useReferenceData();
  if (!reference) return <LoadingScreen />;
  return <PostJobForm categories={reference.categories} />;
}

function PostJobForm({ categories }: { categories: Tables<'trade_categories'>[] }) {
  const { session, profile } = useAuth();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [postcode, setPostcode] = useState('');
  const [postcodeCheck, setPostcodeCheck] = useState<PostcodeCheck | null>(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [timing, setTiming] = useState<Enums<'job_timing'>>('flexible');
  const [budget, setBudget] = useState<Enums<'job_budget'>>('not_sure');
  const [large, setLarge] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [stage, setStage] = useState<'details' | 'sign-in' | 'posting'>('details');
  const [error, setError] = useState<string | null>(null);

  async function confirmPostcode() {
    if (!postcode.trim()) return setPostcodeCheck(null);
    const result = await checkPostcode(postcode);
    setPostcodeCheck(result);
    if (result.ok) setPostcode(result.postcode);
    return result;
  }

  async function addPhoto() {
    setError(null);
    try {
      const picked = await pickPhoto('library');
      if (picked) setPhotos((current) => [...current, picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  /** Checks the form, then either posts it or asks the customer to confirm their number first. */
  async function next() {
    setError(null);
    if (!categoryId) return setError('Choose the type of trade you need.');
    if (!title.trim()) return setError('Add a short title, like “Leaking kitchen tap”.');
    if (!name.trim()) return setError('Add your name, so the trade knows who to ask for.');
    const check = postcodeCheck?.ok ? postcodeCheck : await confirmPostcode();
    if (!check?.ok) return setError('Check your postcode. We need a valid postcode in an area we cover.');
    if (session) await post();
    else setStage('sign-in');
  }

  async function post() {
    if (!postcodeCheck?.ok && !(await confirmPostcode())?.ok) return;
    setStage('posting');
    setError(null);
    try {
      const { data: jobId, error } = await supabase.rpc('post_job', {
        p_category_id: categoryId!,
        p_postcode: postcode,
        p_title: title.trim(),
        p_description: description.trim(),
        p_address_line: address.trim(),
        p_size: large ? 'large' : 'small',
        p_is_callout: emergency,
        p_timing: emergency ? 'asap' : timing,
        p_budget: budget,
      });
      if (error) throw error;

      const userId = (await supabase.auth.getUser()).data.user!.id;
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', userId);

      // Photos go up after the job exists: storage only accepts files into the customer's own job.
      for (const [index, photo] of photos.entries()) {
        const path = await uploadPickedFile('job-photos', jobId, `photo-${index + 1}`, photo);
        await supabase.from('job_photos').insert({ job_id: jobId, storage_path: path });
      }
      router.replace({ pathname: '/my-jobs/[id]', params: { id: jobId, posted: '1' } });
    } catch (e) {
      setError(friendlyError(e));
      setStage('details');
    }
  }

  if (stage === 'posting') {
    return (
      <Screen>
        <SiteHeader />
        <ThemedText type="subtitle">Sending your job…</ThemedText>
        <ThemedText themeColor="textSecondary">Uploading your photos and finding your trade. This only takes a moment.</ThemedText>
      </Screen>
    );
  }

  if (stage === 'sign-in') {
    return (
      <Screen>
        <SiteHeader />
        <ThemedText type="subtitle">Last step: your mobile number</ThemedText>
        <ThemedText themeColor="textSecondary">
          We’ll text you when a trade accepts your job. Your number is only shared with the trade you’re matched
          with.
        </ThemedText>
        <Card>
          <PhoneSignIn onSignedIn={post} submitLabel="Confirm and post my job" />
        </Card>
        {error && <Notice message={error} />}
        <Button label="Back to my job details" variant="outline" onPress={() => setStage('details')} />
      </Screen>
    );
  }

  const postcodeMessage =
    postcodeCheck?.ok === true
      ? `✓ ${postcodeCheck.town}`
      : postcodeCheck?.reason === 'not_covered'
        ? 'Sorry, Backed. only covers Runcorn, Widnes and Warrington for now.'
        : postcodeCheck?.reason === 'invalid'
          ? 'That doesn’t look like a UK postcode.'
          : postcodeCheck?.reason === 'unavailable'
            ? 'We couldn’t check that postcode. Please try again.'
            : undefined;

  return (
    <Screen>
      <SiteHeader />
      <View style={styles.intro}>
        <ThemedText type="subtitle">Post a job</ThemedText>
        <ThemedText themeColor="textSecondary">Free, and takes about two minutes.</ThemedText>
      </View>

      <Section title="What do you need?">
        <SelectField
          label="Type of trade"
          placeholder="Choose a trade"
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          value={categoryId}
          onChange={setCategoryId}
        />
        <TextField
          label="Job title"
          hint="A few words, like “Leaking kitchen tap” or “New fence panels”."
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
      </Section>

      <Section title="Where is it?">
        <TextField
          label="Postcode"
          hint={postcodeMessage ?? 'We cover Runcorn, Widnes and Warrington.'}
          value={postcode}
          onChangeText={(text) => {
            setPostcode(text);
            setPostcodeCheck(null);
          }}
          onBlur={confirmPostcode}
          autoCapitalize="characters"
          autoComplete="postal-code"
          maxLength={8}
        />
        {postcodeCheck && !postcodeCheck.ok && postcodeCheck.reason === 'not_covered' && (
          <Notice tone="warning" message="We’re starting in three towns and adding more soon." />
        )}
        <TextField
          label="First line of address"
          hint="Optional. Only shared with the trade you’re matched with."
          value={address}
          onChangeText={setAddress}
          autoComplete="street-address"
        />
      </Section>

      <Section title="Tell the trade about it">
        <TextField
          label="Description"
          hint="What’s the problem or the job? Anything they should know, like access or parking."
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
        />
        <View style={styles.photos}>
          <ThemedText type="smallBold">Photos (optional, up to {MAX_PHOTOS})</ThemedText>
          <View style={styles.photoRow}>
            {photos.map((photo, index) => (
              <Pressable
                key={`${photo.uri}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}>
                <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
                <ThemedText type="small" themeColor="textSecondary" style={styles.remove}>
                  Remove
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {photos.length < MAX_PHOTOS && <Button label="Add a photo" variant="outline" onPress={addPhoto} style={styles.addPhoto} />}
        </View>
      </Section>

      <Section title="When and how much?">
        <ToggleRow
          label="It’s an emergency"
          hint="Something that can’t wait, like a burst pipe, no heating or being locked out. We contact trades straight away, day or night."
          value={emergency}
          onValueChange={setEmergency}
        />
        {!emergency && (
          <View style={styles.group}>
            <ThemedText type="smallBold">When do you need it done?</ThemedText>
            <View style={styles.chips}>
              {(Object.keys(TIMING_NAMES) as Enums<'job_timing'>[]).map((option) => (
                <ChoiceChip key={option} label={TIMING_NAMES[option]} selected={timing === option} onPress={() => setTiming(option)} />
              ))}
            </View>
          </View>
        )}
        <View style={styles.group}>
          <ThemedText type="smallBold">Rough budget</ThemedText>
          <View style={styles.chips}>
            {(Object.keys(BUDGET_NAMES) as Enums<'job_budget'>[]).map((option) => (
              <ChoiceChip key={option} label={BUDGET_NAMES[option]} selected={budget === option} onPress={() => setBudget(option)} />
            ))}
          </View>
        </View>
        <ToggleRow
          label="It’s a bigger project"
          hint="More than one person’s work, like an extension, a new kitchen or a full rewire. We’ll only send it to firms that take these on."
          value={large}
          onValueChange={setLarge}
        />
      </Section>

      <Section title="About you">
        <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" />
      </Section>

      {error && <Notice message={error} />}
      <Button label={session ? 'Post my job' : 'Next: confirm your mobile'} size="large" onPress={next} />
      <AgreeToTerms action="posting a job" />
      <SiteFooter />
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

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.one,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photos: {
    gap: Spacing.two,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: Radius.small,
  },
  remove: {
    textAlign: 'center',
  },
  addPhoto: {
    alignSelf: 'flex-start',
  },
});
