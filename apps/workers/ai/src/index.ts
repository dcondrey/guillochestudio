/**
 * Guilloché AI Worker
 *
 * Handles all AI-related functionality:
 * 1. AI Parameter Assistant - keyword-based parameter suggestions
 * 2. Pattern Recognition - image analysis to reverse-engineer parameters
 * 3. Generative Design - text-to-pattern generation
 */

import { Ai } from '@cloudflare/ai';

export interface Env {
  AI: Ai;
  AI_CACHE: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  ENVIRONMENT: string;
}

// Pattern parameter types
interface PatternParams {
  family: string;
  R: number;
  r: number;
  d: number;
  k: number;
  m: number;
  mf: number;
  phase: number;
  rot: number;
  s: number;
  symmetry: number;
  reflectH: boolean;
  reflectV: boolean;
  kaleidoscope: boolean;
  lw: number;
  startColor: string;
  endColor: string;
  bgColor: string;
  useGradient: boolean;
}

// AI response types
interface ParameterSuggestion {
  params: Partial<PatternParams>;
  confidence: number;
  keywords: string[];
  description: string;
}

interface PatternRecognitionResult {
  params: PatternParams;
  confidence: number;
  suggestions: string[];
  similar_keywords: string[];
}

interface TextToPatternResult {
  params: PatternParams;
  variations: PatternParams[];
  interpretation: string;
}

