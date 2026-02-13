/**
 * Accessibility Compliance Checker
 * WCAG 2.1 compliance for SVG patterns
 */

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  luminance: number;
}

export interface ContrastResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'AA-large' | 'fail';
  passes: {
    normalText: boolean;
    largeText: boolean;
    graphics: boolean;
  };
  recommendation?: string;
}

export interface ColorBlindSimulation {
  type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
  name: string;
  description: string;
  prevalence: string;
}

export interface AccessibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'color' | 'motion' | 'structure' | 'text';
  wcagCriteria: string;
  title: string;
  description: string;
  element?: string;
  recommendation: string;
}

export interface AccessibilityReport {
  score: number; // 0-100
  level: 'A' | 'AA' | 'AAA' | 'non-compliant';
  issues: AccessibilityIssue[];
  colorAnalysis: {
    colors: ColorInfo[];
    contrastPairs: { fg: ColorInfo; bg: ColorInfo; contrast: ContrastResult }[];
    colorBlindSafe: boolean;
  };
  recommendations: string[];
  passedChecks: string[];
}

// Color blind simulation matrices
const COLOR_BLIND_MATRICES: Record<string, number[][]> = {
  // Protanopia (red-blind)
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  // Deuteranopia (green-blind)
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  // Tritanopia (blue-blind)
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
  // Achromatopsia (total color blindness)
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

export const COLOR_BLIND_TYPES: ColorBlindSimulation[] = [
  {
    type: 'protanopia',
    name: 'Protanopia',
    description: 'Red-blind (no red cones)',
    prevalence: '~1% of males',
  },
  {
    type: 'deuteranopia',
    name: 'Deuteranopia',
    description: 'Green-blind (no green cones)',
    prevalence: '~1% of males',
  },
  {
    type: 'tritanopia',
    name: 'Tritanopia',
    description: 'Blue-blind (no blue cones)',
    prevalence: '~0.01% of population',
  },
  {
    type: 'achromatopsia',
    name: 'Achromatopsia',
    description: 'Total color blindness',
    prevalence: '~0.003% of population',
  },
];

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) =>
        Math.round(Math.max(0, Math.min(255, x)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

/**
 * RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Calculate relative luminance (WCAG formula)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluate contrast result against WCAG criteria
 */
export function evaluateContrast(ratio: number): ContrastResult {
  const passes = {
    normalText: ratio >= 4.5,
    largeText: ratio >= 3,
    graphics: ratio >= 3,
  };

  let level: ContrastResult['level'];
  let recommendation: string | undefined;

  if (ratio >= 7) {
    level = 'AAA';
  } else if (ratio >= 4.5) {
    level = 'AA';
  } else if (ratio >= 3) {
    level = 'AA-large';
    recommendation = 'Only suitable for large text (18pt+) or graphics';
  } else {
    level = 'fail';
    recommendation = 'Insufficient contrast. Consider adjusting colors.';
  }

  return { ratio, level, passes, recommendation };
}

/**
 * Simulate color blindness
 */
export function simulateColorBlindness(hex: string, type: ColorBlindSimulation['type']): string {
  const rgb = hexToRgb(hex);
  const matrix = COLOR_BLIND_MATRICES[type];

  const newR = rgb.r * matrix[0][0] + rgb.g * matrix[0][1] + rgb.b * matrix[0][2];
  const newG = rgb.r * matrix[1][0] + rgb.g * matrix[1][1] + rgb.b * matrix[1][2];
  const newB = rgb.r * matrix[2][0] + rgb.g * matrix[2][1] + rgb.b * matrix[2][2];

  return rgbToHex(newR, newG, newB);
}

/**
 * Check if colors are distinguishable for color blind users
 */
export function isColorBlindSafe(colors: string[]): boolean {
  for (const type of Object.keys(COLOR_BLIND_MATRICES) as ColorBlindSimulation['type'][]) {
    const simulated = colors.map((c) => simulateColorBlindness(c, type));

    // Check all pairs
    for (let i = 0; i < simulated.length; i++) {
      for (let j = i + 1; j < simulated.length; j++) {
        const ratio = calculateContrastRatio(simulated[i], simulated[j]);
        if (ratio < 3) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Extract colors from SVG content
 */
export function extractColorsFromSVG(svgContent: string): string[] {
  const colors = new Set<string>();

  // Match hex colors
  const hexMatches = svgContent.matchAll(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/g);
  for (const match of hexMatches) {
    let hex = match[0].toLowerCase();
    // Expand shorthand
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    colors.add(hex);
  }

  // Match rgb/rgba
  const rgbMatches = svgContent.matchAll(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi);
  for (const match of rgbMatches) {
    colors.add(rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3])));
  }

  return Array.from(colors);
}

/**
 * Analyze color for accessibility
 */
export function analyzeColor(hex: string): ColorInfo {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);

  return { hex, rgb, hsl, luminance };
}

/**
 * Suggest accessible alternative color
 */
export function suggestAccessibleAlternative(
  foreground: string,
  background: string,
  targetRatio: number = 4.5
): string {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);
  const bgLum = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  // Determine if we should lighten or darken
  const fgLum = calculateLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const shouldDarken = fgLum > bgLum;

  // Iteratively adjust until target ratio is met
  let adjustedRgb = { ...fgRgb };
  let iterations = 0;
  const maxIterations = 100;

  while (iterations < maxIterations) {
    const currentRatio = calculateContrastRatio(
      rgbToHex(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b),
      background
    );

    if (currentRatio >= targetRatio) {
      break;
    }

    // Adjust color
    const factor = shouldDarken ? 0.95 : 1.05;
    adjustedRgb = {
      r: shouldDarken ? adjustedRgb.r * factor : Math.min(255, adjustedRgb.r * factor),
      g: shouldDarken ? adjustedRgb.g * factor : Math.min(255, adjustedRgb.g * factor),
      b: shouldDarken ? adjustedRgb.b * factor : Math.min(255, adjustedRgb.b * factor),
    };

    iterations++;
  }

  return rgbToHex(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b);
}

/**
 * Check for motion/animation issues
 */
function checkMotionIssues(svgContent: string): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Check for animations
  if (svgContent.includes('<animate') || svgContent.includes('<animateTransform')) {
    issues.push({
      id: 'motion-animation',
      severity: 'warning',
      category: 'motion',
      wcagCriteria: 'WCAG 2.3.3',
      title: 'Animation Detected',
      description: 'SVG contains animations that may affect users with vestibular disorders.',
      recommendation:
        'Provide a way to pause, stop, or hide animations. Consider using prefers-reduced-motion media query.',
    });
  }

  // Check for rapid flashing (simplified check)
  if (svgContent.includes('dur="0.') || svgContent.includes('dur="0"')) {
    issues.push({
      id: 'motion-flashing',
      severity: 'error',
      category: 'motion',
      wcagCriteria: 'WCAG 2.3.1',
      title: 'Potential Rapid Flashing',
      description: 'Fast animation duration detected that could cause seizures.',
      recommendation: 'Ensure animations do not flash more than 3 times per second.',
    });
  }

  return issues;
}

