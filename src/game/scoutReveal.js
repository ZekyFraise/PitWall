import { ATTRIBUTE_META, SUPER_STATS } from "./driver.js";

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
// recruiter discovery force. Floor raised from 4 to 5 (one per super stat, see below) — a
// weaker recruiter used to be as likely to leave a whole super stat permanently blank as not,
// which made scouting feel like it always surfaced "the same" handful of stats.
const SCOUT_MIN_REVEAL = 5;
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

  // Guarantee coverage: one random attribute from EACH of the 5 super stats gets revealed
  // first, so no super stat ever stays a total "?" after a basic scouting pass — the rest of
  // the reveal budget is then filled randomly from whatever's left (discipline attributes
  // included, same as before).
  const guaranteed = Object.values(SUPER_STATS).map((stat) => stat.attrs[Math.floor(rng() * stat.attrs.length)]);
  const remaining = shuffledRevealKeys(rng).filter((key) => !guaranteed.includes(key));
  const extraCount = Math.max(0, revealCount - guaranteed.length);
  [...guaranteed, ...remaining.slice(0, extraCount)].forEach((key) => (attributeWidths[key] = randomWidth(rng, 4, maxWidth)));

  return { attributeWidths, potentialKnown: false, priceKnown: false, traitsKnown: false };
}

// Staff only has 4 numeric skills (vs. a driver's ~30 attributes), so a scouting pass always
// reveals all of them at once — there's no meaningful "subset" to hide, only how wide each
// window is.
export function generateStaffScoutReveal(rng, discoverySkill, precisionSkill) {
  const maxWidth = clamp(40 - (precisionSkill / 99) * 36, 4, 40);
  const attributeWidths = {
    primary: randomWidth(rng, 4, maxWidth),
    secondary: randomWidth(rng, 4, maxWidth),
    communication: randomWidth(rng, 4, maxWidth),
    experience: randomWidth(rng, 4, maxWidth),
  };
  return { attributeWidths, traitsKnown: false };
}
