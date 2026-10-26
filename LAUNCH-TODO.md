# Backed. launch to-do list (updated 27 Oct 2026)

DONE so far: Android app tested. 22 Oct: moved Android to the new ORGANISATION Play Console account, because the personal
account was stuck in closed testing. Package renamed to uk.co.backedtrades.backed (iOS bundle ID unchanged:
uk.co.backedtrades.app). New Firebase Android app + google-services.json, new EAS keystore, FCM key uploaded,
store listing created, first build (versionCode 2) uploaded by hand, SHA-1 added to Firebase, eas-submit service account
invited, app SUBMITTED for production review.
Apple screenshots made. Founders' feedback done, no changes.
27 Oct: Stripe is LIVE. The launch offer is built and tested (see step 3a). Trades will use the WEBSITE while the apps are
pending, and get job offers by email with a link to the offer page. Customers post jobs on the website.

GO LIVE ON THE WEBSITE (before the apps are approved)
   A. Before you flip the switch
      1. Cancel the test membership (Manage membership on /membership) and check in Stripe that its invoice shows a
         £14.99 line "covered until 1 January 2027" with a £14.99 discount from the test code
      2. End-to-end test on backed--demo.expo.app: customer posts a job, the test trade gets the offer EMAIL, the link opens
         the offer, the trade accepts, the customer gets their text/email, then sign off. Try the link while signed out too
      3. Admin page: "Founding member price" switch must be ON (it closes by itself on 1 Jan 2027)
      4. Upgrade Supabase to Pro and leave the Spend Cap on. Upgrade Resend (the free plan sends about 100 emails a day)
      5. Spending alerts (step 10d), especially the Meta ads limit and Twilio
      6. Demo trade ("Demo Plumbing") must not be in the real towns and trades, or real jobs get offered to it. Keep it and the
         test customer login until both stores approve, but change the test code (test_otp in supabase/config.toml: before
         any `supabase config push`, check the diff does not put localhost:3000 back as the Site URL)
      7. Founders approve the first real trades in /admin. A trade must be approved and have a membership to get offers
      8. Have your legal reviewer glance at the new launch-offer sentence in the terms
   B. The switch (Claude prepares it; the production deploy may need you to run it with ! in the prompt)
      1. Claude exports the full site: npx expo export --platform web --output-dir dist --clear (no holding-page setting),
         and checks the home page is not the coming-soon page
      2. Deploy to production: npx eas-cli deploy --export-dir dist --prod --non-interactive
      3. Check backedtrades.co.uk: real home page, /privacy /terms /support, trade sign-up, customer job form, /admin sign-in with
         the code, the security headers
      4. To go back: re-export with EXPO_PUBLIC_HOLDING_PAGE=1 into dist-holding and deploy it with --prod
   C. Straight after
      1. Change the Facebook/Instagram ads and flyer links: they point at the coming-soon sign-up page
      2. Post a real job yourselves and follow it through
      3. Email everyone on the interest list ONCE to say you're live (the sign-up form promised only that). List: /admin/interest
      4. Submit the site to Google Search Console
      5. Watch for a few days: /admin Alerts, Stripe Webhooks (all 200), Twilio and Resend usage, Supabase function logs

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

2. Stripe live activation
   DONE 27 Oct: business bank account opened, Stripe is LIVE (restricted key rk_live in Supabase). Tested a live checkout
   with a 100%-off promotion code: nothing charged, membership active until 1 Jan
   a. Delete or keep the test promotion code (BACKEDTEST) deactivated once you've finished testing
   b. Keep two founders as Stripe owners (step 9b)

3. Recruit the first trades (alongside everything else)
   a. DONE: LAUNCH OFFER built (27 Oct). Join before 1 Jan 2027: pay £14.99 once, covered until 1 Jan 2027, then £14.99 a month
      (or £149.90 a year), kept while they stay a member. From 1 Jan 2027 new members pay £19.99 a month (£199.90 a year).
      The last two days before 1 Jan get the founding price straight away, with no covered-until period (Stripe needs 48 hours)
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
   f. DONE (27 Oct): Liverpool, Winsford and Northwich added (now six towns, all live for customers and trades).
      Postcodes: Winsford CW7, Northwich CW8 and CW9, Liverpool L1 to L19 plus L24 and L25 (add more with another insert)
      TO DO: ask existing trades to add the new towns under "Where you work" (their queues start empty, and a job in a
      town with no trades shows as an alert after 24 hours)
      TO DO: paste the new town wording into the Play Console and App Store Connect listings (no price on iOS) and into the
      ads, and add the three towns to the ad targeting (text is in RECRUITING-COPY.md)

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

7. Launch day for the APPS (the website goes live first, see GO LIVE above)
   a. DONE 27 Oct: Stripe is live and the live keys are in Supabase
   b. Remove the test login (test_otp) once both stores have approved
   c. Suspend the demo trade (don't delete: Apple needs it for reviews of future updates)
   d. Delete other test data, including the tester's account
   e. (Website already live from the GO LIVE steps above)
   f. Release both apps in the stores. Trades already using the website keep getting email offers; trades who install the
      app get push notifications as well
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
   f. DONE (27 Oct): CORS limited to the website addresses, timing-safe secret check on the three internal functions,
      security headers (frame blocking, no file-type guessing, referrer and browser-feature limits)
      DONE (27 Oct): text length limits applied to the live database
   g. Later, any time: a full content security policy (needs testing in a browser), separate secrets for the three
      internal functions, npm audit warnings (wait for the next Expo patch)

Steps 0, 1 and 3 can all happen now while you wait on Apple and Google.
Full runbook: https://claude.ai/artifact/GW2tTxB5Lgc92sLfNz6GWb
