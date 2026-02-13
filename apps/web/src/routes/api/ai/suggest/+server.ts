/**
 * AI Parameter Suggestion Endpoint
 * @module /api/ai/suggest
 * @description Uses Cloudflare Workers AI to generate pattern parameters from keywords.
 * Falls back to preset-based generation if AI is unavailable or rate limited.
 * Results are cached for 5 minutes to improve performance.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 * @see {@link AIRequestSchema} Zod validator for request body
 *
 * @example
 * // Generate pattern suggestions
 * POST /api/ai/suggest
 * { "keywords": ["elegant", "gold"], "style": "classic", "complexity": "complex" }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AIRequestSchema, validate } from '$lib/utils/validation';
import { getCacheHeaders, memoryCache } from '$lib/utils/cache';
import { SecurityMiddleware, createSecurityErrorResponse } from '$lib/services/security-middleware';

// =============================================================================
// Types
// =============================================================================

interface SuggestionRequest {
  keywords: string[];
  style?: 'geometric' | 'organic' | 'classic' | 'modern';
  complexity?: 'simple' | 'moderate' | 'complex';
}

interface PatternSuggestion {
  params: Record<string, number | string | boolean>;
  confidence: number;
  reasoning: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

// =============================================================================
// Response Helpers
// =============================================================================

function successResponse<T>(data: T, cacheType?: 'API'): Response {
  const response: ApiResponse<T> = { success: true, data };
  return json(response, {
    status: 200,
    headers: cacheType ? getCacheHeaders(cacheType) : undefined,
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ path: string; message: string }>
): never {
  throw error(
    status,
    JSON.stringify({
      success: false,
      error: { code, message, details },
    })
  );
}

// =============================================================================
// Constants
// =============================================================================

const PATTERN_FAMILIES = [
  'rose',
  'maurer',
  'spirograph',
  'lissajous',
  'hypotrochoid',
  'epitrochoid',
];

const STYLE_PRESETS: Record<string, Record<string, unknown>> = {
  'art-deco': {
    symmetry: 8,
    strokeWidth: 2,
    layerCount: 3,
    family: 'rose',
  },
  celtic: {
    symmetry: 4,
    strokeWidth: 1.5,
    layerCount: 5,
    family: 'spirograph',
  },
  mandala: {
    symmetry: 12,
    strokeWidth: 1,
    layerCount: 7,
    family: 'rose',
  },
  geometric: {
    symmetry: 6,
    strokeWidth: 1.5,
    layerCount: 4,
    family: 'lissajous',
  },
  organic: {
    symmetry: 5,
    strokeWidth: 2,
    layerCount: 3,
    family: 'spirograph',
  },
  currency: {
    symmetry: 2,
    strokeWidth: 0.5,
    layerCount: 10,
    family: 'maurer',
  },
  security: {
    symmetry: 1,
    strokeWidth: 0.3,
    layerCount: 15,
    family: 'maurer',
  },
};

const CACHE_TTL = 300000; // 5 minutes

const SYSTEM_PROMPT = `You are a guilloche pattern expert. Given keywords describing a desired pattern style, generate optimal parameters for a mathematical guilloche pattern.

Available pattern families: ${PATTERN_FAMILIES.join(', ')}

Parameters to set:
- family: one of the pattern families
- n: petals/lobes (1-24)
- d: density factor (1-100)
- k: curve parameter (0.1-0.9)
- symmetry: rotational symmetry (1-24)
- strokeWidth: line thickness (0.1-5)
- layerCount: number of overlapping curves (1-10)
- innerRadius: inner circle radius (10-200)
- outerRadius: outer circle radius (100-400)
- steps: computation steps (1000-50000)
- startColor: hex color for gradient start
- endColor: hex color for gradient end

Respond with JSON only, no explanation. Format:
{
  "params": { ... },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

// =============================================================================
// POST /api/ai/suggest - Generate pattern suggestions
// =============================================================================

/**
 * Generate AI-powered pattern suggestions
 * @name POST /api/ai/suggest
 * @function
 * @description Uses Cloudflare Workers AI (Llama 2) to generate optimal pattern
 * parameters based on user keywords and style preferences. Includes in-memory
 * caching (5 min TTL) for identical requests. Falls back to preset matching
 * if AI is unavailable.
 *
 * @param {Object} context - SvelteKit request context
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Platform} context.platform - Cloudflare platform bindings
 *
 * @requestBody {Object} body - Suggestion request
 * @requestBody {string[]} body.keywords - Keywords describing desired style (1-10 items, each 1-50 chars)
 * @requestBody {('geometric'|'organic'|'classic'|'modern')} [body.style] - Style preference
 * @requestBody {('simple'|'moderate'|'complex')} [body.complexity] - Complexity level
 *
 * @returns {Response} JSON response with pattern suggestion
 * @returns {boolean} response.success - Operation success status
 * @returns {Object} response.data.suggestion - Generated suggestion
 * @returns {Object} response.data.suggestion.params - Suggested pattern parameters
 * @returns {number} response.data.suggestion.confidence - Confidence score (0-1)
 * @returns {string} response.data.suggestion.reasoning - Explanation of suggestion
 * @returns {('ai'|'presets'|'cache')} response.data.source - Source of suggestion
 *
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Input validation failed
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @see {@link AIRequestSchema} Zod schema for validation rules
 *
 * @example
 * // Request
 * POST /api/ai/suggest
 * {
 *   "keywords": ["elegant", "gold", "art-deco"],
 *   "style": "classic",
 *   "complexity": "complex"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "suggestion": {
 *       "params": { "family": "rose", "symmetry": 8, "startColor": "#FFD700" },
 *       "confidence": 0.85,
 *       "reasoning": "Generated based on art-deco preset..."
 *     },
 *     "source": "ai"
 *   }
 * }
 */
