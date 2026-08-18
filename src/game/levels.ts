export type GameLevel = 1 | 2 | 3 | 4 | 5;

export interface LevelConfig {
  level: GameLevel;
  label: string;
  worldSpeed: number;
  horizontalSpeed: number;
  climbSpeed: number;
  controlSpeed: number;
  obstacleInterval: number;
  coinInterval: number;
  powerInterval: number;
}

export const LEVEL_CONFIGS: readonly LevelConfig[] = [
  { level: 1, label: 'GRUNDFART', worldSpeed: 1, horizontalSpeed: 1, climbSpeed: 1, controlSpeed: 1, obstacleInterval: 1, coinInterval: 1, powerInterval: 1 },
  { level: 2, label: 'SNABB', worldSpeed: 1.18, horizontalSpeed: 1.12, climbSpeed: 1.08, controlSpeed: 1.08, obstacleInterval: 0.86, coinInterval: 0.92, powerInterval: 0.94 },
  { level: 3, label: 'TURBO', worldSpeed: 1.42, horizontalSpeed: 1.27, climbSpeed: 1.2, controlSpeed: 1.16, obstacleInterval: 0.7, coinInterval: 0.82, powerInterval: 0.87 },
  { level: 4, label: 'EXTREM', worldSpeed: 1.76, horizontalSpeed: 1.45, climbSpeed: 1.38, controlSpeed: 1.27, obstacleInterval: 0.52, coinInterval: 0.7, powerInterval: 0.78 },
  { level: 5, label: 'MAXHASTIGHET', worldSpeed: 2.4, horizontalSpeed: 1.72, climbSpeed: 1.65, controlSpeed: 1.42, obstacleInterval: 0.3, coinInterval: 0.52, powerInterval: 0.64 }
] as const;

export const MAX_LEVEL = 5;
export const UNLOCKED_LEVEL_KEY = 'rymdjojjo-unlocked-level';
export const SELECTED_LEVEL_KEY = 'rymdjojjo-selected-level';

export function toGameLevel(value: unknown): GameLevel {
  const numeric = Number(value);
  return Math.min(MAX_LEVEL, Math.max(1, Number.isFinite(numeric) ? Math.round(numeric) : 1)) as GameLevel;
}

export function getLevelConfig(level: GameLevel): LevelConfig {
  return LEVEL_CONFIGS[level - 1]!;
}
