/**
 * The motion spec, as code rather than as scattered magic numbers.
 *
 * Every value here comes from design/motion-plan-*.html and is a decision that was
 * made in advance, not a default. Three of them are constraints rather than taste:
 *
 *   - Nothing loops. There is no idle animation in this file and none should be
 *     added: if motion runs while the user is doing nothing, it is decoration.
 *   - The measurement is linear. `EASE.linear` is used for the hold and for the
 *     streak count-up, because easing would imply a curve where there is only
 *     elapsed time. Everywhere else is allowed to be expressive.
 *   - Nothing animates that is not true. The milestone celebration is keyed on the
 *     on-chain streak value, so it cannot fire for a day that was not sealed.
 */

import {AccessibilityInfo, Easing, Vibration} from 'react-native';
import {useEffect, useState} from 'react';

/** Durations, in ms. */
export const DUR = {
  /** Press response. Short enough that the surface feels like it heard you. */
  press: 90,
  /** Release. A spring, so the control settles rather than snapping. */
  pressBack: 180,
  /** Tab underline drawing outward from the centre. */
  tab: 160,
  /** The streak count-up. Linear, and never longer than this. */
  countUp: 400,
  /** The vessel draining after an early release. Silent, no haptic. */
  drain: 220,
  /** Modal sheet rise. */
  sheet: 320,
  /** Scrim fade, slightly faster than the sheet so the sheet leads. */
  scrim: 200,
  /** Milestone pulse. Fires once per milestone, never on a loop. */
  pulse: 900,
  /** A resolved row settling into place. */
  resolve: 300,
} as const;

export const EASE = {
  /** A measurement has no curve. */
  linear: Easing.linear,
  /** cubic-bezier(.22,1,.36,1) - the touch response. */
  press: Easing.bezier(0.22, 1, 0.36, 1),
  /** cubic-bezier(.32,.72,0,1) - rises then settles. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
  /** cubic-bezier(.34,1.56,.64,1) - overshoots once, at milestones only. */
  milestone: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

/**
 * Haptics, through React Native's own Vibration module rather than a new
 * dependency. There is deliberately no haptic for failure anywhere in this app:
 * feedback that contradicts the outcome is worse than no feedback.
 */
export type HapticKind = 'impact' | 'tick' | 'success' | 'none';

export function haptic(kind: HapticKind) {
  if (kind === 'none') return;
  try {
    if (kind === 'success') {
      // Two pulses: the completion vocabulary, used only when something sealed.
      Vibration.vibrate([0, 60, 80, 60]);
    } else {
      Vibration.vibrate(kind === 'impact' ? 15 : 10);
    }
  } catch {
    // Vibration is best-effort; a missing motor must never break a round.
  }
}

/**
 * Reduced motion. When the platform asks for it, animations resolve instantly
 * instead of running - the same states, without the travel.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => alive && setReduced(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** The milestone ladder. The track shows real progress against the next rung. */
export function milestoneTarget(n: number): number {
  if (n <= 7) return 7;
  if (n <= 30) return 30;
  if (n <= 100) return 100;
  return Math.ceil(n / 100) * 100;
}

/** Progress toward the next rung, as 0..1. A quantity, not a decorative ring. */
export function milestoneFraction(n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(1, n / milestoneTarget(n)));
}

export function isMilestone(n: number): boolean {
  return n === 7 || n === 30 || n === 100 || (n > 100 && n % 100 === 0);
}
