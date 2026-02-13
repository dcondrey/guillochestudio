/**
 * Contextual Learning System
 * Learns from user interactions to provide intelligent suggestions
 * Uses local storage for persistence and pattern analysis for recommendations
 */

import type { PatternParams } from '@guilloche/shared';
import { writable, derived, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================================================
// Types
// ============================================================================

export interface UserInteraction {
  id: string;
  timestamp: number;
  type: InteractionType;
  params: Partial<PatternParams>;
  context: InteractionContext;
  duration?: number;
  result?: InteractionResult;
}

export type InteractionType =
  | 'param_change'
  | 'preset_load'
  | 'pattern_save'
  | 'pattern_export'
  | 'pattern_share'
  | 'ai_suggestion'
  | 'undo'
  | 'redo'
  | 'render_complete';

export interface InteractionContext {
  sessionId: string;
  previousParams?: Partial<PatternParams>;
  source?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface InteractionResult {
  success: boolean;
  userSatisfaction?: number; // 1-5 rating or implicit signal
  renderTime?: number;
  fileSize?: number;
}

export interface LearningProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  totalInteractions: number;
  sessionCount: number;
  preferences: UserPreferences;
  parameterTendencies: ParameterTendencies;
  styleProfile: StyleProfile;
  skillLevel: SkillLevel;
}

export interface UserPreferences {
  preferredFamily: string;
  preferredQuality: string;
  preferredExportFormat: string;
  colorSchemePreference: 'light' | 'dark' | 'colorful' | 'monochrome';
  complexityPreference: 'simple' | 'moderate' | 'complex';
  autoSaveEnabled: boolean;
  showTips: boolean;
}

export interface ParameterTendencies {
  R: ParameterStats;
  r: ParameterStats;
  d: ParameterStats;
  amplitude: ParameterStats;
  frequency: ParameterStats;
  steps: ParameterStats;
  [key: string]: ParameterStats;
}

export interface ParameterStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  sampleCount: number;
  recentValues: number[];
}

export interface StyleProfile {
  dominantStyles: string[];
  colorPalettes: string[][];
  complexityScore: number;
  symmetryPreference: number;
  organicVsGeometric: number; // -1 (organic) to 1 (geometric)
  densityPreference: number;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  confidence: number;
  params?: Partial<PatternParams>;
  action?: () => void;
  metadata?: Record<string, unknown>;
}

export type SuggestionType =
  | 'parameter_adjustment'
  | 'style_exploration'
  | 'workflow_tip'
  | 'similar_pattern'
  | 'trending_style'
  | 'skill_improvement'
  | 'quick_action';

export interface LearningInsight {
  type: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PROFILE = 'guilloche_learning_profile';
const STORAGE_KEY_INTERACTIONS = 'guilloche_interactions';
const MAX_STORED_INTERACTIONS = 1000;
const MAX_RECENT_VALUES = 50;

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredFamily: 'spirograph',
  preferredQuality: 'normal',
  preferredExportFormat: 'svg',
  colorSchemePreference: 'colorful',
  complexityPreference: 'moderate',
  autoSaveEnabled: true,
  showTips: true,
};

const SKILL_THRESHOLDS = {
  beginner: 0,
  intermediate: 50,
  advanced: 200,
  expert: 500,
};

// ============================================================================
// Contextual Learning Service
// ============================================================================

export class ContextualLearningService {
  private sessionId: string;
  private profile: LearningProfile;
  private interactions: UserInteraction[] = [];
  private sessionStart: number;
  private isInitialized = false;

  // Stores
  private _profile: Writable<LearningProfile>;
  private _suggestions: Writable<Suggestion[]>;
  private _insights: Writable<LearningInsight[]>;

  public readonly profileStore: Readable<LearningProfile>;
  public readonly suggestions: Readable<Suggestion[]>;
  public readonly insights: Readable<LearningInsight[]>;
  public readonly skillLevel: Readable<SkillLevel>;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.profile = this.createDefaultProfile();

