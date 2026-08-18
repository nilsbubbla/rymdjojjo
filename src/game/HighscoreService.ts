import { Capacitor } from '@capacitor/core';
import type { GameLevel } from './levels';

export const GAME_VERSION = '1.0.0';
const PLAYER_NAME_KEY = 'rymdjojjo-player-name';
const LEGACY_LOCAL_SCORE_KEYS = ['rymdjojjo-best', 'rymdjojjo-local-scores', 'rymdjojjo-pending-scores'];
const PUBLIC_SERVER_BASE = 'https://www.fnirp.com/rymdresan';

export interface RunToken {
  run_id: string;
  started_at: string;
  expires_at: string;
}

export interface ScoreDetails {
  name: string;
  score: number;
  duration_ms: number;
  level: GameLevel;
  reached_moon: boolean;
  altitude: number;
  coins: number;
  lives_remaining: number;
  oliver_mode: boolean;
}

export interface ScoreSubmission extends Omit<ScoreDetails, 'oliver_mode'> {
  run_id: string;
  game_version: string;
  platform: 'web' | 'android';
}

export interface LeaderboardEntry {
  rank: number;
  id?: number;
  name: string;
  score: number;
  duration_ms?: number;
  level: number;
  reached_moon: boolean;
}

export interface LeaderboardPayload {
  ruleset: string;
  generated_at: string;
  entries: LeaderboardEntry[];
  unavailable?: boolean;
}

export interface SubmitResult {
  accepted: boolean;
  rank?: number;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function getBaseUrl(): string {
  const configured = import.meta.env.VITE_HIGHSCORE_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  if (Capacitor.isNativePlatform()) return PUBLIC_SERVER_BASE;
  if (window.location.pathname === '/rymdresan' || window.location.pathname.startsWith('/rymdresan/')) {
    return `${window.location.origin}/rymdresan`;
  }
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://192.168.50.107/rymdresan';
  }
  return `${window.location.origin}/rymdresan`;
}

async function requestJson<T>(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } } & T;
    if (!response.ok) throw new HttpError(response.status, body.error?.message || `HTTP ${response.status}`);
    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}

function asSubmission(runId: string, details: ScoreDetails): ScoreSubmission {
  const { oliver_mode: _oliverMode, ...globalDetails } = details;
  return {
    ...globalDetails,
    name: sanitizePlayerName(details.name),
    run_id: runId,
    game_version: GAME_VERSION,
    platform: Capacitor.isNativePlatform() ? 'android' : 'web',
  };
}

export function clearLegacyLocalScores(): void {
  LEGACY_LOCAL_SCORE_KEYS.forEach(key => localStorage.removeItem(key));
}

export function sanitizePlayerName(value: string): string {
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 15);
}

export function getPlayerName(): string {
  return sanitizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) || '');
}

export function setPlayerName(value: string): string {
  const name = sanitizePlayerName(value);
  if (name) localStorage.setItem(PLAYER_NAME_KEY, name);
  return name;
}

export async function beginHighscoreRun(): Promise<RunToken | null> {
  try {
    return await requestJson<RunToken>(`${getBaseUrl()}/api/v1/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    return null;
  }
}

export async function submitHighscore(runId: string | null, details: ScoreDetails): Promise<SubmitResult> {
  if (details.oliver_mode) throw new Error('Poäng från Oliverläget sparas inte.');
  const cleanName = sanitizePlayerName(details.name);
  if (!cleanName) throw new Error('Skriv ett namn.');
  const cleanDetails = { ...details, name: cleanName };
  setPlayerName(cleanName);
  if (!runId) throw new Error('Ingen global spelomgång kunde skapas.');
  const submission = asSubmission(runId, cleanDetails);
  return await requestJson<SubmitResult>(`${getBaseUrl()}/api/v1/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardPayload> {
  try {
    return await requestJson<LeaderboardPayload>(`${getBaseUrl()}/highscores.json?t=${Date.now()}`, {}, 5000);
  } catch {
    return {
      ruleset: GAME_VERSION,
      generated_at: new Date().toISOString(),
      entries: [],
      unavailable: true,
    };
  }
}