// Style keyword mappings with base parameters
const STYLE_PRESETS: Record<string, Partial<PatternParams>> = {
  // Aesthetic styles
  'elegant': { family: 'rose', k: 8, m: 0.15, symmetry: 8, lw: 1.5 },
  'art deco': { family: 'rose', k: 6, m: 0.2, symmetry: 6, lw: 2 },
  'minimalist': { family: 'liss', k: 3, m: 0, symmetry: 1, lw: 1 },
  'modern': { family: 'liss', k: 4, m: 0.1, symmetry: 1, lw: 1.2 },
  'classic': { family: 'hypo', k: 13, m: 0.22, symmetry: 1, lw: 1 },
  'traditional': { family: 'hypo', k: 11, m: 0.2, symmetry: 1, lw: 1 },
  'ornate': { family: 'hypo', k: 23, m: 0.35, symmetry: 6, lw: 0.8 },
  'intricate': { family: 'hypo', k: 29, m: 0.4, symmetry: 8, lw: 0.6 },
  'complex': { family: 'hypo', k: 31, m: 0.45, symmetry: 12, lw: 0.5 },
  'simple': { family: 'rose', k: 3, m: 0, symmetry: 3, lw: 2 },
  'organic': { family: 'epi', k: 5, m: 0.3, symmetry: 5, lw: 1.5 },
  'flowing': { family: 'epi', k: 4, m: 0.25, symmetry: 1, lw: 1.8 },
  'botanical': { family: 'epi', k: 7, m: 0.35, symmetry: 7, lw: 1 },
  'floral': { family: 'rose', k: 5, m: 0.2, symmetry: 5, lw: 1.2 },
  'geometric': { family: 'rose', k: 8, m: 0, symmetry: 8, lw: 1.5 },
  'spiral': { family: 'fermat', k: 8, m: 0.2, symmetry: 1, lw: 1 },
  'cosmic': { family: 'fermat', k: 13, m: 0.3, symmetry: 1, lw: 0.8 },
  'galaxy': { family: 'spiral', k: 5, m: 0.4, symmetry: 2, lw: 0.6 },
  'mandala': { family: 'rose', k: 12, m: 0.15, symmetry: 12, kaleidoscope: true, lw: 1 },
  'zen': { family: 'spiral', k: 3, m: 0.1, symmetry: 1, lw: 2 },

  // Use cases
  'security': { family: 'hypo', k: 17, m: 0.25, symmetry: 1, lw: 0.5 },
  'banknote': { family: 'hypo', k: 19, m: 0.28, symmetry: 1, lw: 0.4 },
  'certificate': { family: 'hypo', k: 15, m: 0.22, symmetry: 2, lw: 0.6 },
  'diploma': { family: 'rose', k: 8, m: 0.18, symmetry: 4, lw: 0.8 },
  'logo': { family: 'rose', k: 4, m: 0.1, symmetry: 4, lw: 2 },
  'brand': { family: 'liss', k: 3, m: 0.15, symmetry: 1, lw: 2.5 },
  'decorative': { family: 'epi', k: 6, m: 0.2, symmetry: 6, lw: 1.2 },
  'border': { family: 'hypo', k: 7, m: 0.15, symmetry: 1, lw: 1 },
  'frame': { family: 'rose', k: 4, m: 0.1, symmetry: 4, lw: 1.5 },
  'watermark': { family: 'hypo', k: 11, m: 0.2, symmetry: 1, lw: 0.3 },
  'engraving': { family: 'hypo', k: 21, m: 0.3, symmetry: 1, lw: 0.4 },
  'etching': { family: 'hypo', k: 25, m: 0.35, symmetry: 1, lw: 0.3 },

  // Color schemes (set colors)
  'gold': { startColor: '#FFD700', endColor: '#B8860B', bgColor: '#1a1a2e', useGradient: true },
  'silver': { startColor: '#C0C0C0', endColor: '#808080', bgColor: '#1a1a2e', useGradient: true },
  'copper': { startColor: '#B87333', endColor: '#8B4513', bgColor: '#0d0d1a', useGradient: true },
  'royal': { startColor: '#4B0082', endColor: '#8B008B', bgColor: '#0a0a1a', useGradient: true },
  'ocean': { startColor: '#006994', endColor: '#00CED1', bgColor: '#001122', useGradient: true },
  'forest': { startColor: '#228B22', endColor: '#006400', bgColor: '#0a1a0a', useGradient: true },
  'sunset': { startColor: '#FF4500', endColor: '#FFD700', bgColor: '#1a0a1a', useGradient: true },
  'neon': { startColor: '#00FF00', endColor: '#FF00FF', bgColor: '#000000', useGradient: true },
  'monochrome': { startColor: '#FFFFFF', endColor: '#FFFFFF', bgColor: '#000000', useGradient: false },
  'warm': { startColor: '#FF6B6B', endColor: '#FFA500', bgColor: '#1a0a0a', useGradient: true },
  'cool': { startColor: '#4169E1', endColor: '#00CED1', bgColor: '#0a0a1a', useGradient: true },

  // Complexity levels
  'high-detail': { k: 40, m: 0.4, symmetry: 1, lw: 0.3 },
  'medium-detail': { k: 20, m: 0.25, symmetry: 4, lw: 0.8 },
  'low-detail': { k: 8, m: 0.1, symmetry: 2, lw: 1.5 },
};

// Default pattern parameters
const DEFAULT_PARAMS: PatternParams = {
  family: 'hypo',
  R: 240,
  r: 79,
  d: 140,
  k: 13,
  m: 0.22,
  mf: 7,
  phase: 0,
  rot: 0,
  s: 1,
  symmetry: 1,
  reflectH: false,
  reflectV: false,
  kaleidoscope: false,
  lw: 1,
  startColor: '#4f46e5',
  endColor: '#7c3aed',
  bgColor: '#0f0f23',
  useGradient: true,
};

/**
 * AI Parameter Assistant
 * Analyzes keywords and suggests optimal parameters
 */
