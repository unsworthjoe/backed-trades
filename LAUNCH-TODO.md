# Backed. launch to-do list (updated 16 Oct 2026)

1. Test the Android app (Pixel 8 emulator in Android Studio)
   First run DONE 16 Oct: everything worked except push notifications (an emulator-only bug), the
   membership email (bad Resend key, now replaced) and two small form fixes. All fixed in build 5.
   a. NEXT: check build 5's submission finished, then Play Console > Testing > Internal testing >
      the version code 5 draft > Review release > Start rollout; update Backed. on the emulator
   b. Retest with a NEW Gmail address (iCloud delays our emails):
      - "Other" is last in the trades list; the insurance expiry date fills in its slashes
      - after approval, the "Set up your Backed. membership" email arrives
      - push notifications arrive for a new offer and for a new message
      - signing up with your admin email says there's already an account
   c. Post one job with a REAL mobile number (not the 07700 test number) to check customer texts arrive
   d. Send Claude anything that looks wrong, with screenshots and the step letter

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
   a. In Stripe, "Activate payments": BACKED TRADE LIMITED (17504288), registered office, director ID, business bank account
   b. Wait for verification; don't switch the app to live keys until launch day

5. Recruit the first trades (alongside everything else)
   a. Agree the founding price
   b. Builders' merchant counters + local trade Facebook groups
   c. Enough trades per queue that customers get offers from day one
   d. Get them on the register-interest list now to email at launch

6. Store listing assets
   a. DONE for Google Play (16 Oct, current branding): 6 screenshots, feature graphic and 512 icon in
      social-media/output/store/ (designs in social-media/designs/backed/store/). Still to do: the Apple
      set (1320x2868, iPhone frame), and re-render both if step 3 changes the design or colour
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
   c. Ask Claude to check iCloud email delivery (codes to iCloud addresses were delayed on 16 Oct)
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
