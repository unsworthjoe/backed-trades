/**
 * The company behind Backed., for the legal pages and the website footer. UK law requires the
 * name, number, where it's registered and the registered office on the website.
 */
export const Company = {
  name: 'Backed Trade Limited',
  number: '17504288',
  registeredIn: 'England and Wales',
  registeredOffice: '12 New Albert Terrace, Runcorn, WA7 1DD' as string | null,
  /**
   * TODO: the ICO registration number once the ICO confirms it. Applied 2026-10-07 (case ref
   * C2053592) — that's the application reference, not the registration number, so it isn't shown.
   */
  icoNumber: null as string | null,
  privacyEmail: 'privacy@backedtrades.co.uk',
  supportEmail: 'hello@backedtrades.co.uk',
  website: 'https://backedtrades.co.uk',
};

/** When the privacy policy and terms last changed (shown at the top of each). */
export const LegalUpdated = '6 October 2026';