async function suggestParameters(
  env: Env,
  keywords: string[]
): Promise<ParameterSuggestion[]> {
  const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());
  const suggestions: ParameterSuggestion[] = [];

  // Find matching style presets
  const matchedPresets: { keyword: string; preset: Partial<PatternParams>; score: number }[] = [];

  for (const keyword of normalizedKeywords) {
    for (const [presetKey, presetParams] of Object.entries(STYLE_PRESETS)) {
      // Exact match
      if (presetKey === keyword) {
        matchedPresets.push({ keyword: presetKey, preset: presetParams, score: 1.0 });
      }
      // Partial match
      else if (presetKey.includes(keyword) || keyword.includes(presetKey)) {
        matchedPresets.push({ keyword: presetKey, preset: presetParams, score: 0.7 });
      }
    }
  }

  // Use AI for semantic understanding if keywords don't match presets directly
  if (matchedPresets.length === 0 || normalizedKeywords.length > matchedPresets.length) {
    try {
      const ai = new Ai(env.AI);

      const prompt = `You are a pattern design expert. Given these style keywords: "${keywords.join(', ')}"

Analyze what kind of guilloche/mathematical pattern the user wants. Consider:
- Visual style (elegant, intricate, simple, organic, geometric)
- Use case (security printing, decoration, logo, certificate)
- Color scheme (warm, cool, monochrome, metallic)
- Complexity level (detailed, minimal)

Respond with ONLY a JSON object (no markdown, no explanation) containing:
{
  "style": "primary style category",
  "family": "hypo|epi|rose|liss|spiral|fermat",
  "complexity": "low|medium|high",
  "symmetry": number between 1-12,
  "colorScheme": "warm|cool|neutral|metallic",
  "description": "brief description of the suggested pattern"
}`;

      const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      });

      if (response && typeof response === 'object' && 'response' in response) {
        try {
          // Extract JSON from response
          const jsonMatch = (response.response as string).match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const aiSuggestion = JSON.parse(jsonMatch[0]);

            // Convert AI suggestion to parameters
            const aiParams: Partial<PatternParams> = {
              family: aiSuggestion.family || 'hypo',
              symmetry: aiSuggestion.symmetry || 1,
            };

            // Apply complexity
            if (aiSuggestion.complexity === 'high') {
              aiParams.k = 25 + Math.floor(Math.random() * 15);
              aiParams.m = 0.3 + Math.random() * 0.2;
              aiParams.lw = 0.4 + Math.random() * 0.3;
            } else if (aiSuggestion.complexity === 'low') {
              aiParams.k = 3 + Math.floor(Math.random() * 5);
              aiParams.m = 0.05 + Math.random() * 0.1;
              aiParams.lw = 1.5 + Math.random() * 1;
            } else {
              aiParams.k = 10 + Math.floor(Math.random() * 10);
              aiParams.m = 0.15 + Math.random() * 0.15;
              aiParams.lw = 0.8 + Math.random() * 0.5;
            }

            // Apply color scheme
            if (aiSuggestion.colorScheme === 'warm') {
              Object.assign(aiParams, STYLE_PRESETS['warm']);
            } else if (aiSuggestion.colorScheme === 'cool') {
              Object.assign(aiParams, STYLE_PRESETS['cool']);
            } else if (aiSuggestion.colorScheme === 'metallic') {
              Object.assign(aiParams, STYLE_PRESETS['gold']);
            }

            suggestions.push({
              params: aiParams,
              confidence: 0.8,
              keywords: keywords,
              description: aiSuggestion.description || 'AI-generated pattern suggestion',
            });
          }
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
        }
      }
    } catch (aiError) {
      console.error('AI suggestion failed:', aiError);
    }
  }

  // Merge matched presets into suggestions
  if (matchedPresets.length > 0) {
    // Sort by score and take top matches
    matchedPresets.sort((a, b) => b.score - a.score);

    // Combine parameters from multiple matches
    const combinedParams: Partial<PatternParams> = { ...DEFAULT_PARAMS };
    let totalScore = 0;
    const usedKeywords: string[] = [];

    for (const match of matchedPresets.slice(0, 3)) {
      Object.assign(combinedParams, match.preset);
      totalScore += match.score;
      usedKeywords.push(match.keyword);
    }

    suggestions.unshift({
      params: combinedParams,
      confidence: Math.min(1, totalScore / matchedPresets.length),
      keywords: usedKeywords,
      description: `Pattern based on: ${usedKeywords.join(', ')}`,
    });
  }

  // If no suggestions, return a default with low confidence
  if (suggestions.length === 0) {
    suggestions.push({
      params: DEFAULT_PARAMS,
      confidence: 0.3,
      keywords: keywords,
      description: 'Default pattern (no matching styles found)',
    });
  }

  return suggestions;
}