    // Initialize stores
    this._profile = writable(this.profile);
    this._suggestions = writable<Suggestion[]>([]);
    this._insights = writable<LearningInsight[]>([]);

    this.profileStore = this._profile;
    this.suggestions = this._suggestions;
    this.insights = this._insights;

    this.skillLevel = derived(this._profile, ($profile) =>
      this.calculateSkillLevel($profile.totalInteractions)
    );
  }

  /**
   * Initialize the learning service
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Load from storage
    this.loadFromStorage();

    // Update session count
    this.profile.sessionCount++;
    this.profile.updatedAt = Date.now();

    this._profile.set(this.profile);
    this.isInitialized = true;

    // Generate initial suggestions
    this.generateSuggestions();
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Create default profile
   */
  private createDefaultProfile(): LearningProfile {
    return {
      userId: this.generateUserId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalInteractions: 0,
      sessionCount: 0,
      preferences: { ...DEFAULT_PREFERENCES },
      parameterTendencies: this.createDefaultTendencies(),
      styleProfile: {
        dominantStyles: [],
        colorPalettes: [],
        complexityScore: 0.5,
        symmetryPreference: 0.5,
        organicVsGeometric: 0,
        densityPreference: 0.5,
      },
      skillLevel: 'beginner',
    };
  }

  /**
   * Generate user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Create default parameter tendencies
   */
  private createDefaultTendencies(): ParameterTendencies {
    const defaultStats = (): ParameterStats => ({
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      mode: 0,
      standardDeviation: 0,
      sampleCount: 0,
      recentValues: [],
    });

    return {
      R: defaultStats(),
      r: defaultStats(),
      d: defaultStats(),
      amplitude: defaultStats(),
      frequency: defaultStats(),
      steps: defaultStats(),
      k: defaultStats(),
      a: defaultStats(),
      b: defaultStats(),
    };
  }

  /**
   * Load data from storage
   */
  private loadFromStorage(): void {
    if (!browser) return;

    try {
      const storedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        this.profile = { ...this.createDefaultProfile(), ...parsed };
      }

      const storedInteractions = localStorage.getItem(STORAGE_KEY_INTERACTIONS);
      if (storedInteractions) {
        this.interactions = JSON.parse(storedInteractions);
      }
    } catch (error) {
      console.warn('Failed to load learning data:', error);
    }
  }

  /**
   * Save data to storage
   */
  private saveToStorage(): void {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(this.profile));

      // Keep only recent interactions
      const recentInteractions = this.interactions.slice(-MAX_STORED_INTERACTIONS);
      localStorage.setItem(STORAGE_KEY_INTERACTIONS, JSON.stringify(recentInteractions));
    } catch (error) {
      console.warn('Failed to save learning data:', error);
    }
  }

  /**
   * Record a user interaction
   */
  recordInteraction(
    type: InteractionType,
    params: Partial<PatternParams>,
    context?: Partial<InteractionContext>,
    result?: InteractionResult
  ): void {
    const interaction: UserInteraction = {
      id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      params,
      context: {
        sessionId: this.sessionId,
        deviceType: this.detectDeviceType(),
        timeOfDay: this.getTimeOfDay(),
        ...context,
      },
      result,
    };

    this.interactions.push(interaction);
    this.profile.totalInteractions++;
    this.profile.updatedAt = Date.now();

    // Update parameter tendencies
    this.updateParameterTendencies(params);

    // Update style profile
    this.updateStyleProfile(params);

    // Update skill level
    this.profile.skillLevel = this.calculateSkillLevel(this.profile.totalInteractions);

    this._profile.set(this.profile);
    this.saveToStorage();

    // Regenerate suggestions after significant interactions
    if (['pattern_save', 'pattern_export', 'preset_load'].includes(type)) {
      this.generateSuggestions();
    }
  }

  /**
   * Update parameter tendencies based on new params
   */
  private updateParameterTendencies(params: Partial<PatternParams>): void {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== 'number') continue;

      if (!this.profile.parameterTendencies[key]) {
        this.profile.parameterTendencies[key] = {
          min: value,
          max: value,
          mean: value,
          median: value,
          mode: value,
          standardDeviation: 0,
          sampleCount: 0,
          recentValues: [],
        };
      }

      const stats = this.profile.parameterTendencies[key];
      stats.recentValues.push(value);
      if (stats.recentValues.length > MAX_RECENT_VALUES) {
        stats.recentValues.shift();
      }

      stats.sampleCount++;
      stats.min = Math.min(stats.min, value);
      stats.max = Math.max(stats.max, value);
      stats.mean = this.calculateMean(stats.recentValues);
      stats.median = this.calculateMedian(stats.recentValues);
      stats.mode = this.calculateMode(stats.recentValues);
      stats.standardDeviation = this.calculateStdDev(stats.recentValues, stats.mean);
    }
  }

  /**
   * Update style profile
   */
  private updateStyleProfile(params: Partial<PatternParams>): void {
    const profile = this.profile.styleProfile;

    // Update complexity score
    if (params.steps) {
      const normalizedSteps = Math.min(params.steps / 10000, 1);
      profile.complexityScore = profile.complexityScore * 0.9 + normalizedSteps * 0.1;
    }

    // Update symmetry preference
    if (params.k !== undefined) {
      const symmetryIndicator = params.k > 1 ? 0.8 : 0.2;
      profile.symmetryPreference = profile.symmetryPreference * 0.9 + symmetryIndicator * 0.1;
    }

    // Update organic vs geometric based on family
    if (params.family) {
      const geometricFamilies = ['spirograph', 'lissajous'];
      const indicator = geometricFamilies.includes(params.family) ? 0.7 : -0.3;
      profile.organicVsGeometric = Math.max(
        -1,
        Math.min(1, profile.organicVsGeometric * 0.9 + indicator * 0.1)
      );
    }

    // Track dominant styles
    if (params.family && !profile.dominantStyles.includes(params.family)) {
      profile.dominantStyles.push(params.family);
      if (profile.dominantStyles.length > 5) {
        profile.dominantStyles.shift();
      }
    }

    // Track color palettes
    if (params.startColor && params.endColor) {
      const palette = [params.startColor, params.endColor];
      profile.colorPalettes.push(palette);
      if (profile.colorPalettes.length > 10) {
        profile.colorPalettes.shift();
      }
    }
  }

  /**
   * Calculate skill level based on interactions
   */
  private calculateSkillLevel(interactions: number): SkillLevel {
    if (interactions >= SKILL_THRESHOLDS.expert) return 'expert';
    if (interactions >= SKILL_THRESHOLDS.advanced) return 'advanced';
    if (interactions >= SKILL_THRESHOLDS.intermediate) return 'intermediate';
    return 'beginner';
  }

  /**
   * Generate personalized suggestions
   */
  generateSuggestions(): void {
    const suggestions: Suggestion[] = [];

    // Parameter adjustment suggestions
    suggestions.push(...this.generateParameterSuggestions());

    // Style exploration suggestions
    suggestions.push(...this.generateStyleSuggestions());

    // Workflow tips based on skill level
    suggestions.push(...this.generateWorkflowTips());

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    this._suggestions.set(suggestions.slice(0, 10));
  }

  /**
   * Generate parameter adjustment suggestions
   */
  private generateParameterSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const tendencies = this.profile.parameterTendencies;

    // Suggest parameter ranges based on user's typical values
    for (const [param, stats] of Object.entries(tendencies)) {
      if (stats.sampleCount < 5) continue;

      // Suggest exploring beyond typical range
      if (stats.standardDeviation < (stats.max - stats.min) * 0.1) {
        suggestions.push({
          id: `param_explore_${param}`,
          type: 'parameter_adjustment',
          title: `Explore ${param} variations`,
          description: `You tend to use ${param} values around ${stats.mean.toFixed(1)}. Try values between ${(stats.min * 0.8).toFixed(1)} and ${(stats.max * 1.2).toFixed(1)} for more variety.`,
          confidence: 0.7,
          params: {
            [param]: stats.mean + (Math.random() - 0.5) * stats.standardDeviation * 3,
          },
        });
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Generate style exploration suggestions
   */
  private generateStyleSuggestions(): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const profile = this.profile.styleProfile;

    // Suggest unexplored families
    const allFamilies = ['spirograph', 'epitrochoid', 'rose', 'lissajous', 'harmonograph'];
    const unexplored = allFamilies.filter((f) => !profile.dominantStyles.includes(f));

    if (unexplored.length > 0) {
      const suggested = unexplored[Math.floor(Math.random() * unexplored.length)];
      suggestions.push({
        id: 'explore_family',
        type: 'style_exploration',
        title: `Try ${suggested} patterns`,
        description: `You haven't explored ${suggested} patterns much. They offer unique characteristics you might enjoy.`,
        confidence: 0.65,
        params: { family: suggested as PatternParams['family'] },
      });
    }

    // Suggest based on organic/geometric preference
    if (Math.abs(profile.organicVsGeometric) > 0.5) {
      const opposite = profile.organicVsGeometric > 0 ? 'organic' : 'geometric';
      suggestions.push({
        id: 'style_balance',
        type: 'style_exploration',
        title: `Explore more ${opposite} styles`,
        description: `Your patterns tend to be ${profile.organicVsGeometric > 0 ? 'geometric' : 'organic'}. Try incorporating more ${opposite} elements.`,
        confidence: 0.6,
      });
    }

    return suggestions;
  }

  /**
   * Generate workflow tips based on skill level
   */
  private generateWorkflowTips(): Suggestion[] {
    const tips: Suggestion[] = [];
    const skillLevel = this.profile.skillLevel;

    const tipsByLevel: Record<SkillLevel, Suggestion[]> = {
      beginner: [
        {
          id: 'tip_undo',
          type: 'workflow_tip',
          title: 'Use Ctrl+Z to undo',
          description: 'Made a mistake? Press Ctrl+Z (Cmd+Z on Mac) to undo your last change.',
          confidence: 0.8,
        },
        {
          id: 'tip_presets',
          type: 'workflow_tip',
          title: 'Start with presets',
          description: 'Try loading a preset to see what parameters create interesting patterns.',
          confidence: 0.75,
        },
      ],
      intermediate: [
        {
          id: 'tip_dna',
          type: 'workflow_tip',
          title: 'Share your creations',
          description: 'Use Pattern DNA to create shareable links to your patterns.',
          confidence: 0.7,
        },
        {
          id: 'tip_export',
          type: 'workflow_tip',
          title: 'Try different export formats',
          description:
            'SVG exports are perfect for scaling, while PNG works better for web sharing.',
          confidence: 0.65,
        },
      ],
      advanced: [
        {
          id: 'tip_wasm',
          type: 'workflow_tip',
          title: 'Enable WASM engine',
          description:
            'The WebAssembly engine renders patterns up to 5x faster for complex designs.',
          confidence: 0.7,
        },
        {
          id: 'tip_accessibility',
          type: 'workflow_tip',
          title: 'Check accessibility',
          description: 'Use the accessibility checker to ensure your patterns work for all users.',
          confidence: 0.6,
        },
      ],
      expert: [
        {
          id: 'tip_api',
          type: 'workflow_tip',
          title: 'Use the API',
          description: 'Generate patterns programmatically using our API for batch processing.',
          confidence: 0.65,
        },
        {
          id: 'tip_marketplace',
          type: 'workflow_tip',
          title: 'Sell your patterns',
          description: 'List your best patterns on the marketplace to earn royalties.',
          confidence: 0.6,
        },
      ],
    };

    // Add tips for current skill level
    tips.push(...(tipsByLevel[skillLevel] || []));

    // Add one tip from next level if close to leveling up
    const levelOrder: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levelOrder.indexOf(skillLevel);
    if (currentIndex < levelOrder.length - 1) {
      const nextLevel = levelOrder[currentIndex + 1];
      const nextThreshold = SKILL_THRESHOLDS[nextLevel];
      const progress = this.profile.totalInteractions / nextThreshold;

      if (progress > 0.7) {
        const nextTips = tipsByLevel[nextLevel];
        if (nextTips && nextTips.length > 0) {
          tips.push({
            ...nextTips[0],
            confidence: nextTips[0].confidence * 0.5,
          });
        }
      }
    }

    return tips;
  }

  /**
   * Get similar patterns based on current params
   */
  getSimilarPatterns(currentParams: PatternParams, limit = 5): Partial<PatternParams>[] {
    const similar: Array<{ params: Partial<PatternParams>; distance: number }> = [];

    for (const interaction of this.interactions) {
      if (interaction.type !== 'pattern_save') continue;

      const distance = this.calculateParamDistance(currentParams, interaction.params);
      similar.push({ params: interaction.params, distance });
    }

    // Sort by distance and return closest
    similar.sort((a, b) => a.distance - b.distance);
    return similar.slice(0, limit).map((s) => s.params);
  }

  /**
   * Calculate distance between parameter sets
   */
  private calculateParamDistance(a: Partial<PatternParams>, b: Partial<PatternParams>): number {
    const numericKeys = ['R', 'r', 'd', 'amplitude', 'frequency', 'steps', 'k'];
    let totalDistance = 0;
    let keyCount = 0;

    for (const key of numericKeys) {
      const aVal = (a as Record<string, number>)[key];
      const bVal = (b as Record<string, number>)[key];

      if (aVal !== undefined && bVal !== undefined) {
        // Normalize by typical range
        const range =
          this.profile.parameterTendencies[key]?.max - this.profile.parameterTendencies[key]?.min ||
          100;
        totalDistance += Math.abs(aVal - bVal) / (range || 1);
        keyCount++;
      }
    }

    // Add penalty for different families
    if (a.family !== b.family) {
      totalDistance += 1;
    }

    return keyCount > 0 ? totalDistance / keyCount : Infinity;
  }

  /**
   * Predict user satisfaction
   */
  predictSatisfaction(params: PatternParams): number {
    // Simple prediction based on how similar params are to saved patterns
    const savedPatterns = this.interactions
      .filter((i) => i.type === 'pattern_save' && i.result?.userSatisfaction)
      .map((i) => ({
        params: i.params,
        satisfaction: i.result!.userSatisfaction!,
      }));

    if (savedPatterns.length === 0) return 0.5;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const { params: savedParams, satisfaction } of savedPatterns) {
      const distance = this.calculateParamDistance(params, savedParams);
      const weight = 1 / (1 + distance);
      weightedSum += satisfaction * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight / 5 : 0.5; // Normalize to 0-1
  }

  /**
   * Generate insights based on learning
   */
  generateInsights(): LearningInsight[] {
    const insights: LearningInsight[] = [];

    // Session insights
    const sessionDuration = Date.now() - this.sessionStart;
    const sessionInteractions = this.interactions.filter(
      (i) => i.context.sessionId === this.sessionId
    ).length;

    if (sessionInteractions > 0) {
      insights.push({
        type: 'session',
        message: `You've made ${sessionInteractions} changes this session`,
        data: { duration: sessionDuration, interactions: sessionInteractions },
        timestamp: Date.now(),
      });
    }

    // Pattern family insights
    const familyCounts: Record<string, number> = {};
    for (const interaction of this.interactions) {
      if (interaction.params.family) {
        familyCounts[interaction.params.family] =
          (familyCounts[interaction.params.family] || 0) + 1;
      }
    }

    const topFamily = Object.entries(familyCounts).sort((a, b) => b[1] - a[1])[0];

    if (topFamily) {
      insights.push({
        type: 'preference',
        message: `Your favorite pattern family is ${topFamily[0]}`,
        data: { family: topFamily[0], count: topFamily[1] },
        timestamp: Date.now(),
      });
    }

    // Skill progress insight
    const nextLevel = this.getNextSkillLevel();
    if (nextLevel) {
      const threshold = SKILL_THRESHOLDS[nextLevel];
      const remaining = threshold - this.profile.totalInteractions;
      insights.push({
        type: 'progress',
        message: `${remaining} more patterns until you reach ${nextLevel} level`,
        data: { currentLevel: this.profile.skillLevel, nextLevel, remaining },
        timestamp: Date.now(),
      });
    }

    this._insights.set(insights);
    return insights;
  }

  /**
   * Get next skill level
   */
  private getNextSkillLevel(): SkillLevel | null {
    const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(this.profile.skillLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * Update user preference
   */
  updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.profile.preferences[key] = value;
    this.profile.updatedAt = Date.now();
    this._profile.set(this.profile);
    this.saveToStorage();
  }

  /**
   * Get recommended starting parameters
   */
  getRecommendedStartParams(): Partial<PatternParams> {
    const tendencies = this.profile.parameterTendencies;
    const dominantStyle = this.profile.styleProfile.dominantStyles[0];

    // Map style to valid CurveFamily
    const validFamilies: PatternParams['family'][] = [
      'hypo',
      'hypotrochoid',
      'epi',
      'epitrochoid',
      'rose',
      'liss',
      'spiral',
      'hypocycloid',
      'epicycloid',
      'fermat',
      'liss3d',
    ];
    const family = validFamilies.includes(dominantStyle as PatternParams['family'])
      ? (dominantStyle as PatternParams['family'])
      : 'hypotrochoid';

    return {
      family,
      R: tendencies.R?.mean || 100,
      r: tendencies.r?.mean || 40,
      d: tendencies.d?.mean || 30,
      // Map amplitude/frequency to valid PatternParams properties
      m: tendencies.amplitude?.mean || 0.2, // modulation depth
      mf: tendencies.frequency?.mean || 3, // modulation frequency
      steps: Math.round(tendencies.steps?.mean || 3600),
    };
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (!browser) return 'desktop';

    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Get time of day
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate mode
   */
  private calculateMode(values: number[]): number {
    if (values.length === 0) return 0;
    const counts = new Map<number, number>();
    let maxCount = 0;
    let mode = values[0];

    for (const val of values) {
      const rounded = Math.round(val * 10) / 10;
      const count = (counts.get(rounded) || 0) + 1;
      counts.set(rounded, count);
      if (count > maxCount) {
        maxCount = count;
        mode = rounded;
      }
    }

    return mode;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Export learning data
   */
  exportData(): string {
    return JSON.stringify(
      {
        profile: this.profile,
        interactions: this.interactions.slice(-100),
      },
      null,
      2
    );
  }

  /**
   * Import learning data
   */
  importData(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.profile) {
        this.profile = { ...this.profile, ...data.profile };
        this._profile.set(this.profile);
      }
      if (data.interactions) {
        this.interactions = [...this.interactions, ...data.interactions];
      }
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset all learning data
   */
  reset(): void {
    this.profile = this.createDefaultProfile();
    this.interactions = [];
    this._profile.set(this.profile);
    this._suggestions.set([]);
    this._insights.set([]);
    this.saveToStorage();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ContextualLearningService | null = null;

export function getContextualLearning(): ContextualLearningService {
  if (!instance) {
    instance = new ContextualLearningService();
  }
  return instance;
}

export async function initContextualLearning(): Promise<ContextualLearningService> {
  const service = getContextualLearning();
  await service.init();
  return service;
}
