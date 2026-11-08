// Club-wide facts used across the site. Edit here, not in the pages.

export const site = {
  name: 'Baking Bad',
  fullName: 'Princeton Baking Bad',
  tagline: "Princeton's all-inclusive student baking club",
  description:
    "Baking Bad is Princeton's all-inclusive student baking club: themed bake nights, cultural collaborations, and free baked goods. No experience needed.",
  since: 2025,

  // TODO(officers): confirm. This is the founding president's address from the old site;
  // swap in a current officer or a shared club inbox.
  email: 'mr0669@princeton.edu',
  instagram: { handle: '@bakingbadprinceton', url: 'https://www.instagram.com/bakingbadprinceton/' },
  // TODO(officers): confirm this GroupMe invite link is still active.
  groupme: 'https://groupme.com/join_group/110639795/UEkznSWR',
  kitchens: ['CAF Kitchen', 'NCW Community Kitchen'],

  // Required on every ODUS-recognized student organization's website.
  odusStatement:
    "This organization is open to all Princeton University students interested in supporting our organization's mission, regardless of identity, such as race, sex, ethnicity, national origin, or other protected characteristics.",
} as const;

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/team/', label: 'Team' },
  { href: '/join/', label: 'Join' },
] as const;
