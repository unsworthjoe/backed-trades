/** Display names for database values. */

export const SCHEME_NAMES: Record<string, string> = {
  gas_safe: 'Gas Safe',
  niceic: 'NICEIC',
  napit: 'NAPIT',
  fensa: 'FENSA',
  certass: 'CERTASS',
  oftec: 'OFTEC',
  other: 'Other',
};

export const BUSINESS_TYPE_NAMES: Record<string, string> = {
  sole_trader: 'Sole trader',
  partnership: 'Partnership',
  limited_company: 'Limited company',
};

export const TIMING_NAMES: Record<string, string> = {
  asap: 'As soon as possible',
  within_a_week: 'Within a week',
  within_a_month: 'Within a month',
  flexible: 'I’m flexible',
};

export const BUDGET_NAMES: Record<string, string> = {
  under_250: 'Under £250',
  '250_to_1000': '£250 to £1,000',
  '1000_to_5000': '£1,000 to £5,000',
  '5000_to_15000': '£5,000 to £15,000',
  over_15000: 'Over £15,000',
  not_sure: 'Not sure',
};

/** How a job's status reads to the customer. */
export const JOB_STATUS: Record<string, { label: string; tone: 'brand' | 'success' | 'warning' | 'neutral' | 'info' }> = {
  offering: { label: 'Finding you a trade', tone: 'brand' },
  matched: { label: 'Trade found', tone: 'success' },
  done: { label: 'Ready to sign off', tone: 'warning' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** Reasons a trade can give for declining an offer, in the order they're shown. */
export const DECLINE_REASONS: { value: 'too_busy' | 'too_far' | 'not_my_kind_of_work' | 'too_small' | 'too_big' | 'other'; label: string }[] = [
  { value: 'too_busy', label: 'Too busy' },
  { value: 'too_far', label: 'Too far away' },
  { value: 'not_my_kind_of_work', label: 'Not my kind of work' },
  { value: 'too_small', label: 'Too small' },
  { value: 'too_big', label: 'Too big' },
  { value: 'other', label: 'Something else' },
];

/** Tick-boxes when a trade rates a customer (customer_ratings.tags). */
export const CUSTOMER_RATING_TAGS = [
  { value: 'clear_brief', label: 'Clear about the job' },
  { value: 'easy_to_reach', label: 'Easy to reach' },
  { value: 'good_access', label: 'Good access' },
  { value: 'paid_promptly', label: 'Paid promptly' },
];

/** The founders' alerts, as shown on the admin site (the emails use the same wording). */
export const ALERT_NAMES: Record<string, string> = {
  job_unmatched: 'A job hasn’t been taken after 24 hours',
  no_contact: 'A trade hasn’t contacted their customer within 24 hours',
  low_customer_rating: 'A customer has a low rating from trades',
  trade_paused: 'A trade was paused for missing offers',
  insurance_expiring: 'A trade’s insurance is about to expire',
  application_submitted: 'A trade has sent their application',
  report_filed: 'Someone has reported a problem',
  user_blocked: 'Someone has blocked someone',
};
