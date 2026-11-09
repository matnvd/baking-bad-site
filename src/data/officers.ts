// Officer rosters, newest term first. To add next year's team, put a new
// object at the top of `terms`; the previous team automatically moves to
// "Past teams" on /team.
//
// Headshots (optional): drop a square JPG/PNG into src/assets/officers/
// named after the officer, e.g. "Vivian Li" → vivian-li.jpg, and it shows up
// on /team automatically. To use a different filename, set `photo`.
// Officers without a photo get their initials instead.

export interface Officer {
  name: string;
  role: string;
  /** optional headshot filename in src/assets/officers/ (defaults to the officer's name, e.g. vivian-li.jpg) */
  photo?: string;
}

export interface Term {
  label: string;
  note?: string;
  officers: Officer[];
}

export const terms: Term[] = [
  {
    label: "Fall '26 – Fall '27",
    officers: [
      { name: 'Vivian Li', role: 'Co-President · Administration' },
      { name: 'Mariana Palmett', role: 'Co-President · Communications' },
      { name: 'Mabel Li', role: 'Treasurer' },
      { name: 'Matthew Bassily', role: 'Social Media · Flyers' },
      { name: 'Joanne Wang', role: 'Social Media · Graphic Design' },
      { name: 'Zach Ciappa', role: 'Social Media · Video Editing' },
      { name: 'Syra Bhatt', role: 'Recipe Developer' },
      { name: 'Kendall Lloyd', role: 'Bake Night Leader' },
      { name: 'Emi Ren', role: 'Bake Night Leader' },
      { name: 'Kyle Wu', role: 'Bake Night Leader' },
      { name: 'Kelsey McCalla', role: 'Bake Night Leader' },
      { name: 'Mathias Nguyen-Van-Duong', role: 'Web Developer' },
    ],
  },
  {
    label: "Fall '25 – Fall '26",
    note: 'Founding team',
    officers: [
      { name: 'Myra Ridhuan', role: 'President & Co-Founder' },
      { name: 'Doris Lee', role: 'Vice President & Co-Founder' },
      { name: 'Mabel Li', role: 'Treasurer' },
      { name: 'Thanhloan Tran', role: 'Social Media' },
      { name: 'Matthew Bassily', role: 'Social Media' },
      { name: 'Krystal Lin', role: 'Outreach & Communications' },
      { name: 'Syra Bhatt', role: 'Recipe Developer' },
      { name: 'Kendall Lloyd', role: 'Bake Night Leader' },
      { name: 'Helena Purves', role: 'Bake Night Leader' },
      { name: 'Emi Ren', role: 'Bake Night Leader' },
    ],
  },
];
