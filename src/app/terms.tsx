import { LegalPage, type LegalSection } from '@/components/legal-page';
import { Company } from '@/constants/company';

// Terms for customers and trades. Prices here must match public.membership_prices() and the
// membership page.

const SECTIONS: LegalSection[] = [
  {
    heading: 'About these terms',
    body: [
      `Backed. is run by ${Company.name} (company number ${Company.number}, registered in ${Company.registeredIn}). “We” and “us” means ${Company.name}. These terms apply when you use the Backed. website or app, as a customer or as a trade. By creating an account or posting a job, you agree to them.`,
      'Our Privacy policy explains how we use your personal information.',
    ],
  },
  {
    heading: 'What Backed. does',
    body: [
      'Backed. introduces customers who need work done to local tradespeople we’ve checked. We don’t carry out the work ourselves. Trades on Backed. are independent businesses, not our employees or agents.',
      'When a trade accepts your job, any agreement about the work, the price and payment is between you and the trade. We aren’t a party to it, and payment for the work never goes through Backed.',
    ],
  },
  {
    heading: 'How we check trades',
    body: [
      'Before approving a trade, a member of our team checks their ID and their public liability insurance, and any registrations they tell us about, such as Gas Safe, NICEIC, NAPIT, FENSA, CERTASS or OFTEC. We ask trades to keep their insurance in date and pause offers to any trade whose insurance has expired.',
      'These checks show what was true when we made them. They don’t guarantee the quality of a trade’s work. Before work starts, agree the details, price and timings with your trade, and ask for anything you need in writing.',
    ],
  },
  {
    heading: 'Using Backed. as a customer',
    body: [
      {
        list: [
          'Posting a job is free.',
          'Describe your job honestly and accurately, and only post jobs you really want done.',
          'We send your job to trades in turn and match you with the first one who accepts. We can’t promise a trade will accept every job.',
          'You can cancel your job at any time before it’s finished.',
          'Once your trade marks the job as done, please sign it off, or tell us if something’s wrong. If you do neither within 2 days, the job is closed as completed.',
          'Treat trades with respect, and don’t share their contact details with anyone else.',
        ],
      },
    ],
  },
  {
    heading: 'Reviews',
    body: [
      'Only a customer who has had a job done through Backed. can review that trade, and only for that job. Reviews must be honest and about your own experience. Never post a review in exchange for a discount or payment, and never write one for a business you own, work for or are connected to.',
      'We check reviews and may hide one that breaks these rules, contains personal information, or is abusive or unlawful. We don’t hide reviews because they’re negative. If you’re a trade and think a review breaks these rules, contact us and we’ll look at it.',
    ],
  },
  {
    heading: 'Joining Backed. as a trade',
    body: [
      {
        list: [
          'You must be 18 or over, and able to run a trade business in the UK.',
          'Everything you tell us, including your ID, insurance and registrations, must be true and up to date. Tell us straight away if anything changes, for example if your insurance lapses or a registration is withdrawn.',
          'Only take on work you’re qualified, insured and, where the law requires it, registered to do.',
          'Applying is free. We decide whether to approve each application, and may turn one down. If we do, we’ll tell you why where we can.',
        ],
      },
    ],
  },
  {
    heading: 'Offers and the queue',
    body: [
      'Approved members join a queue for each trade and town they cover. Jobs are offered to trades near the front first; a trade who wins a job moves to the back. You have a set time to reply to each offer, which the app shows; no reply counts as declining. Missing several offers in a row pauses your offers until you switch them back on. You can pause at any time and keep your place.',
      'We don’t promise any number of offers or jobs. We may change how the queue works to keep it fair, and we’ll tell members before any significant change.',
    ],
  },
  {
    heading: 'Membership',
    body: [
      {
        list: [
          'Trades need an active membership to receive offers. You can start one once your application is approved.',
          'Founding members pay £14.99 a month or £149.90 a year, and keep that price for as long as their membership continues without a break. The standard price is £19.99 a month or £199.90 a year.',
          'Launch offer: trades who join before 1 January 2027 pay the founding monthly price of £14.99 once when they join, which covers their membership until 1 January 2027. From then their chosen plan starts at the founding price and renews automatically until they cancel.',
          'Memberships are paid in advance by card through Stripe and renew automatically until you cancel.',
          'You can cancel at any time from your membership page. Your membership stays active until the end of the period you’ve paid for, and isn’t renewed after that. We don’t refund part periods, except where the law requires it.',
          'If a payment fails, we’ll let you know. Offers stop if your membership ends.',
          'We may change the standard price, but we’ll give you at least 30 days’ notice by email first, and you can cancel before it takes effect.',
          'Memberships are for your business, so the 14-day cancellation period that applies to consumer purchases doesn’t apply.',
        ],
      },
    ],
  },
  {
    heading: 'Rules for everyone',
    body: [
      'Don’t use Backed. to harass, threaten or discriminate against anyone, to send spam, or for anything illegal. Don’t try to get around our checks, interfere with the service, or use someone else’s account. Keep your password safe.',
    ],
  },
  {
    heading: 'Suspending and closing accounts',
    body: [
      'We may suspend or close an account, or remove a job or review, if these terms are broken, if a trade’s checks no longer pass, if we receive serious complaints, or to keep people safe. Where we can, we’ll tell you why first. If we close a trade’s account for no fault of theirs, we’ll refund any whole months of membership they’ve paid for and not used.',
      'You can delete your account at any time: in the app, from your home screen; on the website, from My jobs. Deleting an account cancels any membership straight away, with no refund for the rest of the period.',
    ],
  },
  {
    heading: 'Our responsibility to you',
    body: [
      'We provide Backed. with reasonable care and skill. We can’t promise it will always be available or free of faults, but we’ll work to fix problems quickly.',
      'We aren’t responsible for work carried out by trades, or for what customers or trades say or do, because they’re not acting for us.',
      'For trades, our total responsibility to you is limited to the membership fees you’ve paid in the 12 months before the problem. We’re not responsible for lost profits or lost business.',
      'Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for anything else the law doesn’t allow us to limit. If you’re a customer, these terms don’t affect your legal rights as a consumer.',
    ],
  },
  {
    heading: 'Changes to these terms',
    body: [
      'We may update these terms as Backed. changes. We’ll change the date at the top and, if the change matters to you, tell you before it applies. If you don’t agree, you can stop using Backed. and delete your account.',
    ],
  },
  {
    heading: 'Law and complaints',
    body: [
      `If something goes wrong, please contact us first at ${Company.supportEmail} so we can try to put it right.`,
      'These terms are governed by the law of England and Wales, and its courts can deal with any dispute. If you’re a customer living in Scotland or Northern Ireland, you can also bring a claim in your local courts.',
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms"
      description="The terms for customers posting jobs and tradespeople joining Backed., including how vetting, the job queue, reviews and memberships work."
      path="/terms"
      intro="The rules for using Backed., whether you’re posting a job or you’re a trade. We’ve kept them as plain as we can."
      sections={SECTIONS}
    />
  );
}
