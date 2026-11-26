/**
 * Tērvete / LVM brand tokens used by the 3D scene (CSS mirrors them in styles/tokens.css).
 * Source: https://atputa.lvm.lv (site CSS) and the mascot illustrations in the project Figma board.
 */
export const BRAND = {
  name: 'Tērvete',
  title: 'Tērvete Awakens',
  subtitle: 'Five Senses Trail',
  /** ASSUMPTION: tagline read from the park sign in the Figma mascot illustration. Confirm before publishing. */
  tagline: 'Atklāj · Pēti · Sajūti',
  colors: {
    green: '#046241',
    greenDark: '#00291b',
    sage: '#96b693',
    leaf: '#4a7729',
    gold: '#e2aa18',
    ink: '#212529',
    // Warm natural tones for wood, bark and light (picked from the mascot illustrations).
    wood: '#8a5a33',
    woodLight: '#c79a62',
    bark: '#5e3b22',
    cream: '#f3e9cf',
    moss: '#6c8f3a',
  },
} as const;
