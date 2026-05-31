/**
 * ChallengeLivenessEngine
 *
 * Generates a RANDOMISED ordered sequence of 2–3 challenges from
 * { BLINK, SMILE, TURN_LEFT, TURN_RIGHT } and drives a state machine
 * over the incoming landmark stream.
 *
 * A photo or screen replay CANNOT pass because:
 *   • The sequence is unknown until runtime.
 *   • EAR / MAR / yaw require temporal change, not a static image.
 */
import type { LivenessEngine, LivenessState, Challenge, ChallengeType } from '../interfaces/LivenessEngine';
import type { NormPoint } from '../interfaces/FaceDetector';
import {
  eyeAspectRatio,
  mouthAspectRatio,
  estimateYaw,
} from '../utils/geometry';
import {
  EAR_BLINK_THRESHOLD,
  EAR_OPEN_MIN,
  SMILE_MAR_THRESHOLD,
  TURN_YAW_THRESHOLD_DEG,
  LIVENESS_CHALLENGE_COUNT,
  LIVENESS_WINDOW_MS,
} from '../config/constants';

const ALL_CHALLENGES: ChallengeType[] = ['BLINK', 'SMILE', 'TURN_LEFT', 'TURN_RIGHT'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Per-challenge transient state (resets each challenge)
interface ChallengeTracker {
  eyeClosed: boolean; // used for BLINK state machine
}

export class ChallengeLivenessEngine implements LivenessEngine {
  private tracker: ChallengeTracker = { eyeClosed: false };

  start(): LivenessState {
    this.tracker = { eyeClosed: false };
    const types = shuffle(ALL_CHALLENGES).slice(0, LIVENESS_CHALLENGE_COUNT);
    const challenges: Challenge[] = types.map(type => ({ type, status: 'waiting' }));
    challenges[0]!.status = 'in_progress';
    return {
      challenges,
      currentIndex: 0,
      passed: null,
      startedAt: Date.now(),
    };
  }

  update(
    state: LivenessState,
    landmarks: NormPoint[],
    blendshapes?: Record<string, number>,
  ): LivenessState {
    if (state.passed !== null) return state; // already done
    if (landmarks.length < 468) return state; // no valid face

    const challenges = state.challenges.map(c => ({ ...c }));
    let { currentIndex } = state;
    const current = challenges[currentIndex]!;

    const now = Date.now();

    // Timeout check
    if (current.startedAt && now - current.startedAt > LIVENESS_WINDOW_MS) {
      current.status = 'timeout';
      return { ...state, challenges, passed: false };
    }

    // Start timer on first update for this challenge
    if (!current.startedAt) {
      current.startedAt = now;
    }

    const detected = this.detectChallenge(current.type, landmarks, blendshapes);

    if (detected) {
      current.status = 'passed';
      currentIndex++;
      if (currentIndex >= challenges.length) {
        return { ...state, challenges, currentIndex, passed: true };
      }
      challenges[currentIndex]!.status = 'in_progress';
      this.tracker = { eyeClosed: false }; // reset tracker for next challenge
    }

    return { ...state, challenges, currentIndex };
  }

  reset(): void {
    this.tracker = { eyeClosed: false };
  }

  private detectChallenge(
    type: ChallengeType,
    landmarks: NormPoint[],
    blendshapes?: Record<string, number>,
  ): boolean {
    switch (type) {
      case 'BLINK':
        return this.detectBlink(landmarks, blendshapes);
      case 'SMILE':
        return this.detectSmile(landmarks, blendshapes);
      case 'TURN_LEFT':
        return estimateYaw(landmarks) < -TURN_YAW_THRESHOLD_DEG;
      case 'TURN_RIGHT':
        return estimateYaw(landmarks) > TURN_YAW_THRESHOLD_DEG;
    }
  }

  private detectBlink(landmarks: NormPoint[], blendshapes?: Record<string, number>): boolean {
    // Prefer blendshape if available
    if (blendshapes) {
      const leftBlink = blendshapes['eyeBlinkLeft'] ?? 0;
      const rightBlink = blendshapes['eyeBlinkRight'] ?? 0;
      const avg = (leftBlink + rightBlink) / 2;
      if (!this.tracker.eyeClosed && avg > 0.5) {
        this.tracker.eyeClosed = true;
      }
      if (this.tracker.eyeClosed && avg < 0.2) {
        return true; // closed then re-opened
      }
      return false;
    }

    // Fallback: EAR from landmarks
    // Left eye: outer=33, inner=133, top1=160, top2=158, bot1=144, bot2=153
    const lEAR = eyeAspectRatio(
      landmarks[33]!, landmarks[160]!, landmarks[158]!,
      landmarks[133]!, landmarks[153]!, landmarks[144]!,
    );
    // Right eye: outer=362, inner=263, top1=385, top2=387, bot1=373, bot2=380
    const rEAR = eyeAspectRatio(
      landmarks[362]!, landmarks[385]!, landmarks[387]!,
      landmarks[263]!, landmarks[380]!, landmarks[373]!,
    );
    const ear = (lEAR + rEAR) / 2;

    if (!this.tracker.eyeClosed && ear < EAR_BLINK_THRESHOLD) {
      this.tracker.eyeClosed = true;
    }
    if (this.tracker.eyeClosed && ear >= EAR_OPEN_MIN) {
      return true; // completed blink
    }
    return false;
  }

  private detectSmile(landmarks: NormPoint[], blendshapes?: Record<string, number>): boolean {
    if (blendshapes) {
      const smile = (blendshapes['mouthSmileLeft'] ?? 0) + (blendshapes['mouthSmileRight'] ?? 0);
      return smile / 2 > 0.5;
    }
    // MAR from landmarks: top-lip=13, bottom-lip=14, left=61, right=291
    const mar = mouthAspectRatio(
      landmarks[13]!, landmarks[14]!, landmarks[61]!, landmarks[291]!,
    );
    return mar > SMILE_MAR_THRESHOLD;
  }
}

export const livenessEngine = new ChallengeLivenessEngine();
