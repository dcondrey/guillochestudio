/**
 * Print Production Service
 * Paper presets, color profiles, bleed settings, tiling, and PDF generation
 */

export interface PaperSize {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  category: 'standard' | 'photo' | 'large' | 'custom';
}

export interface PrintSettings {
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  bleed: number; // mm
  margin: number; // mm
  scale: number; // 1 = 100%
  fitToPage: boolean;
  centerOnPage: boolean;
  colorProfile: ColorProfile;
  dpi: number;
  showCropMarks: boolean;
  showRegistrationMarks: boolean;
  showColorBars: boolean;
  showPageInfo: boolean;
}

export interface ColorProfile {
  id: string;
  name: string;
  type: 'rgb' | 'cmyk' | 'spot';
  description: string;
  renderingIntent: 'perceptual' | 'relative' | 'saturation' | 'absolute';
  blackPoint: boolean;
}

export interface TileSettings {
  enabled: boolean;
  rows: number;
  cols: number;
  overlap: number; // mm
  showTileNumbers: boolean;
  showCutLines: boolean;
}

export interface PrintJob {
  id: string;
  settings: PrintSettings;
  tiling: TileSettings;
  pages: PrintPage[];
  createdAt: string;
}

export interface PrintPage {
  pageNumber: number;
  tileRow?: number;
  tileCol?: number;
  svgContent: string;
  pdfBlob?: Blob;
}

// Standard paper sizes
export const PAPER_SIZES: PaperSize[] = [
  // ISO A Series
  { id: 'a0', name: 'A0', width: 841, height: 1189, category: 'large' },
  { id: 'a1', name: 'A1', width: 594, height: 841, category: 'large' },
  { id: 'a2', name: 'A2', width: 420, height: 594, category: 'large' },
  { id: 'a3', name: 'A3', width: 297, height: 420, category: 'standard' },
  { id: 'a4', name: 'A4', width: 210, height: 297, category: 'standard' },
  { id: 'a5', name: 'A5', width: 148, height: 210, category: 'standard' },
  { id: 'a6', name: 'A6', width: 105, height: 148, category: 'standard' },

  // US Paper Sizes
  { id: 'letter', name: 'Letter', width: 215.9, height: 279.4, category: 'standard' },
  { id: 'legal', name: 'Legal', width: 215.9, height: 355.6, category: 'standard' },
  { id: 'tabloid', name: 'Tabloid', width: 279.4, height: 431.8, category: 'large' },
  { id: 'ledger', name: 'Ledger', width: 431.8, height: 279.4, category: 'large' },

  // Photo Sizes
  { id: 'photo-4x6', name: '4x6"', width: 101.6, height: 152.4, category: 'photo' },
  { id: 'photo-5x7', name: '5x7"', width: 127, height: 177.8, category: 'photo' },
  { id: 'photo-8x10', name: '8x10"', width: 203.2, height: 254, category: 'photo' },
  { id: 'photo-11x14', name: '11x14"', width: 279.4, height: 355.6, category: 'photo' },

  // Square
  { id: 'square-5', name: '5" Square', width: 127, height: 127, category: 'photo' },
  { id: 'square-8', name: '8" Square', width: 203.2, height: 203.2, category: 'photo' },
  { id: 'square-12', name: '12" Square', width: 304.8, height: 304.8, category: 'photo' },

  // Business
  { id: 'business-card', name: 'Business Card', width: 88.9, height: 50.8, category: 'standard' },
  { id: 'postcard', name: 'Postcard', width: 152.4, height: 101.6, category: 'standard' },
];

