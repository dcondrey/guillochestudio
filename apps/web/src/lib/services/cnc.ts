/**
 * CNC/Laser Export Service
 * G-code generation, DXF export, and machine profiles
 */

import type { Point, PathSegment } from './plotter';

export interface MachineProfile {
  id: string;
  name: string;
  type: 'cnc' | 'laser' | 'plasma';
  workArea: { width: number; height: number }; // mm
  maxFeedRate: number; // mm/min
  maxSpindleSpeed?: number; // RPM (for CNC)
  maxLaserPower?: number; // % or watts
  rapidFeedRate: number; // mm/min
  safeZHeight: number; // mm
  cutDepth?: number; // mm (for CNC)
  firmware: 'grbl' | 'marlin' | 'smoothie' | 'mach3' | 'linuxcnc';
  units: 'mm' | 'inch';
}

export interface CNCSettings {
  machine: MachineProfile;
  operation: 'cut' | 'engrave' | 'score' | 'drill';
  feedRate: number;
  plungeRate: number;
  spindleSpeed?: number;
  laserPower?: number;
  passes: number;
  depthPerPass?: number;
  tabsEnabled?: boolean;
  tabWidth?: number;
  tabHeight?: number;
  coolant?: boolean;
  startGcode?: string;
  endGcode?: string;
}

export interface LaserSettings {
  machine: MachineProfile;
  mode: 'cut' | 'engrave' | 'score';
  power: number; // 0-100%
  speed: number; // mm/min
  passes: number;
  airAssist: boolean;
  focusHeight?: number; // mm
  dpi?: number; // for engraving
  bidirectional?: boolean; // for engraving
}

export interface DXFOptions {
  units: 'mm' | 'inch';
  version: 'R12' | 'R14' | '2000' | '2004' | '2007';
  layerByColor: boolean;
  precision: number;
}

// Common machine profiles
export const MACHINE_PROFILES: MachineProfile[] = [
  {
    id: 'generic-grbl',
    name: 'Generic GRBL CNC',
    type: 'cnc',
    workArea: { width: 300, height: 200 },
    maxFeedRate: 3000,
    maxSpindleSpeed: 24000,
    rapidFeedRate: 5000,
    safeZHeight: 5,
    cutDepth: 3,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'shapeoko-3',
    name: 'Shapeoko 3',
    type: 'cnc',
    workArea: { width: 406, height: 406 },
    maxFeedRate: 5000,
    maxSpindleSpeed: 30000,
    rapidFeedRate: 10000,
    safeZHeight: 10,
    cutDepth: 5,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'x-carve',
    name: 'Inventables X-Carve',
    type: 'cnc',
    workArea: { width: 750, height: 750 },
    maxFeedRate: 4000,
    maxSpindleSpeed: 30000,
    rapidFeedRate: 8000,
    safeZHeight: 10,
    cutDepth: 5,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'nomad-883',
    name: 'Carbide Nomad 883',
    type: 'cnc',
    workArea: { width: 203, height: 203 },
    maxFeedRate: 2500,
    maxSpindleSpeed: 10000,
    rapidFeedRate: 5000,
    safeZHeight: 5,
    cutDepth: 2,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'k40-laser',
    name: 'K40 CO2 Laser',
    type: 'laser',
    workArea: { width: 300, height: 200 },
    maxFeedRate: 6000,
    maxLaserPower: 40,
    rapidFeedRate: 10000,
    safeZHeight: 0,
    firmware: 'smoothie',
    units: 'mm',
  },
  {
    id: 'ortur-lm2',
    name: 'Ortur Laser Master 2',
    type: 'laser',
    workArea: { width: 400, height: 430 },
    maxFeedRate: 10000,
    maxLaserPower: 15,
    rapidFeedRate: 20000,
    safeZHeight: 0,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'glowforge-basic',
    name: 'Glowforge Basic',
    type: 'laser',
    workArea: { width: 495, height: 279 },
    maxFeedRate: 8000,
    maxLaserPower: 40,
    rapidFeedRate: 15000,
    safeZHeight: 0,
    firmware: 'marlin',
    units: 'mm',
  },
  {
    id: 'atomstack-a5',
    name: 'Atomstack A5 Pro',
    type: 'laser',
    workArea: { width: 410, height: 400 },
    maxFeedRate: 10000,
    maxLaserPower: 40,
    rapidFeedRate: 20000,
    safeZHeight: 0,
    firmware: 'grbl',
    units: 'mm',
  },
  {
    id: 'plasma-generic',
    name: 'Generic Plasma Cutter',
    type: 'plasma',
    workArea: { width: 1200, height: 600 },
    maxFeedRate: 4000,
    rapidFeedRate: 10000,
    safeZHeight: 50,
    firmware: 'linuxcnc',
    units: 'mm',
  },
];

