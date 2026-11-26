import type { GuardianId } from '../content/guardians';

/** `scan` only exists in AR mode, while the camera looks for the printed map. */
export type SceneId = 'welcome' | 'scan' | 'map' | GuardianId | 'finale';

/** ar: camera + printed map. vr: a headset session (WebXR). magic: plain screen, no hardware. */
export type ExperienceMode = 'ar' | 'vr' | 'magic';

export type ArStatus =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'tracking'
  | 'lost'
  | 'denied'
  | 'unsupported'
  | 'error';

export type NoticeCode = 'ar-denied' | 'ar-unsupported' | 'ar-error' | 'vr-error';

export interface Notice {
  code: NoticeCode;
}

/** Scenes the presenter may jump to directly. */
export type JumpTarget = Exclude<SceneId, 'scan'>;
