import { getGuardian } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import { allVisited, type ExperienceState } from '../experience/sceneState';

/** The one-line caption shown on the map (screen and headset share it). */
export function mapLine(state: ExperienceState): string {
  if (allVisited(state)) return PITCH.map.allAwake;
  if (state.justActivated) return PITCH.map.awakened(getGuardian(state.justActivated));
  return PITCH.map.intro;
}