// Material presets for laser
export const LASER_MATERIAL_PRESETS: Record<
  string,
  { power: number; speed: number; passes: number }
> = {
  '3mm-acrylic': { power: 80, speed: 300, passes: 1 },
  '5mm-acrylic': { power: 90, speed: 200, passes: 2 },
  '3mm-plywood': { power: 70, speed: 400, passes: 1 },
  '6mm-plywood': { power: 85, speed: 250, passes: 2 },
  cardboard: { power: 30, speed: 800, passes: 1 },
  paper: { power: 15, speed: 1000, passes: 1 },
  'leather-2mm': { power: 50, speed: 400, passes: 1 },
  fabric: { power: 20, speed: 600, passes: 1 },
  'cork-3mm': { power: 40, speed: 500, passes: 1 },
};

// Tool library for CNC
export const CNC_TOOLS: Record<string, { diameter: number; flutes: number; description: string }> =
  {
    'endmill-3mm': { diameter: 3, flutes: 2, description: '3mm 2-Flute End Mill' },
    'endmill-6mm': { diameter: 6, flutes: 2, description: '6mm 2-Flute End Mill' },
    'vbit-60deg': { diameter: 6.35, flutes: 1, description: '60° V-Bit' },
    'vbit-90deg': { diameter: 6.35, flutes: 1, description: '90° V-Bit' },
    'ballnose-3mm': { diameter: 3, flutes: 2, description: '3mm Ball Nose' },
    'ballnose-6mm': { diameter: 6, flutes: 2, description: '6mm Ball Nose' },
    'engraver-0.1mm': { diameter: 0.1, flutes: 1, description: '0.1mm Engraving Bit' },
  };

/**
 * Generate G-code header
 */
function generateGCodeHeader(
  settings: CNCSettings | LaserSettings,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): string[] {
  const lines: string[] = [];
  const machine = settings.machine;

  lines.push('; Generated by Guilloché Studio');
  lines.push(`; Machine: ${machine.name}`);
  lines.push(`; Date: ${new Date().toISOString()}`);
  lines.push(
    `; Bounds: X${bounds.minX.toFixed(3)} to X${bounds.maxX.toFixed(3)}, Y${bounds.minY.toFixed(3)} to Y${bounds.maxY.toFixed(3)}`
  );
  lines.push('');

  // Units
  if (machine.units === 'mm') {
    lines.push('G21 ; Metric units');
  } else {
    lines.push('G20 ; Imperial units');
  }

  // Absolute positioning
  lines.push('G90 ; Absolute positioning');

  // Reset work coordinates
  lines.push('G92 X0 Y0 Z0 ; Set current position as origin');
  lines.push('');

  // Custom start G-code
  if ('startGcode' in settings && settings.startGcode) {
    lines.push('; Custom start G-code');
    lines.push(settings.startGcode);
    lines.push('');
  }

  return lines;
}

/**
 * Generate G-code footer
 */
function generateGCodeFooter(settings: CNCSettings | LaserSettings): string[] {
  const lines: string[] = [];
  const machine = settings.machine;

  lines.push('');
  lines.push('; End of program');

  // Turn off spindle/laser
  if (machine.type === 'cnc') {
    lines.push('M5 ; Spindle off');
  } else if (machine.type === 'laser') {
    lines.push('M5 ; Laser off');
  }

  // Move to safe height
  lines.push(`G0 Z${machine.safeZHeight} ; Safe Z height`);

  // Return to origin
  lines.push('G0 X0 Y0 ; Return to origin');

  // Custom end G-code
  if ('endGcode' in settings && settings.endGcode) {
    lines.push('');
    lines.push('; Custom end G-code');
    lines.push(settings.endGcode);
  }

  // Program end
  lines.push('M2 ; Program end');
  lines.push('%');

  return lines;
}

