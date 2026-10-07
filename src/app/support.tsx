import { Platform } from 'react-native';

import { LegalPage, type LegalSection } from '@/components/legal-page';
import { Company } from '@/constants/company';

// The help page: the app stores' support link (https://backedtrades.co.uk/support). Keep the
// answers in step with the app's real button names. Phones never see the membership answer: Apple
// only lets us sell the membership outside the app if the app never points people to buy it.

const IS_WEB = Platform.OS === 'web';

const companyLine = [
  `Backed. is run by ${Company.name}, registered in ${Company.registeredIn}, company number ${Company.number}.`,
  Company.registeredOffice && `Registered office: ${Company.registeredOffice}.`,
]
  .filter(Boolean)
  .join(' ');

const SECTIONS: LegalSection[] = [
  {
    heading: 'Contact us',
    body: [
      `Email ${Company.supportEmail} with anything at all. We’re a small team: a real person reads every email, and we’ll reply within one working day.`,
      `For questions about your personal information, email ${Company.privacyEmail}.`,
      companyLine,
    ],
  },
  {
    heading: 'For tradespeople',
    body: [
      {
        list: [
          'Joining: download the Backed. app, tap “Join as a trade” and send your application. We check your ID, insurance and registrations by hand, then let you know.',
          'Job offers: when you reach the front of a queue, you and two other trades are offered the job. You have 2 hours to answer, and the clock only runs from 7am to 8pm. The first to accept wins it, and the winner goes to the back of the queue.',
          'Turning down work: tap “Decline” and tell us why. If it’s not your kind of work, we’ll send you better matches.',
          'Taking a break: switch off “Taking new offers” on your home screen. You keep your place in every queue.',
          'Emergency call-outs: switch on “Emergency call-outs” if you want urgent jobs. You get 30 minutes to answer those, at any time of day.',
          'No notifications? Check that notifications are switched on for Backed. in your phone’s settings.',
          'Forgotten your password? Tap “Forgot your password?” on the sign-in screen and we’ll email you a code.',
          ...(IS_WEB
            ? ['Your membership: sign in at backedtrades.co.uk/membership to change your plan, update your card or cancel.']
            : []),
        ],
      },
    ],
  },
  {
    heading: 'For customers',
    body: [
      {
        list: [
          'Posting a job is free. Go to backedtrades.co.uk, tell us what you need and sign in with a text code sent to your mobile.',
          'Once a trade accepts your job, you get their details and they’ll contact you. You can message them from your job page.',
          'Not working out? Tap “Ask for a different trade” on your job page any time before the job is marked done.',
        ],
      },
    ],
  },
  {
    heading: 'Reporting a problem',
    body: [
      'Tap “Report a problem” on the job, in the app or on the website. One of us reads every report and will contact you.',
      'If anyone is in danger, call 999 first.',
    ],
  },
  {
    heading: 'Deleting your account',
    body: [
      'Trades: tap “Delete my account” at the bottom of your home screen in the app. Customers: tap it on your My jobs page on the website.',
      `No longer have the app? Email ${Company.supportEmail} from your account’s email address (customers: tell us your mobile number) and we’ll delete it within 30 days.`,
      'Your details are removed straight away. The privacy policy explains what we keep and for how long.',
    ],
  },
];

export default function SupportScreen() {
  return (
    <LegalPage
      title="Help and contact"
      description="Get help with Backed.: contact details, how job offers work for trades, posting a job, reporting a problem and deleting your account."
      path="/support"
      intro="Answers to the most common questions, and how to reach us."
      sections={SECTIONS}
      updated={null}
      numbered={false}
    />
  );
}
