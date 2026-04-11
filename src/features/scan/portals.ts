// Built-in company list with confirmed ATS slugs.
// Greenhouse: boards-api.greenhouse.io/v1/boards/{slug}/jobs
// Lever:      api.lever.co/v0/postings/{slug}?mode=json
// Ashby:      api.ashbyhq.com/posting-api/job-board/{slug}
//
// 404s are handled gracefully — bad slugs are silently skipped.
// Add new companies at the bottom of the relevant section.

export type ATS = 'greenhouse' | 'lever' | 'ashby';

export interface Portal {
  name: string;
  ats: ATS;
  slug: string;
}

export const PORTALS: Portal[] = [

  // ── Greenhouse ────────────────────────────────────────────────────

  // Ecommerce & merchant SaaS (confirmed from career-ops)
  { name: 'BigCommerce',      ats: 'greenhouse', slug: 'bigcommerce' },
  { name: 'Klaviyo',          ats: 'greenhouse', slug: 'klaviyo' },
  { name: 'Yotpo',            ats: 'greenhouse', slug: 'yotpo' },
  { name: 'Attentive',        ats: 'greenhouse', slug: 'attentive' },
  { name: 'Recharge',         ats: 'greenhouse', slug: 'recharge' },
  { name: 'Tapcart',          ats: 'greenhouse', slug: 'tapcart' },
  { name: 'Okendo',           ats: 'greenhouse', slug: 'okendo' },
  { name: 'Rebuy',            ats: 'greenhouse', slug: 'rebuy' },
  { name: 'Affirm',           ats: 'greenhouse', slug: 'affirm' },
  { name: 'Bolt',             ats: 'greenhouse', slug: 'bolt' },
  { name: 'ShipBob',          ats: 'greenhouse', slug: 'shipbob' },

  // Analytics & observability
  { name: 'Amplitude',        ats: 'greenhouse', slug: 'amplitude' },
  { name: 'Mixpanel',         ats: 'greenhouse', slug: 'mixpanel' },
  { name: 'Grafana Labs',     ats: 'greenhouse', slug: 'grafanalabs' },
  { name: 'Glean',            ats: 'greenhouse', slug: 'gleanwork' },
  { name: 'Heap',             ats: 'greenhouse', slug: 'heap' },
  { name: 'FullStory',        ats: 'greenhouse', slug: 'fullstory' },
  { name: 'Pendo',            ats: 'greenhouse', slug: 'pendo' },
  { name: 'Amplitude',        ats: 'greenhouse', slug: 'amplitude' },
  { name: 'Braze',            ats: 'greenhouse', slug: 'braze' },
  { name: 'Iterable',         ats: 'greenhouse', slug: 'iterable' },
  { name: 'LaunchDarkly',     ats: 'greenhouse', slug: 'launchdarkly' },

  // Developer tools & infra
  { name: 'Airtable',         ats: 'greenhouse', slug: 'airtable' },
  { name: 'Intercom',         ats: 'greenhouse', slug: 'intercom' },
  { name: 'Figma',            ats: 'greenhouse', slug: 'figma' },
  { name: 'Loom',             ats: 'greenhouse', slug: 'loom' },
  { name: 'HashiCorp',        ats: 'greenhouse', slug: 'hashicorp' },
  { name: 'Confluent',        ats: 'greenhouse', slug: 'confluent' },
  { name: 'Elastic',          ats: 'greenhouse', slug: 'elastic' },
  { name: 'PagerDuty',        ats: 'greenhouse', slug: 'pagerduty' },
  { name: 'Datadog',          ats: 'greenhouse', slug: 'datadog' },
  { name: 'Cloudflare',       ats: 'greenhouse', slug: 'cloudflare' },
  { name: 'dbt Labs',         ats: 'greenhouse', slug: 'dbtlabs' },
  { name: 'Fivetran',         ats: 'greenhouse', slug: 'fivetran' },
  { name: 'CockroachDB',      ats: 'greenhouse', slug: 'cockroachlabs' },
  { name: 'Temporal',         ats: 'greenhouse', slug: 'temporal' },

  // Productivity & collaboration
  { name: 'Miro',             ats: 'greenhouse', slug: 'miro' },
  { name: 'ClickUp',          ats: 'greenhouse', slug: 'clickup' },
  { name: 'Monday.com',       ats: 'greenhouse', slug: 'mondaydotcom' },
  { name: 'Canva',            ats: 'greenhouse', slug: 'canva' },
  { name: 'Typeform',         ats: 'greenhouse', slug: 'typeform' },
  { name: 'Calendly',         ats: 'greenhouse', slug: 'calendly' },
  { name: 'Coda',             ats: 'greenhouse', slug: 'codaio' },
  { name: 'ProductBoard',     ats: 'greenhouse', slug: 'productboard' },
  { name: 'Asana',            ats: 'greenhouse', slug: 'asana' },
  { name: 'Dropbox',          ats: 'greenhouse', slug: 'dropbox' },
  { name: 'Box',              ats: 'greenhouse', slug: 'box' },

  // Fintech
  { name: 'Brex',             ats: 'greenhouse', slug: 'brex' },
  { name: 'Plaid',            ats: 'greenhouse', slug: 'plaid' },
  { name: 'Ramp',             ats: 'greenhouse', slug: 'ramp' },
  { name: 'Mercury',          ats: 'greenhouse', slug: 'mercury' },
  { name: 'Chime',            ats: 'greenhouse', slug: 'chime' },
  { name: 'Marqeta',          ats: 'greenhouse', slug: 'marqeta' },
  { name: 'Navan',            ats: 'greenhouse', slug: 'navan' },
  { name: 'Gusto',            ats: 'greenhouse', slug: 'gusto' },
  { name: 'Rippling',         ats: 'greenhouse', slug: 'rippling' },
  { name: 'Lattice',          ats: 'greenhouse', slug: 'lattice' },

  // Consumer tech
  { name: 'Airbnb',           ats: 'greenhouse', slug: 'airbnb' },
  { name: 'Lyft',             ats: 'greenhouse', slug: 'lyft' },
  { name: 'Coinbase',         ats: 'greenhouse', slug: 'coinbase' },
  { name: 'DoorDash',         ats: 'greenhouse', slug: 'doordash' },
  { name: 'Robinhood',        ats: 'greenhouse', slug: 'robinhood' },
  { name: 'Reddit',           ats: 'greenhouse', slug: 'reddit' },
  { name: 'Pinterest',        ats: 'greenhouse', slug: 'pinterest' },
  { name: 'Squarespace',      ats: 'greenhouse', slug: 'squarespace' },
  { name: 'Zendesk',          ats: 'greenhouse', slug: 'zendesk' },
  { name: 'HubSpot',          ats: 'greenhouse', slug: 'hubspot' },
  { name: 'Okta',             ats: 'greenhouse', slug: 'okta' },

  // Sales & CRM tooling
  { name: 'Gong',             ats: 'greenhouse', slug: 'gong' },
  { name: 'Outreach',         ats: 'greenhouse', slug: 'outreach' },
  { name: 'Salesloft',        ats: 'greenhouse', slug: 'salesloft' },
  { name: 'Highspot',         ats: 'greenhouse', slug: 'highspot' },
  { name: 'Segment',          ats: 'greenhouse', slug: 'segment' },
  { name: 'Sprig',            ats: 'greenhouse', slug: 'sprig' },
  { name: 'Maze',             ats: 'greenhouse', slug: 'mazedesign' },

  // Logistics & commerce adjacent
  { name: 'Flexport',         ats: 'greenhouse', slug: 'flexport' },
  { name: 'Faire',            ats: 'greenhouse', slug: 'faire' },
  { name: 'Whatnot',          ats: 'greenhouse', slug: 'whatnot' },
  { name: 'StockX',           ats: 'greenhouse', slug: 'stockx' },
  { name: 'Poshmark',         ats: 'greenhouse', slug: 'poshmark' },
  { name: 'Pave',             ats: 'greenhouse', slug: 'pave' },

  // ── Lever ─────────────────────────────────────────────────────────

  { name: 'Help Scout',       ats: 'lever', slug: 'helpscout' },
  { name: 'Netflix',          ats: 'lever', slug: 'netflix' },
  { name: 'Shopify',          ats: 'lever', slug: 'shopify' },
  { name: 'Eventbrite',       ats: 'lever', slug: 'eventbrite' },
  { name: 'Thumbtack',        ats: 'lever', slug: 'thumbtack' },
  { name: 'Coursera',         ats: 'lever', slug: 'coursera' },
  { name: 'Duolingo',         ats: 'lever', slug: 'duolingo' },
  { name: 'Carta',            ats: 'lever', slug: 'carta' },
  { name: 'Nerdwallet',       ats: 'lever', slug: 'nerdwallet' },
  { name: 'Typeahead',        ats: 'lever', slug: 'typeahead' },
  { name: 'Hopper',           ats: 'lever', slug: 'hopper' },
  { name: 'Calm',             ats: 'lever', slug: 'calm' },
  { name: 'Headspace',        ats: 'lever', slug: 'headspace' },
  { name: 'Strava',           ats: 'lever', slug: 'strava' },
  { name: 'OpenTable',        ats: 'lever', slug: 'opentable' },
  { name: 'Nextdoor',         ats: 'lever', slug: 'nextdoor' },
  { name: 'Wealthfront',      ats: 'lever', slug: 'wealthfront' },
  { name: 'Betterment',       ats: 'lever', slug: 'betterment' },

  // ── Ashby ─────────────────────────────────────────────────────────

  // Confirmed from career-ops
  { name: 'Gorgias',          ats: 'ashby', slug: 'gorgias' },
  { name: 'Triple Whale',     ats: 'ashby', slug: 'triplewhale' },
  { name: 'Loop Returns',     ats: 'ashby', slug: 'loopreturns' },
  { name: 'Linear',           ats: 'ashby', slug: 'linear' },
  { name: 'Notion',           ats: 'ashby', slug: 'notion' },
  { name: 'Front',            ats: 'ashby', slug: 'front' },
  { name: 'Close',            ats: 'ashby', slug: 'close' },
  { name: 'Hex',              ats: 'ashby', slug: 'hex' },
  { name: 'Zapier',           ats: 'ashby', slug: 'zapier' },
  { name: 'n8n',              ats: 'ashby', slug: 'n8n' },

  // Dev tools & infra startups known to use Ashby
  { name: 'Vercel',           ats: 'ashby', slug: 'vercel' },
  { name: 'Supabase',         ats: 'ashby', slug: 'supabase' },
  { name: 'Render',           ats: 'ashby', slug: 'render' },
  { name: 'Railway',          ats: 'ashby', slug: 'railway' },
  { name: 'Neon',             ats: 'ashby', slug: 'neon-dev' },
  { name: 'Turso',            ats: 'ashby', slug: 'turso' },
  { name: 'Liveblocks',       ats: 'ashby', slug: 'liveblocks' },
  { name: 'Prisma',           ats: 'ashby', slug: 'prisma' },
  { name: 'Sanity',           ats: 'ashby', slug: 'sanity-io' },
  { name: 'Builder.io',       ats: 'ashby', slug: 'builderio' },
  { name: 'Makeswift',        ats: 'ashby', slug: 'makeswift' },
  { name: 'Cal.com',          ats: 'ashby', slug: 'calcom' },
  { name: 'Dub',              ats: 'ashby', slug: 'dub' },
  { name: 'Resend',           ats: 'ashby', slug: 'resend' },
  { name: 'Clerk',            ats: 'ashby', slug: 'clerk' },
  { name: 'Stytch',           ats: 'ashby', slug: 'stytch' },
  { name: 'Retool',           ats: 'ashby', slug: 'retool' },
  { name: 'Airplane',         ats: 'ashby', slug: 'airplane' },
  { name: 'Basedash',         ats: 'ashby', slug: 'basedash' },
  { name: 'Trigger.dev',      ats: 'ashby', slug: 'triggerdev' },
  { name: 'Inngest',          ats: 'ashby', slug: 'inngest' },
  { name: 'Temporal Cloud',   ats: 'ashby', slug: 'temporal-cloud' },
  { name: 'Encore',           ats: 'ashby', slug: 'encore' },
  { name: 'Grafbase',         ats: 'ashby', slug: 'grafbase' },
];