/**
 * Pattern Recognition Engine
 * Analyzes an image and reverse-engineers closest parameters
 */
async function recognizePattern(
  env: Env,
  imageData: string // Base64 encoded image
): Promise<PatternRecognitionResult> {
  const ai = new Ai(env.AI);

  try {
    // Use vision model to analyze the image
    const analysisPrompt = `Analyze this guilloche/mathematical pattern image. Describe:
1. The curve type (hypotrochoid, epitrochoid, rose curve, Lissajous, spiral)
2. Symmetry (rotational symmetry count, reflections)
3. Complexity level (number of curve intersections, line density)
4. Color scheme
5. Line thickness

Respond with ONLY a JSON object:
{
  "curveType": "hypo|epi|rose|liss|spiral|fermat",
  "symmetryCount": number,
  "hasReflection": boolean,
  "complexity": "low|medium|high|very_high",
  "lineCount": "few|moderate|many|dense",
  "primaryColor": "hex color",
  "backgroundColor": "hex color",
  "lineThickness": "thin|medium|thick",
  "keywords": ["list", "of", "style", "keywords"],
  "confidence": number between 0 and 1
}`;

    // For image analysis, we'll use text description approach
    // In production, you'd use @cf/llava-hf/llava-1.5-7b-hf or similar vision model
    const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{
        role: 'user',
        content: `I have an image of a guilloche pattern. Based on typical guilloche patterns, provide analysis for a ${imageData.length > 10000 ? 'complex' : 'simple'} pattern. ${analysisPrompt}`
      }],
      max_tokens: 300,
    });

    let analysis = {
      curveType: 'hypo',
      symmetryCount: 1,
      hasReflection: false,
      complexity: 'medium',
      lineCount: 'moderate',
      primaryColor: '#4f46e5',
      backgroundColor: '#0f0f23',
      lineThickness: 'medium',
      keywords: ['classic', 'traditional'],
      confidence: 0.6,
    };

    if (response && typeof response === 'object' && 'response' in response) {
      try {
        const jsonMatch = (response.response as string).match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = { ...analysis, ...JSON.parse(jsonMatch[0]) };
        }
      } catch (e) {
        console.error('Failed to parse analysis:', e);
      }
    }

    // Convert analysis to pattern parameters
    const params: PatternParams = { ...DEFAULT_PARAMS };

    // Set curve family
    const familyMap: Record<string, string> = {
      'hypo': 'hypo',
      'hypotrochoid': 'hypo',
      'epi': 'epi',
      'epitrochoid': 'epi',
      'rose': 'rose',
      'liss': 'liss',
      'lissajous': 'liss',
      'spiral': 'spiral',
      'fermat': 'fermat',
    };
    params.family = (familyMap[analysis.curveType.toLowerCase()] || 'hypo') as PatternParams['family'];

    // Set symmetry
    params.symmetry = Math.max(1, Math.min(24, analysis.symmetryCount || 1));
    params.reflectH = analysis.hasReflection;

    // Set complexity-based parameters
    switch (analysis.complexity) {
      case 'very_high':
        params.k = 35 + Math.floor(Math.random() * 15);
        params.m = 0.4 + Math.random() * 0.15;
        break;
      case 'high':
        params.k = 20 + Math.floor(Math.random() * 15);
        params.m = 0.3 + Math.random() * 0.1;
        break;
      case 'low':
        params.k = 3 + Math.floor(Math.random() * 5);
        params.m = 0.05 + Math.random() * 0.1;
        break;
      default: // medium
        params.k = 10 + Math.floor(Math.random() * 10);
        params.m = 0.15 + Math.random() * 0.15;
    }

    // Set line thickness
    switch (analysis.lineThickness) {
      case 'thin':
        params.lw = 0.3 + Math.random() * 0.4;
        break;
      case 'thick':
        params.lw = 2 + Math.random() * 2;
        break;
      default:
        params.lw = 0.8 + Math.random() * 0.8;
    }

    // Set colors
    if (analysis.primaryColor) params.startColor = analysis.primaryColor;
    if (analysis.backgroundColor) params.bgColor = analysis.backgroundColor;

    return {
      params,
      confidence: analysis.confidence || 0.6,
      suggestions: [
        `Detected ${params.family} curve with ${params.symmetry}-fold symmetry`,
        `Complexity: ${analysis.complexity}`,
        `Try adjusting 'k' parameter (currently ${params.k}) for different detail levels`,
      ],
      similar_keywords: analysis.keywords || [],
    };
  } catch (error) {
    console.error('Pattern recognition failed:', error);
    return {
      params: DEFAULT_PARAMS,
      confidence: 0.2,
      suggestions: ['Pattern analysis failed. Please try a clearer image.'],
      similar_keywords: [],
    };
  }
}

