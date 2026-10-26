# Backed. launch to-do list (updated 22 Oct 2026)

DONE so far: Android app tested. 22 Oct: moved Android to the new ORGANISATION Play Console account, because the personal
account was stuck in closed testing. Package renamed to uk.co.backedtrades.backed (iOS bundle ID unchanged:
uk.co.backedtrades.app). New Firebase Android app + google-services.json, new EAS keystore, FCM key uploaded,
store listing created, first build (versionCode 2) uploaded by hand, SHA-1 added to Firebase, eas-submit service account
invited, app SUBMITTED for production review.
Apple screenshots made. Founders' feedback done, no changes.

0. Android: SUBMITTED for production review (22 Oct, organisation Play Console account)
   No closed test needed on the organisation account. The build (versionCode 2) already includes "Wrong email? Change it".
   a. Watch for Google's review result in Play Console (Publishing overview); keep managed publishing ON so it waits for you
   b. DONE 22 Oct: Supabase Site URL set to https://backedtrades.co.uk and redirect URLs added. Before any
      `supabase config push`, check the diff does not put the local site_url (localhost:3000) back on live
   c. Later builds: eas.json submit track is still 'internal'; change it before using eas submit
   d. Retire/delete the old personal-account app once the new one is live

1. Get Apple approved and set up iOS (enrolment W3YQUKH58U)
   0. 19 Oct: Apple REJECTED the enrolment: website had minimal content. Home page expanded (how it works,
      checks, about us) and LIVE. DONE 19 Oct: enrolment resubmitted with https://backedtrades.co.uk
   a. Watch for Apple's email or phone call and answer quickly
   b. Once approved, tell Claude: it sets up iOS signing + push through EAS (you log in when asked)
   c. Claude makes the first iOS build; install it on your iPhone with the TestFlight app
   d. Test the same journey as the Android test on your iPhone

2. Start Stripe live activation (checks can take days)
   PARKED 18 Oct: waiting for the business bank account to be opened
   a. In Stripe, "Activate payments": BACKED TRADE LIMITED (17504288), registered office, director ID, business bank account
   b. Wait for verification; don't switch the app to live keys until launch day

3. Recruit the first trades (alongside everything else)
   a. DONE: founding price agreed at £14.99 a month
   b. Builders' merchant counters + local trade Facebook groups
   c. Enough trades per queue that customers get offers from day one
   d. Get them on the register-interest list now to email at launch
      22 Oct: Facebook/Instagram ads running, and the link is being shared with family and friends
      25 Oct: the sign-up form now sits behind a "Register your interest" button above "Need a job doing?" on the coming-soon page (live)
   e. Source tracking is LIVE (19 Oct). Give every channel its own link,
      e.g. backedtrades.co.uk/?from=fb-runcorn-trades (the /admin/interest page shows the count per tag).
      Wording for the card and Facebook posts: RECRUITING-COPY.md
      For ads: one tag per ad or audience in the ad's website URL (e.g. ?from=ad-plumbers-runcorn); family and friends
      ?from=friends. Keep tags short, lowercase and consistent. Judge an ad after about 10 sign-ups per tag
      Reels now have music (social-media/tools/add-music.mjs; the *-music.mp4 files). Tracks are Meta Reels Sound clips:
      Facebook and Instagram only, not TikTok or YouTube

4. Apple App Store Connect listing
   a. Description, keywords, subtitle, support URL (backedtrades.co.uk/support), privacy URL,
      App Privacy answers, age rating, reviewer notes with the demo login (all in store doc)

5. Submit the iOS app for review
   a. Claude submits the build; you send it for review in App Store Connect
   b. Set both apps to manual release so they don't go live before launch day (Android: use managed publishing, see step 0a)
   c. Android already has "Wrong email? Change it" (versionCode 2). The first iOS build will include it too
   d. Keep the demo trade + test login working until both stores have approved

6. The week before launch
   a. Pick the launch date (after both approvals)
   b. Upgrade Supabase to the Pro plan
      On Pro: leave the Spend Cap on, raise the minimum password length to 12 and turn on leaked-password protection
   c. DONE: iCloud email delivery checked (the 19 Oct password-reset code test)
   d. Marketing drop (flyers, Facebook groups) pointing at the register-interest page
      (use a separate ?from= link per flyer or area so you can compare them)

7. Launch day (in this order)
   a. Switch Stripe to live and put the live keys in Supabase
   b. Remove the test login (test_otp)
   c. Suspend the demo trade (don't delete: Apple needs it for reviews of future updates)
   d. Delete other test data, including the tester's account
   e. Claude deploys the full website to backedtrades.co.uk in place of the coming-soon page
   f. Release both apps in the stores
   g. Real smoke test: post a job, have a trade accept it, buy a membership
   h. Submit the site to Google Search Console
   i. Email everyone on the interest list

8. The first week
   a. Check /admin Alerts, Reports and Reviews every day
   b. Check texts and push notifications are arriving
   c. Answer support emails within one working day (as /support promises)

9. Housekeeping (quick, any time)
   a. Back up the Play key file and the Firebase FCM key file (keys folder) to a password manager or private company drive
   b. Add a co-founder or second email as an owner on Firebase, Play Console, Apple, Expo, Supabase and Stripe

10. Security (from the 26 Oct audit)
   a. DONE: daily text caps (300 sign-in codes, 200 notification texts), keyboard focus ring, photo label
   b. DONE: upload limits (10 MB, photos and PDFs only)
   c. DONE: founders' second sign-in step (authenticator app) is live. Keep two founders enrolled so one can reset the other
   d. Set spending alerts: Meta ads spending limit, Twilio usage trigger + UK-only geo permissions, Expo hosting limit,
      Cloudflare bot fight + rate limit, Resend plan limit, Google Cloud budget alert + restrict the Firebase API key
   e. DONE: /style-guide page removed
   f. Lower-risk items, any time: length limits on job/bio/report text, CORS limited to backedtrades.co.uk,
      timing-safe secret check on the three internal functions, security headers (CSP, clickjacking), npm audit
      warnings (wait for the next Expo patch)

Steps 0, 1, 2 and 3 can all happen now while you wait on Apple and Google.
Full runbook: https://claude.ai/artifact/GW2tTxB5Lgc92sLfNz6GWb