/**
 * Generate G-code for CNC milling
 */
export function generateCNCGCode(paths: PathSegment[], settings: CNCSettings): string {
  const lines: string[] = [];
  const machine = settings.machine;

  // Calculate bounds
  const bounds = calculateBounds(paths);

  // Header
  lines.push(...generateGCodeHeader(settings, bounds));

  // Set feed rates
  const feedRate = settings.feedRate;
  const plungeRate = settings.plungeRate;
  const safeZ = machine.safeZHeight;
  const cutDepth = settings.depthPerPass ?? machine.cutDepth ?? 1;

  // Spindle on
  if (settings.spindleSpeed) {
    lines.push(`S${settings.spindleSpeed} M3 ; Spindle on CW at ${settings.spindleSpeed} RPM`);
    lines.push('G4 P2 ; Dwell 2 seconds for spindle spin-up');
  }

  // Coolant
  if (settings.coolant) {
    lines.push('M8 ; Coolant on');
  }

  lines.push('');

  // Process each path for each pass
  for (let pass = 0; pass < settings.passes; pass++) {
    const zDepth = -cutDepth * (pass + 1);

    lines.push(`; Pass ${pass + 1} of ${settings.passes}`);
    lines.push(`; Depth: ${zDepth.toFixed(3)}mm`);
    lines.push('');

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
      if (path.points.length === 0) continue;

      lines.push(`; Path ${pathIndex + 1}`);

      // Rapid move to safe height
      lines.push(`G0 Z${safeZ}`);

      // Rapid move to start position
      const start = path.points[0];
      lines.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);

      // Plunge to cutting depth
      lines.push(`G1 Z${zDepth.toFixed(3)} F${plungeRate}`);

      // Cut path
      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} F${feedRate}`);
      }

      // Close path if needed
      if (path.closed && path.points.length > 2) {
        lines.push(`G1 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);
      }

      // Retract
      lines.push(`G0 Z${safeZ}`);
      lines.push('');
    }
  }

  // Footer
  if (settings.coolant) {
    lines.push('M9 ; Coolant off');
  }
  lines.push(...generateGCodeFooter(settings));

  return lines.join('\n');
}

/**
 * Generate G-code for laser cutting/engraving
 */
export function generateLaserGCode(paths: PathSegment[], settings: LaserSettings): string {
  const lines: string[] = [];
  const machine = settings.machine;

  // Calculate bounds
  const bounds = calculateBounds(paths);

  // Header
  lines.push(...generateGCodeHeader(settings, bounds));

  // Laser-specific setup
  if (machine.firmware === 'grbl') {
    lines.push('$32=1 ; Laser mode on');
  }

  // Set power (S value for GRBL, varies by firmware)
  const maxPower = machine.firmware === 'grbl' ? 1000 : 255;
  const powerValue = Math.round((settings.power / 100) * maxPower);

  lines.push('');
  lines.push(`; Power: ${settings.power}%`);
  lines.push(`; Speed: ${settings.speed} mm/min`);
  lines.push(`; Passes: ${settings.passes}`);

  // Air assist
  if (settings.airAssist) {
    lines.push('M8 ; Air assist on');
  }

  lines.push('');

  // Process each pass
  for (let pass = 0; pass < settings.passes; pass++) {
    lines.push(`; Pass ${pass + 1} of ${settings.passes}`);
    lines.push('');

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
      if (path.points.length === 0) continue;

      lines.push(`; Path ${pathIndex + 1}`);

      // Rapid move to start position (laser off)
      const start = path.points[0];
      lines.push('M5 ; Laser off');
      lines.push(`G0 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);

      // Laser on and cut
      lines.push(`M3 S${powerValue} ; Laser on at ${settings.power}%`);

      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} F${settings.speed}`);
      }

      // Close path if needed
      if (path.closed && path.points.length > 2) {
        lines.push(`G1 X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`);
      }

      lines.push('M5 ; Laser off');
      lines.push('');
    }
  }

  // Footer
  if (settings.airAssist) {
    lines.push('M9 ; Air assist off');
  }
  lines.push(...generateGCodeFooter(settings));

  return lines.join('\n');
}

/**
 * Generate DXF file
 */