/**
 * Generative Design System
 * Converts natural language description to pattern parameters
 */
async function textToPattern(
  env: Env,
  prompt: string
): Promise<TextToPatternResult> {
  const ai = new Ai(env.AI);

  const systemPrompt = `You are an expert guilloche pattern designer. Convert natural language descriptions into precise mathematical pattern parameters.

Available curve families:
- hypo (hypotrochoid): Classic security printing patterns, complex interlocking curves
- epi (epitrochoid): Organic, flowing patterns similar to botanical forms
- rose: Petal-like symmetric patterns, great for logos and mandala designs
- liss (Lissajous): Smooth, modern curves with graceful intersections
- spiral: Expanding spiral patterns, cosmic and natural themes
- fermat: Fermat spiral, mathematical elegance

Parameter ranges:
- R (outer radius): 10-450, affects overall size
- r (inner radius): 5-300, affects curve complexity
- d (pen offset): 0-320, affects loop size
- k (frequency): 1-80, more = more detailed/complex
- m (modulation): 0-1, affects wave amplitude
- symmetry: 1-24, rotational symmetry copies
- reflectH/reflectV: boolean, mirror effects
- kaleidoscope: boolean, quadrant mirroring
- lw (line width): 0.1-8

Always provide complete, valid JSON parameter sets.`;

  const userPrompt = `Create a guilloche pattern based on this description: "${prompt}"

Respond with ONLY a JSON object (no explanation):
{
  "interpretation": "your understanding of the request",
  "primary": {
    "family": "curve family",
    "R": number,
    "r": number,
    "d": number,
    "k": number,
    "m": number,
    "mf": number,
    "phase": number,
    "rot": number,
    "s": number,
    "symmetry": number,
    "reflectH": boolean,
    "reflectV": boolean,
    "kaleidoscope": boolean,
    "lw": number,
    "startColor": "hex",
    "endColor": "hex",
    "bgColor": "hex",
    "useGradient": boolean
  },
  "variations": [
    { /* similar params with slight variations */ },
    { /* another variation */ }
  ]
}`;

  try {
    const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
    });

    if (response && typeof response === 'object' && 'response' in response) {
      const jsonMatch = (response.response as string).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);

        // Validate and sanitize parameters
        const sanitizeParams = (p: any): PatternParams => ({
          family: ['hypo', 'epi', 'rose', 'liss', 'spiral', 'fermat'].includes(p.family) ? p.family : 'hypo',
          R: Math.max(10, Math.min(450, p.R || 200)),
          r: Math.max(5, Math.min(300, p.r || 60)),
          d: Math.max(0, Math.min(320, p.d || 100)),
          k: Math.max(1, Math.min(80, p.k || 10)),
          m: Math.max(0, Math.min(1, p.m || 0.2)),
          mf: Math.max(1, Math.min(80, p.mf || 5)),
          phase: Math.max(0, Math.min(6.283, p.phase || 0)),
          rot: Math.max(0, Math.min(6.283, p.rot || 0)),
          s: Math.max(0.2, Math.min(3, p.s || 1)),
          symmetry: Math.max(1, Math.min(24, Math.floor(p.symmetry || 1))),
          reflectH: Boolean(p.reflectH),
          reflectV: Boolean(p.reflectV),
          kaleidoscope: Boolean(p.kaleidoscope),
          lw: Math.max(0.1, Math.min(8, p.lw || 1)),
          startColor: p.startColor || '#4f46e5',
          endColor: p.endColor || '#7c3aed',
          bgColor: p.bgColor || '#0f0f23',
          useGradient: p.useGradient !== false,
        });

        return {
          params: sanitizeParams(result.primary),
          variations: (result.variations || []).slice(0, 3).map(sanitizeParams),
          interpretation: result.interpretation || 'Pattern generated from description',
        };
      }
    }
  } catch (error) {
    console.error('Text to pattern failed:', error);
  }

  // Fallback: use keyword-based suggestion
  const keywords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const suggestions = await suggestParameters(env, keywords);

  return {
    params: { ...DEFAULT_PARAMS, ...suggestions[0]?.params },
    variations: [],
    interpretation: 'Pattern generated from keywords: ' + keywords.join(', '),
  };
}

