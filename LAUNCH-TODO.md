# Backed. launch to-do list (updated 22 Oct 2026)

DONE so far: Android app tested. 22 Oct: moved Android to the new ORGANISATION Play Console account, because the personal
account was stuck in closed testing. Package renamed to uk.co.backedtrades.backed (iOS bundle ID unchanged:
uk.co.backedtrades.app). New Firebase Android app + google-services.json, new EAS keystore, FCM key uploaded,
store listing created, first build (versionCode 2) uploaded by hand, SHA-1 added to Firebase.
Apple screenshots made. Founders' feedback done, no changes.

0. Android: new organisation Play Console account (LONGEST WAIT, start now)
   The old personal-account app is abandoned. Check what the organisation account needs before Production:
   it may be exempt from the "12 testers for 14 days" rule; Play Console will say what it requires.
   If it is NOT exempt: 12 testers opted in for 14 days in a row, then apply for production access.
   Open items from the move:
   - Invite eas-submit@backed-191c8.iam.gserviceaccount.com to the new Play Console (release permissions),
     so `eas submit` works for later builds
   - Check the Supabase auth redirect URLs for anything using the old package name (the backed:// scheme is unchanged)
   - Retire/delete the old personal-account app once the new one is live
   a. Play Console > Testing > Closed testing > Alpha > Testers: attach a tester list or Google Group
   b. Add 15-20 people (founders, friends, family, some trades from the recruiting list). Each needs a Google account
      that matches the one on their Android phone's Play Store
   c. Send them the opt-in link; they opt in and install from Play. Note the date the 12th person opts in
   d. They must stay opted in 14 days (the count must stay at 12+). Ask them to open the app once or twice
   e. After 14 days: Release > Production > "Apply for access to production" and answer the questions
      (a few days for Google to review). Earliest apply date if 12 join by 20 Oct: about 3 Nov
   f. Then create the Production release with the newest build (includes "Wrong email? Change it"),
      and turn on managed publishing in Publishing overview so it waits for you to press publish
   g. Meanwhile, put the newest build on the Alpha track too so testers have the latest version

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
   a. Agree the founding price
   b. Builders' merchant counters + local trade Facebook groups
   c. Enough trades per queue that customers get offers from day one
   d. Get them on the register-interest list now to email at launch
   e. Source tracking is LIVE (19 Oct). Give every channel its own link,
      e.g. backedtrades.co.uk/?from=fb-runcorn-trades (the /admin/interest page shows the count per tag).
      Wording for the card and Facebook posts: RECRUITING-COPY.md

4. Apple App Store Connect listing
   a. Description, keywords, subtitle, support URL (backedtrades.co.uk/support), privacy URL,
      App Privacy answers, age rating, reviewer notes with the demo login (all in store doc)

5. Submit the iOS app for review
   a. Claude submits the build; you send it for review in App Store Connect
   b. Set both apps to manual release so they don't go live before launch day (Android: use managed publishing, see step 0f)
   c. Build 5 (Alpha track) is WITHOUT the "Wrong email? Change it" button (d2a37c0). Claude makes a new build with it;
      use it for the Android Production release and the iOS build
   d. Keep the demo trade + test login working until both stores have approved

6. The week before launch
   a. Pick the launch date (after both approvals)
   b. Upgrade Supabase to the Pro plan
   c. iCloud email delivery (codes to iCloud addresses were delayed on 16 Oct)
      Checked 18 Oct: DNS fine, all Resend records verified, the 16 Oct emails now show delivered.
      Likely iCloud being cautious with a new sending domain, which should ease with time.
      TO DO 19 Oct: start a password reset in the app with an iCloud address and time the code.
      Under a minute or two = fine, tick this off. Still slow = send Claude the event text from
      Resend > Emails for that email
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

Steps 0, 1, 2 and 3 can all happen now while you wait on Apple and Google.
Full runbook: https://claude.ai/artifact/GW2tTxB5Lgc92sLfNz6GWb