// Color profiles
export const COLOR_PROFILES: ColorProfile[] = [
  {
    id: 'srgb',
    name: 'sRGB',
    type: 'rgb',
    description: 'Standard RGB for web and general use',
    renderingIntent: 'relative',
    blackPoint: true,
  },
  {
    id: 'display-p3',
    name: 'Display P3',
    type: 'rgb',
    description: 'Wide gamut RGB for modern displays',
    renderingIntent: 'perceptual',
    blackPoint: true,
  },
  {
    id: 'adobe-rgb',
    name: 'Adobe RGB (1998)',
    type: 'rgb',
    description: 'Wide gamut RGB for print workflows',
    renderingIntent: 'relative',
    blackPoint: true,
  },
  {
    id: 'fogra39',
    name: 'FOGRA39 (ISO Coated v2)',
    type: 'cmyk',
    description: 'European coated paper standard',
    renderingIntent: 'relative',
    blackPoint: true,
  },
  {
    id: 'gracol2006',
    name: 'GRACoL 2006',
    type: 'cmyk',
    description: 'US commercial printing standard',
    renderingIntent: 'relative',
    blackPoint: true,
  },
  {
    id: 'swop2006',
    name: 'SWOP 2006',
    type: 'cmyk',
    description: 'US web offset publication standard',
    renderingIntent: 'relative',
    blackPoint: true,
  },
  {
    id: 'us-web-uncoated',
    name: 'US Web Uncoated',
    type: 'cmyk',
    description: 'US uncoated paper standard',
    renderingIntent: 'relative',
    blackPoint: true,
  },
];

// Default print settings
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: PAPER_SIZES.find((p) => p.id === 'a4')!,
  orientation: 'portrait',
  bleed: 3,
  margin: 10,
  scale: 1,
  fitToPage: true,
  centerOnPage: true,
  colorProfile: COLOR_PROFILES[0],
  dpi: 300,
  showCropMarks: true,
  showRegistrationMarks: true,
  showColorBars: false,
  showPageInfo: true,
};

// Default tile settings
export const DEFAULT_TILE_SETTINGS: TileSettings = {
  enabled: false,
  rows: 2,
  cols: 2,
  overlap: 10,
  showTileNumbers: true,
  showCutLines: true,
};

/**
 * Calculate effective print area
 */
export function calculatePrintArea(settings: PrintSettings): {
  width: number;
  height: number;
  artboardWidth: number;
  artboardHeight: number;
  offsetX: number;
  offsetY: number;
} {
  const { paperSize, orientation, bleed, margin } = settings;

  // Swap dimensions for landscape
  const paperWidth = orientation === 'landscape' ? paperSize.height : paperSize.width;
  const paperHeight = orientation === 'landscape' ? paperSize.width : paperSize.height;

  // Full page with bleed
  const totalWidth = paperWidth + bleed * 2;
  const totalHeight = paperHeight + bleed * 2;

  // Safe print area (inside margins)
  const artboardWidth = paperWidth - margin * 2;
  const artboardHeight = paperHeight - margin * 2;

  // Offset from edge to artboard
  const offsetX = bleed + margin;
  const offsetY = bleed + margin;

  return {
    width: totalWidth,
    height: totalHeight,
    artboardWidth,
    artboardHeight,
    offsetX,
    offsetY,
  };
}

/**
 * Generate crop marks SVG
 */
