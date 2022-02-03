export type FiveLetters = [string, string, string, string, string];

export interface Clue {
  positionalMatches: FiveLetters;
  positionalNotMatches: FiveLetters;
  additionalRequiredLetters: string[];
  remainingMustNotContain: Set<string>;
}

export interface PlayAnalysis {
  guess: string;
  clue: Clue;
  colors: CellColors;
  validForHardMode: boolean;
  unusedClues: string[];
  remainingAnswers: RemainingAnswers;
  averageRemaining: { common: number; all: number } | undefined;
  commonWord: boolean;
}

export interface GuessAnalysis {
  beforeRemainingCounts: { common: number; other: number };
  plays: { user: PlayAnalysis; ai: PlayAnalysis };
}

export interface AIPlay {
  beforeRemainingCounts: { common: number; other: number };
  play: PlayAnalysis;
}

/** (a)bsent (p)resent (c)orrect */
export type CellColor = 'a' | 'p' | 'c';

export type CellColors = [
  CellColor,
  CellColor,
  CellColor,
  CellColor,
  CellColor,
];

export type RemainingEntry = [word: string, averageRemaining: number];
export type RemainingAverages = RemainingEntry[];
export type RemainingResult = {
  common: RemainingAverages;
  all: RemainingAverages;
};

export type RemainingAnswers = { common: string[]; other: string[] };