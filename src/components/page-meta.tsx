import Head from 'expo-router/head';

/** The website's address, for canonical links and social sharing previews. */
const SITE_URL = 'https://backedtrades.co.uk';

type PageMetaProps = {
  title: string;
  /** One or two sentences: what search results and link previews show under the title. */
  description: string;
  /** The page's address on the site, e.g. "/" or "/welcome". */
  path: string;
};

/**
 * Title, description and link-preview tags for a public website page. They're written into the
 * page's HTML when the website is built, so search engines and link previews see them.
 */
export function PageMeta({ title, description, path }: PageMetaProps) {
  const url = `${SITE_URL}${path}`;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Backed." />
      <meta property="og:locale" content="en_GB" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary" />
    </Head>
  );
}

/** For pages that shouldn't appear in search results (admin, signed-in areas). */
export function NoIndex() {
  return (
    <Head>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );
}
