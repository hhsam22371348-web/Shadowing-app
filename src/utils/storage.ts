import { Sentence, SentenceProgress } from '../types';
import { DEFAULT_SENTENCES } from '../constants/defaultData';

const SENTENCES_STORAGE_KEY = 'zootopia_shadowing_sentences_v4';
const PROGRESS_STORAGE_KEY = 'zootopia_shadowing_progress_v1';
const DUB_TAKES_STORAGE_KEY = 'zootopia_shadowing_dub_takes_v1';

// In-memory fallback if localStorage fails or is blocked
let inMemorySentences: Sentence[] = [...DEFAULT_SENTENCES];
let inMemoryProgress: Record<number, SentenceProgress> = {};
let inMemoryDubTakes = 0;

export function loadSentences(): Sentence[] {
  try {
    const raw = localStorage.getItem(SENTENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: Sentence) => {
          const defaultMatch = DEFAULT_SENTENCES.find((d) => d.id === item.id);
          return {
            ...item,
            chunks:
              Array.isArray(item.chunks) && item.chunks.length > 0
                ? item.chunks
                : defaultMatch && defaultMatch.text === item.text
                ? defaultMatch.chunks
                : undefined,
            soundTip:
              item.soundTip !== undefined
                ? item.soundTip
                : defaultMatch && defaultMatch.text === item.text
                ? defaultMatch.soundTip
                : undefined,
          };
        });
      }
    }
    // Clean up older v1 / v2 / v3 keys
    localStorage.removeItem('zootopia_shadowing_sentences_v1');
    localStorage.removeItem('zootopia_shadowing_sentences_v2');
    localStorage.removeItem('zootopia_shadowing_sentences_v3');
  } catch (e) {
    console.warn('Failed to load sentences from localStorage, using fallback', e);
  }
  return [...DEFAULT_SENTENCES];
}

export function saveSentences(sentences: Sentence[]): boolean {
  inMemorySentences = sentences;
  try {
    localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(sentences));
    return true;
  } catch (e) {
    console.warn('Failed to save sentences to localStorage', e);
    return false;
  }
}

export function loadProgress(): Record<number, SentenceProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load progress from localStorage', e);
  }
  return inMemoryProgress;
}

export function saveProgress(progress: Record<number, SentenceProgress>): boolean {
  inMemoryProgress = progress;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (e) {
    console.warn('Failed to save progress to localStorage', e);
    return false;
  }
}

export function loadDubTakes(): number {
  try {
    const raw = localStorage.getItem(DUB_TAKES_STORAGE_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        inMemoryDubTakes = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load dubTakes from localStorage', e);
  }
  return inMemoryDubTakes;
}

export function saveDubTakes(count: number): boolean {
  inMemoryDubTakes = count;
  try {
    localStorage.setItem(DUB_TAKES_STORAGE_KEY, String(count));
    return true;
  } catch (e) {
    console.warn('Failed to save dubTakes to localStorage', e);
    return false;
  }
}

export function getSentenceProgress(
  progressMap: Record<number, SentenceProgress>,
  sentenceId: number
): SentenceProgress {
  if (progressMap[sentenceId]) {
    return progressMap[sentenceId];
  }
  return {
    id: sentenceId,
    plays: 0,
    recordings: 0,
    selfCheck: [null, null, null],
    status: 'new',
  };
}

export function exportSentencesJSON(sentences: Sentence[]): string {
  return JSON.stringify(sentences, null, 2);
}

export function validateAndParseSentencesJSON(raw: string): { valid: boolean; data?: Sentence[]; error?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { valid: false, error: 'Expected an array of sentences.' };
    }
    const validated: Sentence[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (typeof item !== 'object' || item === null) {
        return { valid: false, error: `Item at index ${i} is not a valid object.` };
      }
      if (typeof item.text !== 'string' || !item.text.trim()) {
        return { valid: false, error: `Sentence ${i + 1} is missing required text.` };
      }
      const start = Number(item.start);
      const end = Number(item.end);
      if (isNaN(start) || isNaN(end) || start < 0 || end > 70 || end <= start) {
        return {
          valid: false,
          error: `Sentence ${i + 1} has invalid time range (start: ${item.start}, end: ${item.end}). Must be between 0 and 70 seconds with end > start.`,
        };
      }
      validated.push({
        id: item.id || Date.now() + i,
        speaker: typeof item.speaker === 'string' && item.speaker.trim() ? item.speaker.trim() : 'Speaker',
        text: item.text.trim(),
        korean: typeof item.korean === 'string' ? item.korean.trim() : '',
        stress: Array.isArray(item.stress) ? item.stress.map((s: unknown) => String(s).trim()) : [],
        start: Math.round(start * 10) / 10,
        end: Math.round(end * 10) / 10,
        chunks: Array.isArray(item.chunks)
          ? item.chunks.map((c: unknown) => String(c).trim()).filter((c: string) => c.length > 0)
          : undefined,
        soundTip: typeof item.soundTip === 'string' ? item.soundTip.trim() : undefined,
      });
    }
    return { valid: true, data: validated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON format';
    return { valid: false, error: message };
  }
}