export const POST: RequestHandler = async (event) => {
  const { request, platform, locals } = event;

  // Security check - Pro tier required for AI features
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {
    feature: 'ai.suggest',
    action: 'ai_request',
    requireVerification: true,
  });

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  // Validate input
  const validation = validate(AIRequestSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { keywords, style, complexity } = validation.data as SuggestionRequest;

  try {
    // Generate cache key for deduplication
    const sortedKeywords = [...keywords].sort();
    const cacheKey = `ai-suggest:${sortedKeywords.join(',')}:${style || ''}:${complexity || ''}`;

    // Check cache for identical requests
    const cached = memoryCache.get<PatternSuggestion>(cacheKey);
    if (cached) {
      return successResponse({ suggestion: cached, source: 'cache' }, 'API');
    }

    // Try Cloudflare AI if available
    if (platform?.env?.AI) {
      const prompt = `Generate guilloche pattern parameters for: ${keywords.join(', ')}
Style preference: ${style || 'any'}
Complexity: ${complexity || 'moderate'}`;

      try {
        const response = await platform.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
        });

        // Parse AI response
        const responseText = (response as { response: string }).response;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const suggestion: PatternSuggestion = JSON.parse(jsonMatch[0]);
          memoryCache.set(cacheKey, suggestion, CACHE_TTL);
          // Record AI usage
          await security.recordUsage(userId, 'ai_requests', 1);
          return successResponse({ suggestion, source: 'ai' }, 'API');
        }
      } catch (aiError) {
        console.error('AI inference failed, falling back to presets:', aiError);
        // Continue to fallback
      }
    }

    // Fallback: Use keyword matching with presets
    const suggestion = generateFromPresets(keywords, style, complexity);
    memoryCache.set(cacheKey, suggestion, CACHE_TTL);
    // Record AI usage (even for fallback, as it counts against quota)
    await security.recordUsage(userId, 'ai_requests', 1);

    return successResponse({ suggestion, source: 'presets' }, 'API');
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Suggestion error:', err);
    errorResponse('INTERNAL_ERROR', 'Failed to generate suggestions', 500);
  }
};

