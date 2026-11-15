export interface Sentence {
  id: number;
  speaker: string;
  text: string;
  korean: string;
  stress: string[];
  start: number;
  end: number;
  chunks?: string[];
  soundTip?: string;
}

export type Rating = 'good' | 'okay' | 'need_practice' | null;

export interface SentenceProgress {
  id: number;
  plays: number;
  recordings: number;
  selfCheck: [Rating, Rating, Rating]; // [speed, stress, intonation]
  status: 'new' | 'practiced' | 'done';
}

export type ShadowingStepId = 1 | 2 | 3 | 4;

export interface StepInfo {
  step: ShadowingStepId;
  title: string;
  koreanTitle: string;
  instruction: string;
  koreanInstruction: string;
  defaultTextHidden: boolean;
}

export type ScreenType = 'start' | 'list' | 'practice' | 'edit' | 'finish' | 'dub';
