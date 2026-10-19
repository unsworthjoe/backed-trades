# Backed. launch to-do list (updated 19 Oct 2026)

DONE so far: Android app tested, Google Play listing + App content finished, Android app (build 5) sent for review (19 Oct).
Apple screenshots made. Founders' feedback done, no changes.

1. Get Apple approved and set up iOS (enrolment W3YQUKH58U)
   0. 19 Oct: Apple REJECTED the enrolment: website had minimal content. Home page expanded (how it works,
      checks, about us) and LIVE. TO DO: resubmit the enrolment with https://backedtrades.co.uk
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
   b. Set both apps to manual release so they don't go live before launch day (Android: check it is set to manual)
   c. Build 5 is in review WITHOUT the "Wrong email? Change it" button (d2a37c0). Claude makes a new build with it;
      submit that as an update (do it alongside the iOS build if possible)
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
      (ask Claude to build ?from= source tracking first if you want to compare areas or flyers)

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
   a. Back up the Play key file in the keys folder to a password manager or private company drive
   b. Add a co-founder or second email as an owner on Firebase, Play Console, Apple, Expo, Supabase and Stripe

Steps 1, 2 and 3 can all happen now while you wait on Apple and Google.
Full runbook: https://claude.ai/artifact/GW2tTxB5Lgc92sLfNz6GWb
