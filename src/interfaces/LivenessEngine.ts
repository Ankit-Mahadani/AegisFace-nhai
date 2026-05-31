import type { NormPoint } from './FaceDetector';

export type ChallengeType = 'BLINK' | 'SMILE' | 'TURN_LEFT' | 'TURN_RIGHT';

export type ChallengeStatus = 'waiting' | 'in_progress' | 'passed' | 'failed' | 'timeout';

export interface Challenge {
  type: ChallengeType;
  status: ChallengeStatus;
  startedAt?: number;
}

export interface LivenessState {
  challenges: Challenge[];
  currentIndex: number;
  /** null until final decision */
  passed: boolean | null;
  startedAt: number;
}

export interface LivenessEngine {
  /** Start a new session — generates randomised challenge sequence. */
  start(): LivenessState;

  /**
   * Feed the next frame's landmarks.
   * Returns updated state; when state.passed !== null the session is complete.
   */
  update(state: LivenessState, landmarks: NormPoint[], blendshapes?: Record<string, number>): LivenessState;

  /** Reset / abort current session. */
  reset(): void;
}