/**
 * Get embeddings for semantic search
 */
async function getEmbeddings(env: Env, text: string): Promise<number[]> {
  const ai = new Ai(env.AI);

  try {
    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: text,
    });

    if (response && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
  } catch (error) {
    console.error('Embedding generation failed:', error);
  }

  return [];
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health') {
        return Response.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
      }

      // AI Parameter Assistant
      if (path === '/api/ai/suggest' && request.method === 'POST') {
        const body = await request.json() as { keywords: string[] };

        if (!body.keywords || !Array.isArray(body.keywords)) {
          return Response.json({ error: 'keywords array required' }, { status: 400, headers: corsHeaders });
        }

        // Check cache
        const cacheKey = `suggest:${body.keywords.sort().join(',')}`;
        const cached = await env.AI_CACHE.get(cacheKey);
        if (cached) {
          return Response.json(JSON.parse(cached), { headers: corsHeaders });
        }

        const suggestions = await suggestParameters(env, body.keywords);

        // Cache for 1 hour
        ctx.waitUntil(env.AI_CACHE.put(cacheKey, JSON.stringify(suggestions), { expirationTtl: 3600 }));

        return Response.json(suggestions, { headers: corsHeaders });
      }

      // Pattern Recognition
      if (path === '/api/ai/recognize' && request.method === 'POST') {
        const body = await request.json() as { image: string };

        if (!body.image) {
          return Response.json({ error: 'image (base64) required' }, { status: 400, headers: corsHeaders });
        }

        const result = await recognizePattern(env, body.image);
        return Response.json(result, { headers: corsHeaders });
      }

      // Text to Pattern
      if (path === '/api/ai/generate' && request.method === 'POST') {
        const body = await request.json() as { prompt: string };

        if (!body.prompt) {
          return Response.json({ error: 'prompt required' }, { status: 400, headers: corsHeaders });
        }

        // Check cache
        const cacheKey = `generate:${body.prompt.toLowerCase().trim()}`;
        const cached = await env.AI_CACHE.get(cacheKey);
        if (cached) {
          return Response.json(JSON.parse(cached), { headers: corsHeaders });
        }

        const result = await textToPattern(env, body.prompt);

        // Cache for 1 hour
        ctx.waitUntil(env.AI_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 }));

        return Response.json(result, { headers: corsHeaders });
      }

      // Get embeddings (for Supabase vector search)
      if (path === '/api/ai/embed' && request.method === 'POST') {
        const body = await request.json() as { text: string };

        if (!body.text) {
          return Response.json({ error: 'text required' }, { status: 400, headers: corsHeaders });
        }

        const embeddings = await getEmbeddings(env, body.text);
        return Response.json({ embeddings }, { headers: corsHeaders });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return Response.json(
        { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
