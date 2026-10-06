import { LegalPage, type LegalSection } from '@/components/legal-page';
import { Company } from '@/constants/company';

// Plain-English privacy policy for UK GDPR. Keep it in step with what the app really does: if a
// feature starts collecting something new, or a new outside service is added, update this page.

const registration = [
  `${Company.name} is registered in ${Company.registeredIn}, company number ${Company.number}.`,
  Company.registeredOffice && `Registered office: ${Company.registeredOffice}.`,
  Company.icoNumber && `We’re registered with the Information Commissioner’s Office (ICO), number ${Company.icoNumber}.`,
]
  .filter(Boolean)
  .join(' ');

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      `Backed. is run by ${Company.name}. We’re responsible for your personal information (the “controller”). ${registration}`,
      `Questions about your information, or want to use your rights? Email ${Company.privacyEmail}.`,
    ],
  },
  {
    heading: 'What we collect from customers',
    body: [
      {
        list: [
          'Your mobile number, which is how you sign in. We text you a code to check it’s yours.',
          'Your name.',
          'Your job: the trade you need, a title and description, timing, budget, any photos, your postcode and the first line of your address.',
          'Messages between you and your trade.',
          'Reviews you leave, and any problems you report.',
        ],
      },
    ],
  },
  {
    heading: 'What we collect from trades',
    body: [
      {
        list: [
          'Your name, email address and password. Passwords are stored scrambled, so we can never see them.',
          'Your business: its name, description, company number if you have one, and a contact phone number.',
          'Your trades, the towns you cover, and whether you take larger projects or emergency call-outs.',
          'Your public liability insurance certificate and its expiry date, and any registrations, such as Gas Safe or NICEIC.',
          'A photo of your ID and a selfie, so a member of our team can check you are who you say you are. A person compares them; we don’t use automated face recognition.',
          'How you use the queue: offers you get, accept or decline, the reasons you give, and pauses.',
          'Ratings customers give you, and ratings you give customers.',
          'Your membership: plan, price, status and renewal date. Your card details go straight to Stripe; we never see or store them.',
          'Messages with customers, and any problems you report.',
          'If you allow notifications, a code that lets us send them to your phone.',
        ],
      },
    ],
  },
  {
    heading: 'What we collect from everyone',
    body: [
      'When you use the website or app, our providers record technical details such as your IP address, device and browser type, and the date and time. We use these to keep the service running, find faults, and stop abuse, for example by limiting how many text codes can be sent from one place.',
      'The job form uses Cloudflare Turnstile to check you’re a person, not a bot. It looks at signals from your browser to do this.',
    ],
  },
  {
    heading: 'How we use it, and why we’re allowed to',
    body: [
      'UK data protection law says we need a lawful reason for each use. Ours are:',
      {
        list: [
          'To provide the service you signed up for (contract): your account, sending jobs to trades, matching you with one trade, messages, notifications, reviews and memberships.',
          'To keep Backed. safe and trustworthy (legitimate interests): checking every trade before they’re approved, checking insurance stays in date, dealing with reports and complaints, checking reviews are genuine, and preventing fraud and abuse.',
          'To meet our legal duties (legal obligation): keeping payment records for tax, and answering lawful requests from the authorities.',
          'To improve Backed. (legitimate interests): understanding how the service is used, so we can fix problems and make it better.',
        ],
      },
      'We don’t sell your information, and we don’t use it for advertising.',
    ],
  },
  {
    heading: 'Automatic decisions',
    body: [
      'Which trades are offered a job is decided automatically by our queue: trades near the front get offers first, and a trade who wins a job moves to the back. Missing several offers in a row pauses a trade’s offers automatically; they can switch them back on at any time.',
      'A person, not a computer, decides whether to approve a trade, and whether to suspend one.',
    ],
  },
  {
    heading: 'Who can see your information',
    body: [
      {
        list: [
          'Trades offered your job see what it is, the area and any photos. Only the trade who accepts it gets your name, address and mobile number.',
          'You see your trade’s business name and contact phone number once they’ve accepted your job.',
          'Anyone can see an approved trade’s profile: business name, trades, towns, the checks they’ve passed, their rating and reviews. Reviews show the customer’s first name only.',
          'Our team can see what they need to vet trades, deal with reports and run the service.',
        ],
      },
      'We use these companies to run Backed. They only use your information to provide their service to us:',
      {
        list: [
          'Supabase: our database, file storage and sign-in (data stored in Ireland).',
          'Stripe: memberships and card payments.',
          'Twilio: text messages, such as sign-in codes and job updates.',
          'Resend: emails, such as sign-in codes and alerts.',
          'Expo: hosting the website, and sending notifications to the app.',
          'Cloudflare: the Turnstile check on the job form, and delivering the website.',
          'Apple and Google: delivering notifications to iPhones and Android phones.',
        ],
      },
      'We may also share information if the law requires it, to protect someone’s safety, or if Backed. is sold or merged (the new owner would have to look after it in the same way).',
    ],
  },
  {
    heading: 'Information sent outside the UK',
    body: [
      'Some of these companies store or process information outside the UK, mainly in the European Union and the United States. Where they do, the transfer is protected by UK adequacy regulations (including the UK–US “data bridge”) or by the UK’s standard contract terms for international transfers.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      {
        list: [
          'Your account: until you delete it.',
          'ID photos and selfies: deleted 30 days after we approve or turn down an application.',
          'Jobs, messages and reports: 2 years after the job ends, then deleted.',
          'Reviews: shown for as long as the trade is on Backed. They’re removed if the customer or the trade deletes their account.',
          'Payment records: 6 years, because tax law requires it. Stripe keeps its own records for the same reason.',
          'Technical logs: a few weeks.',
        ],
      },
      'When you delete your account, your details, jobs, messages, reviews and uploaded files are deleted straight away. Copies in our providers’ backups are overwritten within 30 days.',
    ],
  },
  {
    heading: 'Cookies and browser storage',
    body: [
      'We don’t use advertising or analytics cookies. The website keeps you signed in by storing a sign-in token in your browser; this is needed for the site to work. Cloudflare Turnstile may store small amounts of information to tell people from bots, and Stripe’s payment pages use their own cookies to process payments safely.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'You can ask us to:',
      {
        list: [
          'give you a copy of your information;',
          'correct anything that’s wrong;',
          'delete your information;',
          'stop or limit how we use it, or object to a use based on our legitimate interests;',
          'send your information to you or another company in a common format.',
        ],
      },
      `You can delete your account yourself at any time: in the app, from your home screen; on the website, from My jobs. For anything else, email ${Company.privacyEmail}. We’ll reply within one month. It’s free.`,
      'If you’re unhappy with how we’ve handled your information, please tell us first so we can put it right. You can also complain to the Information Commissioner’s Office: ico.org.uk or 0303 123 1113.',
    ],
  },
  {
    heading: 'Children',
    body: ['Backed. is for adults. You must be 18 or over to post a job or join as a trade.'],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If we change how we use your information, we’ll update this page and the date at the top. If the change is significant, we’ll tell you by email, text or in the app before it happens.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy policy"
      description="How Backed. collects, uses and protects the personal information of customers and tradespeople, and your rights under UK data protection law."
      path="/privacy"
      intro="This explains what personal information Backed. collects, why, who sees it, how long we keep it and your rights. It covers the Backed. website, where customers post jobs, and the Backed. app for trades."
      sections={SECTIONS}
    />
  );
}
