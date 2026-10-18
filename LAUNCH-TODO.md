# Backed. launch to-do list (updated 18 Oct 2026)

1. Test the Android app (Pixel 8 emulator in Android Studio)
   First run DONE 16 Oct: everything worked except push notifications (an emulator-only bug), the
   membership email (bad Resend key, now replaced) and two small form fixes. All fixed in build 5.
   a. DONE 18 Oct: build 5 rolled out and installed on the emulator. Sign-up emails had stopped
      (Supabase SMTP password was the old Resend key); fixed by putting the new key in SMTP settings
   b. DONE 18 Oct: retest with a new email, all passed: "Other" last + expiry slashes, membership
      email, push for offers and messages, admin email says "already an account" (checked by Claude
      on the emulator; the first try went to the code screen but couldn't be reproduced)
   c. DONE 18 Oct: job posted with a real mobile number; customer texts arrived
   STEP 1 COMPLETE. Waiting for the next build: "Wrong email? Change it" button on the code screen (d2a37c0)

2. Get Apple approved and set up iOS (enrolment W3YQUKH58U, submitted)
   a. Watch for Apple's email or phone call and answer quickly
   b. Once approved, tell Claude: it sets up iOS signing + push through EAS (you log in when asked)
   c. Claude makes the first iOS build; install it on your iPhone with the TestFlight app
   d. Test the same journey as step 1 on your iPhone

3. Get the founders' feedback (before any screenshots)
   a. Rebook the postponed meeting
   b. Agree any changes to app design, brand colour and store listing text
      (store doc: https://claude.ai/code/artifact/e55d65f3-978c-4871-bcdd-9e30cf5e5a6b)
   c. Send Claude the changes; Claude makes them and does a new build

4. Start Stripe live activation (checks can take days)
   PARKED 18 Oct: waiting for the business bank account to be opened
   a. In Stripe, "Activate payments": BACKED TRADE LIMITED (17504288), registered office, director ID, business bank account
   b. Wait for verification; don't switch the app to live keys until launch day

5. Recruit the first trades (alongside everything else)
   a. Agree the founding price
   b. Builders' merchant counters + local trade Facebook groups
   c. Enough trades per queue that customers get offers from day one
   d. Get them on the register-interest list now to email at launch

6. Store listing assets
   a. DONE for Google Play (16 Oct, current branding): 6 screenshots, feature graphic and 512 icon in
      social-media/output/store/ (designs in social-media/designs/backed/store/). DONE 18 Oct: Apple set
      (1320x2868, iPhone frame) in social-media/output/store-ios/, made from the Play designs.
      If step 3 changes the design or colour: edit designs/backed/store, then run
      `node tools/store-ios.mjs && node tools/render.mjs designs/backed/store designs/backed/store-ios`
   b. DONE: Google Play feature graphic (1024x500)
   c. DONE (16 Oct): Google Play Store listing: name, short + full description, icon, screenshots, feature graphic (text in store doc)
   d. DONE (16 Oct): Google Play App content (privacy policy, app access, ads, content rating,
      target audience, data safety, financial features and the rest)
   e. Apple App Store Connect: description, keywords, subtitle, support URL (backedtrades.co.uk/support), privacy URL,
      App Privacy answers, age rating, reviewer notes with the demo login (all in store doc)

7. Submit both apps for review
   a. Android: promote the tested build from internal testing to Production and send for review
   b. iOS: Claude submits the build; you send it for review in App Store Connect
   c. Set both to manual release so they don't go live before launch day
   d. Keep the demo trade + test login working until both stores have approved

8. The week before launch
   a. Pick the launch date (after both approvals)
   b. Upgrade Supabase to the Pro plan
   c. iCloud email delivery (codes to iCloud addresses were delayed on 16 Oct)
      Checked 18 Oct: DNS fine, all Resend records verified, the 16 Oct emails now show delivered.
      Likely iCloud being cautious with a new sending domain, which should ease with time.
      TO DO 19 Oct: start a password reset in the app with an iCloud address and time the code.
      Under a minute or two = fine, tick this off. Still slow = send Claude the event text from
      Resend > Emails for that email
   d. Marketing drop (flyers, Facebook groups) pointing at the register-interest page
      (ask Claude to build ?from= source tracking first if you want to compare areas or flyers)

9. Launch day (in this order)
   a. Switch Stripe to live and put the live keys in Supabase
   b. Remove the test login (test_otp)
   c. Suspend the demo trade (don't delete: Apple needs it for reviews of future updates)
   d. Delete other test data, including the tester's account
   e. Claude deploys the full website to backedtrades.co.uk in place of the coming-soon page
   f. Release both apps in the stores
   g. Real smoke test: post a job, have a trade accept it, buy a membership
   h. Submit the site to Google Search Console
   i. Email everyone on the interest list

10. The first week
   a. Check /admin Alerts, Reports and Reviews every day
   b. Check texts and push notifications are arriving
   c. Answer support emails within one working day (as /support promises)

11. Housekeeping (quick, any time)
   a. Back up the Play key file in the keys folder to a password manager or private company drive
   b. Add a co-founder or second email as an owner on Firebase, Play Console, Apple, Expo, Supabase and Stripe

Steps 1, 4 and 5 can all happen now while you wait on Apple.
Full runbook: https://claude.ai/artifact/GW2tTxB5Lgc92sLfNz6GWb
