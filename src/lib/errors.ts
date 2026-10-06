/** Plain-English versions of the codes the database and Supabase Auth send back. */
const MESSAGES: Record<string, string> = {
  CAMERA_PERMISSION_DENIED: 'Backed. can’t use your camera. Allow camera access in your phone’s Settings, or choose a photo instead.',
  APPLICATION_INCOMPLETE: 'Some parts of your application are still missing.',
  ALREADY_APPROVED: 'Your application has already been approved.',
  ADMINS_ONLY: 'Only Backed. admins can do that.',
  NOT_SUBMITTED: 'This application hasn’t been submitted yet.',
  ID_NOT_PASSED: 'Mark the ID check as passed before approving.',
  INSURANCE_NOT_APPROVED: 'Approve an in-date insurance certificate before approving.',
  REASON_REQUIRED: 'Please give a reason. The trade will see it.',
  TRADE_NOT_REJECTABLE: 'Only submitted applications can be rejected.',
  TRADE_NOT_APPROVABLE: 'This trade can’t be approved in its current state.',
  JOB_TAKEN: 'Another trade accepted this job first, or the customer cancelled it.',
  OFFER_EXPIRED: 'The time to reply to this offer has run out.',
  OFFER_NOT_PENDING: 'You’ve already answered this offer.',
  OFFER_NOT_FOUND: 'We couldn’t find that offer.',
  DECLINE_REASON_REQUIRED: 'Please pick a reason for declining.',
  CANNOT_RESUME: 'Backed. has paused your account. Please get in touch with us to switch offers back on.',
  MATCH_NOT_FOUND: 'This job is no longer yours. The customer may have cancelled it.',
  NOT_IN_QUEUE: 'You’re no longer in that queue.',
  'Invalid login credentials': 'That email and password don’t match. Please try again.',
  'Email not confirmed': 'Please confirm your email first.',
  'User already registered': 'There’s already an account with that email. Try signing in.',
  'Token has expired or is invalid': 'That code is wrong or has expired. Check the email or send a new code.',
};

export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  for (const [code, friendly] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return friendly;
  }
  if (/password/i.test(message) && /(at least|characters|length)/i.test(message)) {
    return 'Your password needs to be at least 8 characters.';
  }
  if (/network|fetch/i.test(message)) return 'Can’t reach Backed. right now. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