function generateCropMarks(
  width: number,
  height: number,
  bleed: number,
  markLength = 10,
  markOffset = 3
): string {
  const marks: string[] = [];
  const strokeWidth = 0.25;

  // Top-left corner
  marks.push(
    `<line x1="${bleed - markOffset - markLength}" y1="${bleed}" x2="${bleed - markOffset}" y2="${bleed}" />`,
    `<line x1="${bleed}" y1="${bleed - markOffset - markLength}" x2="${bleed}" y2="${bleed - markOffset}" />`
  );

  // Top-right corner
  marks.push(
    `<line x1="${width - bleed + markOffset}" y1="${bleed}" x2="${width - bleed + markOffset + markLength}" y2="${bleed}" />`,
    `<line x1="${width - bleed}" y1="${bleed - markOffset - markLength}" x2="${width - bleed}" y2="${bleed - markOffset}" />`
  );

  // Bottom-left corner
  marks.push(
    `<line x1="${bleed - markOffset - markLength}" y1="${height - bleed}" x2="${bleed - markOffset}" y2="${height - bleed}" />`,
    `<line x1="${bleed}" y1="${height - bleed + markOffset}" x2="${bleed}" y2="${height - bleed + markOffset + markLength}" />`
  );

  // Bottom-right corner
  marks.push(
    `<line x1="${width - bleed + markOffset}" y1="${height - bleed}" x2="${width - bleed + markOffset + markLength}" y2="${height - bleed}" />`,
    `<line x1="${width - bleed}" y1="${height - bleed + markOffset}" x2="${width - bleed}" y2="${height - bleed + markOffset + markLength}" />`
  );

  return `<g stroke="#000000" stroke-width="${strokeWidth}" fill="none">${marks.join('')}</g>`;
}

/**
 * Generate registration marks SVG
 */
function generateRegistrationMarks(
  width: number,
  height: number,
  bleed: number,
  markOffset = 5
): string {
  const marks: string[] = [];
  const strokeWidth = 0.25;
  const markSize = 6;

  // Generate registration mark at a position
  const regMark = (cx: number, cy: number) => `
    <g transform="translate(${cx},${cy})">
      <circle r="${markSize / 2}" fill="none" stroke="#000000" stroke-width="${strokeWidth}"/>
      <line x1="${-markSize}" y1="0" x2="${markSize}" y2="0" stroke="#000000" stroke-width="${strokeWidth}"/>
      <line x1="0" y1="${-markSize}" x2="0" y2="${markSize}" stroke="#000000" stroke-width="${strokeWidth}"/>
    </g>
  `;

  // Center of each edge
  marks.push(regMark(width / 2, bleed - markOffset - markSize)); // Top center
  marks.push(regMark(width / 2, height - bleed + markOffset + markSize)); // Bottom center
  marks.push(regMark(bleed - markOffset - markSize, height / 2)); // Left center
  marks.push(regMark(width - bleed + markOffset + markSize, height / 2)); // Right center

  return `<g>${marks.join('')}</g>`;
}

/**
 * Generate color bars SVG
 */
function generateColorBars(width: number, height: number, bleed: number, barHeight = 5): string {
  const colors = [
    '#FFFFFF',
    '#000000', // White, Black
    '#FF0000',
    '#00FF00',
    '#0000FF', // RGB
    '#00FFFF',
    '#FF00FF',
    '#FFFF00', // CMY
    '#808080',
    '#C0C0C0', // Grays
  ];

  const barWidth = (width - bleed * 2) / colors.length;
  const y = bleed - barHeight - 5;

  const bars = colors.map(
    (color, i) =>
      `<rect x="${bleed + i * barWidth}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" stroke="#000000" stroke-width="0.1"/>`
  );

  return `<g>${bars.join('')}</g>`;
}

/**
 * Generate page info text
 */
function generatePageInfo(settings: PrintSettings, pageNumber: number, totalPages: number): string {
  const { paperSize, colorProfile, dpi } = settings;
  const y = settings.paperSize.height + settings.bleed * 2 - 2;

  const text = `${paperSize.name} | ${colorProfile.name} | ${dpi}DPI | Page ${pageNumber}/${totalPages}`;

  return `<text x="5" y="${y}" font-family="Helvetica, Arial" font-size="6" fill="#666666">${text}</text>`;
}

/**
 * Calculate tile pages
 */
