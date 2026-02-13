/**
 * AI Service Client
 * Connects to the Guilloché AI Worker for parameter suggestions,
 * pattern recognition, and text-to-pattern generation.
 */

import type { PatternParams } from '@guilloche/shared';
import { browser } from '$app/environment';

// AI Worker URL (set via environment variable)
const AI_WORKER_URL = browser
  ? (import.meta.env.VITE_AI_WORKER_URL || 'https://guilloche-ai.workers.dev')
  : '';

export interface ParameterSuggestion {
  params: Partial<PatternParams>;
  confidence: number;
  keywords: string[];
  description: string;
}

export interface PatternRecognitionResult {
  params: PatternParams;
  confidence: number;
  suggestions: string[];
  similar_keywords: string[];
}

export interface TextToPatternResult {
  params: PatternParams;
  variations: PatternParams[];
  interpretation: string;
}

/**
 * AI Parameter Assistant
 * Get parameter suggestions based on style keywords
 */
export async function suggestParameters(keywords: string[]): Promise<ParameterSuggestion[]> {
  if (!keywords.length) {
    return [];
  }

  try {
    const response = await fetch(`${AI_WORKER_URL}/api/ai/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords }),
    });

    if (!response.ok) {
      throw new Error(`AI suggestion failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI suggestion error:', error);

    // Fallback to local keyword matching
    return fallbackSuggest(keywords);
  }
}

/**
 * Pattern Recognition Engine
 * Analyze an image and reverse-engineer pattern parameters
 */
export async function recognizePattern(imageFile: File): Promise<PatternRecognitionResult | null> {
  try {
    // Convert file to base64
    const base64 = await fileToBase64(imageFile);

    const response = await fetch(`${AI_WORKER_URL}/api/ai/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
    });

    if (!response.ok) {
      throw new Error(`Pattern recognition failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Pattern recognition error:', error);
    return null;
  }
}

/**
 * Text-to-Pattern Generative Design
 * Generate pattern parameters from natural language description
 */
export async function textToPattern(prompt: string): Promise<TextToPatternResult | null> {
  if (!prompt.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${AI_WORKER_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Text-to-pattern failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Text-to-pattern error:', error);

    // Fallback to keyword extraction
    return fallbackTextToPattern(prompt);
  }
}

/**
 * Get embeddings for semantic search
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${AI_WORKER_URL}/api/ai/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.status}`);
    }

    const result = await response.json();
    return result.embeddings || [];
  } catch (error) {
    console.error('Embedding error:', error);
    return [];
  }
}

// Helper: Convert File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fallback: Local keyword-based suggestions
const LOCAL_PRESETS: Record<string, Partial<PatternParams>> = {
  'elegant': { family: 'rose', k: 8, m: 0.15, symmetry: 8, lw: 1.5 },
  'classic': { family: 'hypo', k: 13, m: 0.22, symmetry: 1, lw: 1 },
  'modern': { family: 'liss', k: 4, m: 0.1, symmetry: 1, lw: 1.2 },
  'intricate': { family: 'hypo', k: 29, m: 0.4, symmetry: 8, lw: 0.6 },
  'simple': { family: 'rose', k: 3, m: 0, symmetry: 3, lw: 2 },
  'organic': { family: 'epi', k: 5, m: 0.3, symmetry: 5, lw: 1.5 },
  'geometric': { family: 'rose', k: 8, m: 0, symmetry: 8, lw: 1.5 },
  'spiral': { family: 'fermat', k: 8, m: 0.2, symmetry: 1, lw: 1 },
  'mandala': { family: 'rose', k: 12, m: 0.15, symmetry: 12, lw: 1 },
  'security': { family: 'hypo', k: 17, m: 0.25, symmetry: 1, lw: 0.5 },
  'gold': { startColor: '#FFD700', endColor: '#B8860B', bgColor: '#1a1a2e', useGradient: true },
  'neon': { startColor: '#00FF00', endColor: '#FF00FF', bgColor: '#000000', useGradient: true },
};

function fallbackSuggest(keywords: string[]): ParameterSuggestion[] {
  const matches: Partial<PatternParams>[] = [];

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase();
    for (const [key, params] of Object.entries(LOCAL_PRESETS)) {
      if (key.includes(lower) || lower.includes(key)) {
        matches.push(params);
      }
    }
  }

  if (matches.length === 0) {
    return [{
      params: LOCAL_PRESETS['classic'] || {},
      confidence: 0.3,
      keywords,
      description: 'Default pattern (no matches found)',
    }];
  }

  // Merge matches
  const merged: Partial<PatternParams> = {};
  for (const match of matches) {
    Object.assign(merged, match);
  }

  return [{
    params: merged,
    confidence: 0.7,
    keywords,
    description: `Pattern based on: ${keywords.join(', ')}`,
  }];
}

function fallbackTextToPattern(prompt: string): TextToPatternResult {
  // Extract keywords from prompt
  const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const suggestions = fallbackSuggest(words);

  const defaultParams: PatternParams = {
    family: 'hypo',
    R: 200,
    r: 60,
    d: 100,
    k: 10,
    m: 0.2,
    mf: 5,
    phase: 0,
    rot: 0,
    s: 1,
    steps: 10000,
    lw: 1,
    adaptiveSteps: true,
    symmetry: 1,
    reflectH: false,
    reflectV: false,
    kaleidoscope: false,
    aa: true,
    dashed: false,
    dashRatio: 0.5,
    useGradient: true,
    startColor: '#4f46e5',
    endColor: '#7c3aed',
    bgColor: '#0f0f23',
    glow: 0,
    noise: 0,
    vignette: false,
    blendMode: 'normal',
  };

  return {
    params: { ...defaultParams, ...suggestions[0]?.params },
    variations: [],
    interpretation: `Pattern generated from: ${words.join(', ')}`,
  };
}