export function generateDXF(
  paths: PathSegment[],
  options: DXFOptions = {
    units: 'mm',
    version: '2000',
    layerByColor: true,
    precision: 4,
  }
): string {
  const lines: string[] = [];
  const precision = options.precision;

  // Header section
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('HEADER');

  // DXF version
  lines.push('9');
  lines.push('$ACADVER');
  lines.push('1');
  switch (options.version) {
    case 'R12':
      lines.push('AC1009');
      break;
    case 'R14':
      lines.push('AC1014');
      break;
    case '2000':
      lines.push('AC1015');
      break;
    case '2004':
      lines.push('AC1018');
      break;
    case '2007':
      lines.push('AC1021');
      break;
  }

  // Units
  lines.push('9');
  lines.push('$INSUNITS');
  lines.push('70');
  lines.push(options.units === 'mm' ? '4' : '1');

  lines.push('0');
  lines.push('ENDSEC');

  // Tables section (layers)
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('TABLES');

  lines.push('0');
  lines.push('TABLE');
  lines.push('2');
  lines.push('LAYER');

  // Default layer
  lines.push('0');
  lines.push('LAYER');
  lines.push('2');
  lines.push('0');
  lines.push('70');
  lines.push('0');
  lines.push('62');
  lines.push('7'); // White

  // Color layers if needed
  if (options.layerByColor) {
    const colors = new Set(paths.map((p) => p.color || '#000000'));
    let colorIndex = 1;
    for (const _color of colors) {
      lines.push('0');
      lines.push('LAYER');
      lines.push('2');
      lines.push(`Layer_${colorIndex}`);
      lines.push('70');
      lines.push('0');
      lines.push('62');
      lines.push(String(colorIndex));
      colorIndex++;
    }
  }

  lines.push('0');
  lines.push('ENDTAB');
  lines.push('0');
  lines.push('ENDSEC');

  // Entities section
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('ENTITIES');

  // Draw paths as polylines
  let layerIndex = 1;
  const colorToLayer = new Map<string, number>();

  for (const path of paths) {
    if (path.points.length < 2) continue;

    const color = path.color || '#000000';
    if (!colorToLayer.has(color)) {
      colorToLayer.set(color, layerIndex++);
    }
    const layer = options.layerByColor ? `Layer_${colorToLayer.get(color)}` : '0';

    // LWPOLYLINE (lightweight polyline)
    lines.push('0');
    lines.push('LWPOLYLINE');
    lines.push('8');
    lines.push(layer);
    lines.push('100');
    lines.push('AcDbPolyline');
    lines.push('90');
    lines.push(String(path.points.length));
    lines.push('70');
    lines.push(path.closed ? '1' : '0'); // Closed flag

    for (const point of path.points) {
      lines.push('10');
      lines.push(point.x.toFixed(precision));
      lines.push('20');
      lines.push(point.y.toFixed(precision));
    }
  }

  lines.push('0');
  lines.push('ENDSEC');

  // End of file
  lines.push('0');
  lines.push('EOF');

  return lines.join('\n');
}

/**
 * Calculate bounding box of paths
 */
function calculateBounds(paths: PathSegment[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    for (const point of path.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Estimate job time
 */
export function estimateJobTime(
  paths: PathSegment[],
  feedRate: number,
  rapidRate: number
): { totalTime: number; cuttingTime: number; rapidTime: number; pathLength: number } {
  let pathLength = 0;
  let rapidLength = 0;
  let lastPoint: Point | null = null;

  for (const path of paths) {
    if (path.points.length === 0) continue;

    // Rapid move to start
    if (lastPoint) {
      rapidLength += distance(lastPoint, path.points[0]);
    }

    // Path length
    for (let i = 1; i < path.points.length; i++) {
      pathLength += distance(path.points[i - 1], path.points[i]);
    }

    lastPoint = path.points[path.points.length - 1];
  }

  const cuttingTime = pathLength / feedRate; // minutes
  const rapidTime = rapidLength / rapidRate; // minutes
  const totalTime = cuttingTime + rapidTime;

  return {
    totalTime: totalTime * 60, // seconds
    cuttingTime: cuttingTime * 60,
    rapidTime: rapidTime * 60,
    pathLength,
  };
}

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Download G-code file
 */
export function downloadGCode(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.gcode') ? filename : `${filename}.gcode`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download DXF file
 */
export function downloadDXF(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