export function calculateTiles(
  patternWidth: number,
  patternHeight: number,
  settings: PrintSettings,
  tileSettings: TileSettings
): { rows: number; cols: number; tileWidth: number; tileHeight: number } {
  const { artboardWidth, artboardHeight } = calculatePrintArea(settings);

  if (!tileSettings.enabled) {
    return {
      rows: 1,
      cols: 1,
      tileWidth: patternWidth,
      tileHeight: patternHeight,
    };
  }

  // If manual rows/cols specified
  if (tileSettings.rows > 0 && tileSettings.cols > 0) {
    const tileWidth = patternWidth / tileSettings.cols + tileSettings.overlap;
    const tileHeight = patternHeight / tileSettings.rows + tileSettings.overlap;
    return {
      rows: tileSettings.rows,
      cols: tileSettings.cols,
      tileWidth,
      tileHeight,
    };
  }

  // Auto-calculate based on paper size
  const cols = Math.ceil(patternWidth / (artboardWidth - tileSettings.overlap));
  const rows = Math.ceil(patternHeight / (artboardHeight - tileSettings.overlap));

  const tileWidth = patternWidth / cols + tileSettings.overlap;
  const tileHeight = patternHeight / rows + tileSettings.overlap;

  return { rows, cols, tileWidth, tileHeight };
}

/**
 * Generate print-ready SVG for a single page
 */