/**
 * Check for structural accessibility issues
 */
function checkStructuralIssues(svgContent: string): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Check for title
  if (!svgContent.includes('<title>')) {
    issues.push({
      id: 'structure-no-title',
      severity: 'error',
      category: 'structure',
      wcagCriteria: 'WCAG 1.1.1',
      title: 'Missing Title',
      description: 'SVG does not have a <title> element for screen readers.',
      recommendation: 'Add a <title> element as the first child of <svg> with a descriptive name.',
    });
  }

  // Check for description
  if (!svgContent.includes('<desc>')) {
    issues.push({
      id: 'structure-no-desc',
      severity: 'warning',
      category: 'structure',
      wcagCriteria: 'WCAG 1.1.1',
      title: 'Missing Description',
      description: 'SVG does not have a <desc> element for detailed description.',
      recommendation: 'Add a <desc> element to provide a detailed description of the graphic.',
    });
  }

  // Check for role
  if (!svgContent.includes('role="img"') && !svgContent.includes('role="presentation"')) {
    issues.push({
      id: 'structure-no-role',
      severity: 'warning',
      category: 'structure',
      wcagCriteria: 'WCAG 4.1.2',
      title: 'Missing Role',
      description: 'SVG does not have an ARIA role attribute.',
      recommendation:
        'Add role="img" for meaningful graphics or role="presentation" for decorative ones.',
    });
  }

  // Check for aria-labelledby or aria-label
  if (!svgContent.includes('aria-label') && !svgContent.includes('aria-labelledby')) {
    issues.push({
      id: 'structure-no-aria',
      severity: 'info',
      category: 'structure',
      wcagCriteria: 'WCAG 4.1.2',
      title: 'Consider ARIA Labels',
      description:
        'SVG could benefit from aria-label or aria-labelledby for better screen reader support.',
      recommendation:
        'Add aria-labelledby pointing to the title element, or aria-label with descriptive text.',
    });
  }

  return issues;
}

/**
 * Generate full accessibility report
 */
