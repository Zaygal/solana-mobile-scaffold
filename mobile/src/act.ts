import {ACT_REQUIREMENT, ActMetrics, ActOutcome, qualifies} from './round';

/**
 * The attestation layer.
 *
 * The product claim is that a phone can attest a physical act. That claim has a
 * real engineering cost: motion sensors and camera frames both need native
 * modules, and both are spoofable on a rooted device. Two consequences are
 * designed in rather than discovered later:
 *
 *   1. The interface comes first, so the rest of the app can be built and the
 *      mechanism swapped without touching the UI.
 *   2. The attestor must report its own `source`, which the UI surfaces. The app
 *      never implies a stronger guarantee than it can make.
 *
 * This is honest for a solo game: cheating only defrauds the person cheating.
 * It would be indefensible if anything pooled or transferable hung off it.
 */

export type Attestor = {
  /** Where the observation comes from, reported to the user verbatim. */
  source: ActMetrics['source'];
  /** Whether this attestor can actually run on this device right now. */
  available(): Promise<boolean>;
  /** Observe for one attempt window and report what was seen. */
  observe(signal?: {cancelled: boolean}): Promise<ActOutcome>;
};

/**
 * Interim attestor. It requires the user to hold a control for the full window,
 * which is a commitment but is NOT hardware evidence, and says so.
 *
 * Replace with a motion or camera attestor. This exists so the round logic, the
 * transaction path and the UI can all be finished and verified first.
 */
export function createHoldAttestor(): Attestor {
  return {
    source: 'manual',
    async available() {
      return true;
    },
    async observe(signal) {
      const startedAt = Date.now();
      // The UI drives the physical hold; this measures the elapsed time only.
      return new Promise<ActOutcome>(resolve => {
        const timer = setInterval(() => {
          if (signal?.cancelled) {
            clearInterval(timer);
            resolve(
              qualifies({
                peak: 0,
                durationMs: Date.now() - startedAt,
                source: 'manual',
              }),
            );
            return;
          }
          const elapsed = Date.now() - startedAt;
          if (elapsed >= ACT_REQUIREMENT.windowMs) {
            clearInterval(timer);
            resolve(qualifies({peak: 1, durationMs: elapsed, source: 'manual'}));
          }
        }, 100);
      });
    },
  };
}

/**
 * Where the real attestors plug in. Each is a separate module so a native
 * failure cannot take the rest of the app with it.
 *
 *   createMotionAttestor()  - accelerometer/gyroscope via a native module
 *   createCameraAttestor()  - frame-difference motion via react-native-vision-camera,
 *                             which is already proven to build in this repo family
 *
 * Neither is implemented yet. `selectAttestor` reports what is really available
 * rather than pretending.
 */
export async function selectAttestor(): Promise<Attestor> {
  const hold = createHoldAttestor();
  if (await hold.available()) return hold;
  throw new Error('no attestor available on this device');
}