export function generatePrintSVG(
  patternSvg: string,
  settings: PrintSettings,
  pageNumber: number,
  totalPages: number,
  tileInfo?: { row: number; col: number; tileWidth: number; tileHeight: number }
): string {
  const printArea = calculatePrintArea(settings);
  const { width, height, artboardWidth, artboardHeight, offsetX, offsetY } = printArea;

  // Convert mm to points (1mm = 2.834645669291339 pt)
  const mmToPt = 2.834645669291339;

  // Extract viewBox and content from pattern SVG
  const viewBoxMatch = patternSvg.match(/viewBox="([^"]+)"/);
  const patternViewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 400 400';
  const [, , patternW, patternH] = patternViewBox.split(' ').map(parseFloat);

  // Calculate scale and position
  let scale = settings.scale;
  if (settings.fitToPage) {
    const scaleX = artboardWidth / patternW;
    const scaleY = artboardHeight / patternH;
    scale = Math.min(scaleX, scaleY);
  }

  const scaledWidth = patternW * scale;
  const scaledHeight = patternH * scale;

  let translateX = offsetX;
  let translateY = offsetY;

  if (settings.centerOnPage) {
    translateX += (artboardWidth - scaledWidth) / 2;
    translateY += (artboardHeight - scaledHeight) / 2;
  }

  // Handle tiling viewport
  let viewportClip = '';
  let tileTranslate = '';
  if (tileInfo) {
    const tileX = tileInfo.col * (tileInfo.tileWidth - 10); // overlap
    const tileY = tileInfo.row * (tileInfo.tileHeight - 10);
    viewportClip = `<clipPath id="tile-clip">
      <rect x="${offsetX}" y="${offsetY}" width="${artboardWidth}" height="${artboardHeight}"/>
    </clipPath>`;
    tileTranslate = `translate(${-tileX * scale}, ${-tileY * scale})`;
  }

  // Build SVG
  const svgParts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg"
          width="${width}mm" height="${height}mm"
          viewBox="0 0 ${width} ${height}">`,
  ];

  // Defs
  svgParts.push(`<defs>${viewportClip}</defs>`);

  // Background (bleed area)
  svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  // Pattern content
  const clipAttr = tileInfo ? 'clip-path="url(#tile-clip)"' : '';
  svgParts.push(`
    <g transform="translate(${translateX}, ${translateY}) scale(${scale}) ${tileTranslate}" ${clipAttr}>
      ${patternSvg.replace(/<\/?svg[^>]*>/g, '')}
    </g>
  `);

  // Print marks
  if (settings.showCropMarks) {
    svgParts.push(generateCropMarks(width, height, settings.bleed));
  }

  if (settings.showRegistrationMarks) {
    svgParts.push(generateRegistrationMarks(width, height, settings.bleed));
  }

  if (settings.showColorBars) {
    svgParts.push(generateColorBars(width, height, settings.bleed));
  }

  if (settings.showPageInfo) {
    svgParts.push(generatePageInfo(settings, pageNumber, totalPages));
  }

  // Tile number indicator
  if (tileInfo && DEFAULT_TILE_SETTINGS.showTileNumbers) {
    const tileLabel = `Tile ${tileInfo.row + 1}-${tileInfo.col + 1}`;
    svgParts.push(
      `<text x="${width - 5}" y="${height - 2}" font-family="Helvetica" font-size="6" fill="#666666" text-anchor="end">${tileLabel}</text>`
    );
  }

  svgParts.push('</svg>');

  return svgParts.join('\n');
}

/**
 * Generate multi-page print job
 */
export function generatePrintJob(
  patternSvg: string,
  patternWidth: number,
  patternHeight: number,
  settings: PrintSettings,
  tileSettings: TileSettings
): PrintJob {
  const pages: PrintPage[] = [];
  const tiles = calculateTiles(patternWidth, patternHeight, settings, tileSettings);

  const totalPages = tiles.rows * tiles.cols;
  let pageNumber = 1;

  for (let row = 0; row < tiles.rows; row++) {
    for (let col = 0; col < tiles.cols; col++) {
      const tileInfo = tileSettings.enabled
        ? { row, col, tileWidth: tiles.tileWidth, tileHeight: tiles.tileHeight }
        : undefined;

      const svgContent = generatePrintSVG(patternSvg, settings, pageNumber, totalPages, tileInfo);

      pages.push({
        pageNumber,
        tileRow: row,
        tileCol: col,
        svgContent,
      });

      pageNumber++;
    }
  }

  return {
    id: crypto.randomUUID(),
    settings,
    tiling: tileSettings,
    pages,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert RGB color to CMYK (simplified)
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  // Normalize to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Calculate K (black)
  const k = 1 - Math.max(rNorm, gNorm, bNorm);

  // Handle pure black
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  // Calculate CMY
  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Simulate CMYK preview (desaturate based on gamut)
 */
export function simulateCMYKPreview(svgContent: string): string {
  // Simple simulation - reduce saturation and adjust colors
  return svgContent.replace(/#([a-fA-F0-9]{6})/g, (match, hex) => {
    const rgb = hexToRgb(match);
    if (!rgb) return match;

    // Reduce gamut by limiting saturation
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    // CMYK has narrower gamut, reduce vivid colors
    if (saturation > 0.8) {
      const factor = 0.9;
      return `#${Math.round(rgb.r * factor)
        .toString(16)
        .padStart(2, '0')}${Math.round(rgb.g * factor)
        .toString(16)
        .padStart(2, '0')}${Math.round(rgb.b * factor)
        .toString(16)
        .padStart(2, '0')}`;
    }

    return match;
  });
}

/**
 * Download SVG as file
 */
export function downloadSVG(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download all pages as zip (requires JSZip)
 */
export async function downloadPrintJob(job: PrintJob): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const folder = zip.folder(`guilloche-print-${job.id.slice(0, 8)}`);
  if (!folder) return;

  for (const page of job.pages) {
    const filename = job.tiling.enabled
      ? `tile-${page.tileRow! + 1}-${page.tileCol! + 1}.svg`
      : `page-${page.pageNumber}.svg`;
    folder.file(filename, page.svgContent);
  }

  // Add info file
  const info = `Guilloché Pattern Print Job
Generated: ${new Date().toISOString()}
Paper: ${job.settings.paperSize.name}
Orientation: ${job.settings.orientation}
Color Profile: ${job.settings.colorProfile.name}
DPI: ${job.settings.dpi}
Pages: ${job.pages.length}
${job.tiling.enabled ? `Tiling: ${job.tiling.rows}x${job.tiling.cols}` : 'Tiling: None'}
`;
  folder.file('info.txt', info);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guilloche-print-${job.id.slice(0, 8)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
