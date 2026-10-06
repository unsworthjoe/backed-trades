/**
 * The company behind Backed., for the legal pages and the website footer. UK law requires the
 * name, number, where it's registered and the registered office on the website.
 */
export const Company = {
  name: 'Backed Trade Limited',
  number: '17504288',
  registeredIn: 'England and Wales',
  /** TODO before launch: the registered office address, as on Companies House. */
  registeredOffice: null as string | null,
  /** TODO: the ICO data protection fee registration number, once paid. */
  icoNumber: null as string | null,
  privacyEmail: 'privacy@backedtrades.co.uk',
  supportEmail: 'hello@backedtrades.co.uk',
  website: 'https://backedtrades.co.uk',
};

/** When the privacy policy and terms last changed (shown at the top of each). */
export const LegalUpdated = '6 October 2026';