export function generateAccessibilityReport(
  svgContent: string,
  backgroundColor: string = '#ffffff'
): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];
  const passedChecks: string[] = [];
  const recommendations: string[] = [];

  // Extract and analyze colors
  const colorHexes = extractColorsFromSVG(svgContent);
  const colors = colorHexes.map(analyzeColor);

  // Analyze contrast pairs
  const contrastPairs: AccessibilityReport['colorAnalysis']['contrastPairs'] = [];

  for (const color of colors) {
    // Check against background
    const bgInfo = analyzeColor(backgroundColor);
    const contrast = evaluateContrast(calculateContrastRatio(color.hex, backgroundColor));

    contrastPairs.push({
      fg: color,
      bg: bgInfo,
      contrast,
    });

    if (contrast.level === 'fail') {
      issues.push({
        id: `color-contrast-${color.hex}`,
        severity: 'error',
        category: 'color',
        wcagCriteria: 'WCAG 1.4.3',
        title: 'Insufficient Contrast',
        description: `Color ${color.hex} has a contrast ratio of ${contrast.ratio.toFixed(2)}:1 against background.`,
        element: color.hex,
        recommendation: `Use ${suggestAccessibleAlternative(color.hex, backgroundColor)} instead for WCAG AA compliance.`,
      });
    } else if (contrast.level === 'AA-large') {
      issues.push({
        id: `color-contrast-large-${color.hex}`,
        severity: 'warning',
        category: 'color',
        wcagCriteria: 'WCAG 1.4.3',
        title: 'Limited Contrast',
        description: `Color ${color.hex} (${contrast.ratio.toFixed(2)}:1) only passes for large text/graphics.`,
        element: color.hex,
        recommendation: 'Consider using higher contrast for better readability.',
      });
    }
  }

  // Check color blind safety
  const colorBlindSafe = isColorBlindSafe(colorHexes);
  if (!colorBlindSafe) {
    issues.push({
      id: 'color-blind-unsafe',
      severity: 'warning',
      category: 'color',
      wcagCriteria: 'WCAG 1.4.1',
      title: 'Color Blind Accessibility',
      description: 'Some colors may be indistinguishable for color blind users.',
      recommendation:
        'Use additional visual cues like patterns or shapes, or adjust color palette.',
    });
  } else {
    passedChecks.push('Color blind safe palette');
  }

  // Check motion issues
  issues.push(...checkMotionIssues(svgContent));

  // Check structural issues
  issues.push(...checkStructuralIssues(svgContent));

  // Calculate score
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5 - infoCount * 1);

  // Determine compliance level
  let level: AccessibilityReport['level'];
  if (errorCount === 0 && warningCount === 0) {
    level = 'AAA';
  } else if (errorCount === 0) {
    level = 'AA';
  } else if (errorCount <= 2) {
    level = 'A';
  } else {
    level = 'non-compliant';
  }

  // Generate recommendations
  if (errorCount > 0) {
    recommendations.push('Address all error-level issues before publishing.');
  }
  if (!colorBlindSafe) {
    recommendations.push('Test pattern with color blindness simulation tools.');
  }
  if (!svgContent.includes('<title>')) {
    recommendations.push('Add descriptive title for screen reader users.');
  }

  // Track passed checks
  if (svgContent.includes('<title>')) {
    passedChecks.push('Has title element');
  }
  if (svgContent.includes('<desc>')) {
    passedChecks.push('Has description element');
  }
  if (!svgContent.includes('<animate')) {
    passedChecks.push('No animations');
  }

  const allContrastPass = contrastPairs.every((p) => p.contrast.level !== 'fail');
  if (allContrastPass) {
    passedChecks.push('All colors meet minimum contrast');
  }

  return {
    score,
    level,
    issues,
    colorAnalysis: {
      colors,
      contrastPairs,
      colorBlindSafe,
    },
    recommendations,
    passedChecks,
  };
}

/**
 * Apply color blind simulation to SVG
 */
export function applyColorBlindSimulation(
  svgContent: string,
  type: ColorBlindSimulation['type']
): string {
  return svgContent.replace(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/g, (match) => {
    let hex = match.toLowerCase();
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return simulateColorBlindness(hex, type);
  });
}

/**
 * Make SVG accessible by adding required elements
 */
export function makeAccessible(svgContent: string, title: string, description: string): string {
  // Add role if missing
  if (!svgContent.includes('role=')) {
    svgContent = svgContent.replace('<svg', '<svg role="img"');
  }

  // Generate IDs
  const titleId = `svg-title-${Math.random().toString(36).slice(2, 8)}`;
  const descId = `svg-desc-${Math.random().toString(36).slice(2, 8)}`;

  // Add aria-labelledby
  if (!svgContent.includes('aria-label')) {
    svgContent = svgContent.replace('<svg', `<svg aria-labelledby="${titleId} ${descId}"`);
  }

  // Find closing > of opening svg tag
  const svgOpenEnd = svgContent.indexOf('>');
  const beforeContent = svgContent.slice(0, svgOpenEnd + 1);
  const afterContent = svgContent.slice(svgOpenEnd + 1);

  // Add title and desc if missing
  let additions = '';
  if (!svgContent.includes('<title>')) {
    additions += `<title id="${titleId}">${title}</title>`;
  }
  if (!svgContent.includes('<desc>')) {
    additions += `<desc id="${descId}">${description}</desc>`;
  }

  return beforeContent + additions + afterContent;
}
