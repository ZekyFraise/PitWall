import { ATTRIBUTE_META } from "./driver.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export const SCOUT_REVEAL_KEYS = Object.keys(ATTRIBUTE_META);

export function shuffledRevealKeys(rng) {
  const arr = [...SCOUT_REVEAL_KEYS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Each revealed characteristic gets its own random window width rather than one fixed value
// for the whole pass — maxWidth (set by recruiter force) only caps how wide that roll can go.
export function randomWidth(rng, minWidth, maxWidth) {
  return Math.round(minWidth + rng() * Math.max(0, maxWidth - minWidth));
}

// How many of the ~30 individual characteristics a scouting pass uncovers, scaled by
// recruiter discovery force.
const SCOUT_MIN_REVEAL = 4;
const SCOUT_FORCE_BONUS = 12;

// Shared by every path that can mark a scout-pool driver as scouted — the paid scoutDriver
// action, the passive recruiter auto-reveal, and free-scout event tips — so all of them
// produce the same windowed-attribute shape instead of leaving `scoutReveal` unset.
export function generateScoutReveal(rng, discoverySkill, precisionSkill) {
  const revealCount = Math.round(
    clamp(SCOUT_MIN_REVEAL + (discoverySkill / 99) * SCOUT_FORCE_BONUS, SCOUT_MIN_REVEAL, SCOUT_REVEAL_KEYS.length)
  );
  const maxWidth = clamp(40 - (precisionSkill / 99) * 36, 4, 40);
  const attributeWidths = {};
  shuffledRevealKeys(rng)
    .slice(0, revealCount)
    .forEach((key) => (attributeWidths[key] = randomWidth(rng, 4, maxWidth)));
  return { attributeWidths, potentialKnown: false, priceKnown: false, traitsKnown: false };
}
