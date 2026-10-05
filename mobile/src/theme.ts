/**
 * Design tokens.
 *
 * Taken from Zay Studio (`Zaygal/Zay-Studio`): its `tailwind.config.ts` colours
 * and the behaviour its `globals.css` sets. The app previously used a navy and
 * electric-yellow palette invented for it, which was neither mine to invent nor
 * as good.
 *
 * `signal` is reserved. It marks states that are actually true - a sealed day,
 * a live streak, a hold in progress - and nothing decorative. The moment it
 * decorates something it stops carrying that meaning, and this product's whole
 * claim is that its marks mean something.
 */

export const T = {
  ink: '#0B0D0F', // screen background
  panel: '#131518', // raised surfaces
  hairline: '#232629', // separation, not decoration
  paper: '#EAEAE7', // primary text
  muted: '#8A8F98', // secondary text
  steel: '#5B7FB8', // links, the chain, secondary actions
  steeldim: '#3E5578',
  signal: '#4ADE80', // the seal, the streak, the hold. Nothing else.
  alert: '#E5654A', // failures that need action
} as const;

/**
 * The empty vessel.
 *
 * Apple Fitness's Expo guide sets its ring track to the fill colour at 22%
 * opacity, and it is right for the same reason here: an unfilled area drawn in
 * the fill's own hue reads as a container being filled, where grey reads as
 * empty space with something in front of it.
 */
export const signalTrack = 'rgba(74, 222, 128, 0.22)';

/** Type scale. Numerals are tabular wherever they count or change. */
export const type = {
  display: {color: T.paper, fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6},
  section: {color: T.paper, fontSize: 15, fontWeight: '700' as const},
  body: {color: T.muted, fontSize: 14, lineHeight: 21},
  /** Sentence prose at readable size. Never for labels. */
  lead: {color: T.paper, fontSize: 19, lineHeight: 28, fontWeight: '600' as const},
  /** Labels are mono, upper case, wide. Mirrors .mono-label in the sample. */
  label: {
    color: T.muted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.76, // 0.16em at 11px
    textTransform: 'uppercase' as const,
  },
  /** Any figure that changes. Tabular so it does not reflow as it counts. */
  metric: {
    color: T.paper,
    fontSize: 13,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;