function generateFromPresets(
  keywords: string[],
  style?: string,
  complexity?: string
): PatternSuggestion {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

  // Find matching preset
  let bestMatch = 'geometric';
  let matchScore = 0;

  for (const [presetName] of Object.entries(STYLE_PRESETS)) {
    const presetKeywords = presetName.split('-');
    const score = normalizedKeywords.filter((k) =>
      presetKeywords.some((pk) => k.includes(pk) || pk.includes(k))
    ).length;

    if (score > matchScore) {
      matchScore = score;
      bestMatch = presetName;
    }
  }

  // Also check for direct keyword matches
  for (const keyword of normalizedKeywords) {
    if (keyword in STYLE_PRESETS) {
      bestMatch = keyword;
      matchScore = keywords.length;
      break;
    }
  }

  const baseParams = { ...STYLE_PRESETS[bestMatch] };

  // Adjust for complexity
  if (complexity === 'simple') {
    baseParams.layerCount = Math.max(1, (baseParams.layerCount as number) - 2);
    baseParams.steps = 5000;
  } else if (complexity === 'complex') {
    baseParams.layerCount = Math.min(10, (baseParams.layerCount as number) + 3);
    baseParams.steps = 30000;
  } else {
    baseParams.steps = 15000;
  }

  // Apply style adjustments
  if (style === 'organic') {
    baseParams.family = 'spirograph';
    baseParams.symmetry = Math.max(3, Math.min(7, baseParams.symmetry as number));
  } else if (style === 'geometric') {
    baseParams.family = 'lissajous';
    baseParams.symmetry = [4, 6, 8][Math.floor(Math.random() * 3)];
  } else if (style === 'classic') {
    baseParams.family = 'rose';
  } else if (style === 'modern') {
    baseParams.family = 'maurer';
  }

  // Generate complementary colors based on keywords
  const colors = generateColors(normalizedKeywords);
  baseParams.startColor = colors.start;
  baseParams.endColor = colors.end;

  // Fill in remaining defaults
  const params = {
    family: 'rose',
    n: 7,
    d: 71,
    k: 0.5,
    symmetry: 6,
    strokeWidth: 1,
    layerCount: 3,
    innerRadius: 50,
    outerRadius: 200,
    steps: 10000,
    startColor: '#2563eb',
    endColor: '#7c3aed',
    ...baseParams,
  };

  return {
    params,
    confidence: Math.min(1, 0.5 + matchScore * 0.15),
    reasoning: `Generated based on "${bestMatch}" preset, adjusted for ${complexity || 'moderate'} complexity and ${style || 'balanced'} style.`,
  };
}

function generateColors(keywords: string[]): { start: string; end: string } {
  const colorMap: Record<string, { start: string; end: string }> = {
    gold: { start: '#FFD700', end: '#B8860B' },
    silver: { start: '#C0C0C0', end: '#808080' },
    blue: { start: '#3B82F6', end: '#1E40AF' },
    red: { start: '#EF4444', end: '#991B1B' },
    green: { start: '#22C55E', end: '#166534' },
    purple: { start: '#A855F7', end: '#6B21A8' },
    pink: { start: '#EC4899', end: '#BE185D' },
    orange: { start: '#F97316', end: '#C2410C' },
    teal: { start: '#14B8A6', end: '#0F766E' },
    cyan: { start: '#06B6D4', end: '#0E7490' },
    warm: { start: '#F59E0B', end: '#DC2626' },
    cool: { start: '#3B82F6', end: '#8B5CF6' },
    vintage: { start: '#92400E', end: '#78350F' },
    modern: { start: '#6366F1', end: '#EC4899' },
    elegant: { start: '#1F2937', end: '#6B7280' },
    vibrant: { start: '#F97316', end: '#EC4899' },
  };

  for (const keyword of keywords) {
    for (const [colorKey, colors] of Object.entries(colorMap)) {
      if (keyword.includes(colorKey)) {
        return colors;
      }
    }
  }

  // Default gradient
  return { start: '#3B82F6', end: '#8B5CF6' };
}
