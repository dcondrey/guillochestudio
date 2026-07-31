/**
 * Pen Plotter Optimization Service
 * Path reordering, travel optimization, and hardware integration
 */

export interface Point {
  x: number;
  y: number;
}

export interface PathSegment {
  id: string;
  points: Point[];
  color?: string;
  penIndex?: number;
  closed: boolean;
}

export interface PlotterConfig {
  name: string;
  maxWidth: number; // mm
  maxHeight: number; // mm
  maxSpeed: number; // mm/s
  penUpHeight: number;
  penDownHeight: number;
  acceleration: number;
  homePosition: Point;
}

export interface MaterialPreset {
  id: string;
  name: string;
  description: string;
  speed: number; // Percentage of max speed
  penPressure: number; // 0-100
  passes: number;
  penUpDelay: number; // ms
  penDownDelay: number; // ms
  recommended: string[];
}

export interface OptimizationResult {
  paths: PathSegment[];
  originalDistance: number;
  optimizedDistance: number;
  savings: number;
  estimatedTime: number;
  travelPaths: PathSegment[];
}

export interface PlotterStatus {
  connected: boolean;
  plotting: boolean;
  paused: boolean;
  progress: number;
  currentPath: number;
  totalPaths: number;
  estimatedTimeRemaining: number;
  position: Point;
  error?: string;
}

// Common plotter configurations
export const PLOTTER_PRESETS: Record<string, PlotterConfig> = {
  'axidraw-v3': {
    name: 'AxiDraw V3',
    maxWidth: 297,
    maxHeight: 218,
    maxSpeed: 100,
    penUpHeight: 60,
    penDownHeight: 40,
    acceleration: 75,
    homePosition: { x: 0, y: 0 },
  },
  'axidraw-v3-a3': {
    name: 'AxiDraw V3/A3',
    maxWidth: 430,
    maxHeight: 297,
    maxSpeed: 100,
    penUpHeight: 60,
    penDownHeight: 40,
    acceleration: 75,
    homePosition: { x: 0, y: 0 },
  },
  'axidraw-se-a3': {
    name: 'AxiDraw SE/A3',
    maxWidth: 430,
    maxHeight: 297,
    maxSpeed: 150,
    penUpHeight: 60,
    penDownHeight: 40,
    acceleration: 100,
    homePosition: { x: 0, y: 0 },
  },
  'axidraw-minikit': {
    name: 'AxiDraw MiniKit',
    maxWidth: 152,
    maxHeight: 101,
    maxSpeed: 80,
    penUpHeight: 60,
    penDownHeight: 40,
    acceleration: 60,
    homePosition: { x: 0, y: 0 },
  },
  'hp-7475a': {
    name: 'HP 7475A',
    maxWidth: 420,
    maxHeight: 297,
    maxSpeed: 381,
    penUpHeight: 0,
    penDownHeight: 1,
    acceleration: 100,
    homePosition: { x: 0, y: 0 },
  },
  'roland-dxy-1300': {
    name: 'Roland DXY-1300',
    maxWidth: 420,
    maxHeight: 297,
    maxSpeed: 300,
    penUpHeight: 0,
    penDownHeight: 1,
    acceleration: 80,
    homePosition: { x: 0, y: 0 },
  },
  custom: {
    name: 'Custom Plotter',
    maxWidth: 297,
    maxHeight: 210,
    maxSpeed: 100,
    penUpHeight: 60,
    penDownHeight: 40,
    acceleration: 75,
    homePosition: { x: 0, y: 0 },
  },
};

// Material presets for different drawing surfaces
export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'standard-paper',
    name: 'Standard Paper',
    description: 'Copy paper, printer paper (70-90gsm)',
    speed: 80,
    penPressure: 50,
    passes: 1,
    penUpDelay: 100,
    penDownDelay: 100,
    recommended: ['ballpoint', 'felt-tip', 'rollerball'],
  },
  {
    id: 'card-stock',
    name: 'Card Stock',
    description: 'Thick paper, Bristol board (200-300gsm)',
    speed: 60,
    penPressure: 60,
    passes: 1,
    penUpDelay: 150,
    penDownDelay: 150,
    recommended: ['felt-tip', 'pigment-liner', 'brush-pen'],
  },
  {
    id: 'watercolor-paper',
    name: 'Watercolor Paper',
    description: 'Textured art paper (300gsm+)',
    speed: 40,
    penPressure: 70,
    passes: 1,
    penUpDelay: 200,
    penDownDelay: 200,
    recommended: ['brush-pen', 'fountain-pen', 'dip-pen'],
  },
  {
    id: 'tracing-paper',
    name: 'Tracing Paper',
    description: 'Translucent paper, vellum',
    speed: 50,
    penPressure: 30,
    passes: 1,
    penUpDelay: 100,
    penDownDelay: 150,
    recommended: ['fine-liner', 'technical-pen'],
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Primed canvas or canvas paper',
    speed: 30,
    penPressure: 80,
    passes: 2,
    penUpDelay: 250,
    penDownDelay: 250,
    recommended: ['paint-marker', 'brush-pen'],
  },
  {
    id: 'wood',
    name: 'Wood Surface',
    description: 'Smooth wood, plywood, MDF',
    speed: 25,
    penPressure: 85,
    passes: 2,
    penUpDelay: 300,
    penDownDelay: 300,
    recommended: ['paint-marker', 'permanent-marker'],
  },
  {
    id: 'glass',
    name: 'Glass/Acrylic',
    description: 'Smooth non-porous surfaces',
    speed: 20,
    penPressure: 40,
    passes: 1,
    penUpDelay: 500,
    penDownDelay: 300,
    recommended: ['paint-marker', 'glass-marker'],
  },
  {
    id: 'metal',
    name: 'Metal Surface',
    description: 'Aluminum, steel (coated or primed)',
    speed: 15,
    penPressure: 60,
    passes: 2,
    penUpDelay: 400,
    penDownDelay: 400,
    recommended: ['paint-marker', 'oil-based-marker'],
  },
];

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Get total path length
function pathLength(segment: PathSegment): number {
  let length = 0;
  for (let i = 1; i < segment.points.length; i++) {
    length += distance(segment.points[i - 1], segment.points[i]);
  }
  return length;
}

// Calculate total travel distance for a path order
function calculateTravelDistance(paths: PathSegment[], startPoint: Point): number {
  let totalDistance = 0;
  let currentPoint = startPoint;

  for (const path of paths) {
    if (path.points.length === 0) continue;

    // Distance to start of path
    totalDistance += distance(currentPoint, path.points[0]);

    // Move to end of path
    currentPoint = path.points[path.points.length - 1];
  }

  return totalDistance;
}

// Nearest neighbor algorithm for path ordering.
// With allowReversal, an open path may be plotted end-to-start when that lands
// the pen closer, which cuts travel but flips the drawing direction.
function nearestNeighborSort(
  paths: PathSegment[],
  startPoint: Point,
  allowReversal = true
): PathSegment[] {
  if (paths.length <= 1) return [...paths];

  const result: PathSegment[] = [];
  const remaining = [...paths];
  let currentPoint = startPoint;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    let reverseNearest = false;

    for (let i = 0; i < remaining.length; i++) {
      const path = remaining[i];
      if (path.points.length === 0) continue;

      // Check distance to start of path
      const distToStart = distance(currentPoint, path.points[0]);
      if (distToStart < nearestDistance) {
        nearestDistance = distToStart;
        nearestIndex = i;
        reverseNearest = false;
      }

      // Check distance to end of path (if not closed, can reverse)
      if (allowReversal && !path.closed) {
        const distToEnd = distance(currentPoint, path.points[path.points.length - 1]);
        if (distToEnd < nearestDistance) {
          nearestDistance = distToEnd;
          nearestIndex = i;
          reverseNearest = true;
        }
      }
    }

    const found = remaining.splice(nearestIndex, 1)[0];

    // Copy rather than assign, so reordering never mutates the caller's segments.
    const nearestPath = reverseNearest ? { ...found, points: [...found.points].reverse() } : found;

    result.push(nearestPath);
    currentPoint = nearestPath.points[nearestPath.points.length - 1];
  }

  return result;
}

// 2-opt improvement for path ordering
function twoOptImprove(paths: PathSegment[], startPoint: Point): PathSegment[] {
  if (paths.length <= 2) return paths;

  const result = [...paths];
  let improved = true;
  let iterations = 0;
  const maxIterations = paths.length * 10;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    const currentDistance = calculateTravelDistance(result, startPoint);

    for (let i = 0; i < result.length - 1; i++) {
      for (let j = i + 1; j < result.length; j++) {
        // Reverse the segment between i and j
        const newOrder = [
          ...result.slice(0, i),
          ...result.slice(i, j + 1).reverse(),
          ...result.slice(j + 1),
        ];

        const newDistance = calculateTravelDistance(newOrder, startPoint);

        if (newDistance < currentDistance) {
          result.splice(0, result.length, ...newOrder);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return result;
}

// Group paths by color/pen for multi-pen plotting
function groupByPen(paths: PathSegment[]): Map<number, PathSegment[]> {
  const groups = new Map<number, PathSegment[]>();

  for (const path of paths) {
    const penIndex = path.penIndex ?? 0;
    if (!groups.has(penIndex)) {
      groups.set(penIndex, []);
    }
    groups.get(penIndex)!.push(path);
  }

  return groups;
}

/**
 * Optimize paths for pen plotter
 */
export function optimizePaths(
  paths: PathSegment[],
  config: PlotterConfig,
  options: {
    groupByColor?: boolean;
    useReversal?: boolean;
    use2Opt?: boolean;
  } = {}
): OptimizationResult {
  const { groupByColor = true, useReversal = true, use2Opt = true } = options;
  const startPoint = config.homePosition;

  // Calculate original travel distance
  const originalDistance = calculateTravelDistance(paths, startPoint);

  let optimizedPaths: PathSegment[];

  if (groupByColor) {
    // Group by pen, optimize each group, then concatenate
    const groups = groupByPen(paths);
    optimizedPaths = [];

    let currentPoint = startPoint;
    for (const [, groupPaths] of groups) {
      let sorted = nearestNeighborSort(groupPaths, currentPoint, useReversal);
      if (use2Opt) {
        sorted = twoOptImprove(sorted, currentPoint);
      }
      optimizedPaths.push(...sorted);
      if (sorted.length > 0) {
        const lastPath = sorted[sorted.length - 1];
        currentPoint = lastPath.points[lastPath.points.length - 1];
      }
    }
  } else {
    // Optimize all paths together
    optimizedPaths = nearestNeighborSort(paths, startPoint, useReversal);
    if (use2Opt) {
      optimizedPaths = twoOptImprove(optimizedPaths, startPoint);
    }
  }

  const optimizedDistance = calculateTravelDistance(optimizedPaths, startPoint);
  const savings = ((originalDistance - optimizedDistance) / originalDistance) * 100;

  // Generate travel paths for visualization
  const travelPaths: PathSegment[] = [];
  let currentPoint = startPoint;
  for (const path of optimizedPaths) {
    if (path.points.length === 0) continue;

    travelPaths.push({
      id: `travel-${path.id}`,
      points: [{ ...currentPoint }, { ...path.points[0] }],
      closed: false,
    });

    currentPoint = path.points[path.points.length - 1];
  }

  // Calculate estimated time
  const drawDistance = optimizedPaths.reduce((sum, p) => sum + pathLength(p), 0);
  const totalDistance = drawDistance + optimizedDistance;
  const estimatedTime = totalDistance / config.maxSpeed;

  return {
    paths: optimizedPaths,
    originalDistance,
    optimizedDistance,
    savings,
    estimatedTime,
    travelPaths,
  };
}

/**
 * Convert pattern to path segments
 */
export function patternToPathSegments(svgContent: string, scale: number = 1): PathSegment[] {
  const paths: PathSegment[] = [];

  // Parse SVG path data — single capture group avoids ReDoS via overlapping [^>]* alternatives
  const pathRegex = /<path([^>]*?)\/>/g;
  let match;
  let pathIndex = 0;

  while ((match = pathRegex.exec(svgContent)) !== null) {
    const attrs = match[1];
    const dMatch = /\bd="([^"]*)"/.exec(attrs);
    if (!dMatch) continue;
    const pathData = dMatch[1];
    const strokeMatch = /\bstroke="([^"]*)"/.exec(attrs);
    const color = strokeMatch?.[1] ?? '#000000';

    // Parse path commands to extract points
    const points = parsePathData(pathData, scale);

    if (points.length > 0) {
      paths.push({
        id: `path-${pathIndex}`,
        points,
        color,
        penIndex: colorToPenIndex(color),
        closed: pathData.toLowerCase().includes('z'),
      });
      pathIndex++;
    }
  }

  return paths;
}

// Parse SVG path data to points
function parsePathData(d: string, scale: number): Point[] {
  const points: Point[] = [];
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(parseFloat);

    switch (type) {
      case 'M':
        x = args[0] * scale;
        y = args[1] * scale;
        startX = x;
        startY = y;
        points.push({ x, y });
        break;
      case 'm':
        x += args[0] * scale;
        y += args[1] * scale;
        startX = x;
        startY = y;
        points.push({ x, y });
        break;
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          x = args[i] * scale;
          y = args[i + 1] * scale;
          points.push({ x, y });
        }
        break;
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          x += args[i] * scale;
          y += args[i + 1] * scale;
          points.push({ x, y });
        }
        break;
      case 'H':
        x = args[0] * scale;
        points.push({ x, y });
        break;
      case 'h':
        x += args[0] * scale;
        points.push({ x, y });
        break;
      case 'V':
        y = args[0] * scale;
        points.push({ x, y });
        break;
      case 'v':
        y += args[0] * scale;
        points.push({ x, y });
        break;
      case 'C':
        // Cubic bezier - sample points
        for (let i = 0; i < args.length; i += 6) {
          const samples = sampleCubicBezier(
            { x, y },
            { x: args[i] * scale, y: args[i + 1] * scale },
            { x: args[i + 2] * scale, y: args[i + 3] * scale },
            { x: args[i + 4] * scale, y: args[i + 5] * scale },
            10
          );
          points.push(...samples);
          x = args[i + 4] * scale;
          y = args[i + 5] * scale;
        }
        break;
      case 'Z':
      case 'z':
        x = startX;
        y = startY;
        break;
    }
  }

  return points;
}

// Sample cubic bezier curve
function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, samples: number): Point[] {
  const points: Point[] = [];

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    points.push({
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    });
  }

  return points;
}

// Map color to pen index (basic color grouping)
function colorToPenIndex(color: string): number {
  const colorMap: Record<string, number> = {
    '#000000': 0,
    '#ff0000': 1,
    '#00ff00': 2,
    '#0000ff': 3,
    '#ffff00': 4,
    '#ff00ff': 5,
    '#00ffff': 6,
    '#ffffff': 7,
  };

  return colorMap[color.toLowerCase()] ?? 0;
}

/**
 * Generate HPGL output for pen plotters
 */
export function generateHPGL(
  paths: PathSegment[],
  config: PlotterConfig,
  material: MaterialPreset
): string {
  const lines: string[] = [];

  // Initialize plotter
  lines.push('IN;'); // Initialize
  lines.push('SP1;'); // Select pen 1
  lines.push(`VS${Math.round(config.maxSpeed * (material.speed / 100))};`); // Set speed

  let currentPen = 0;

  for (const path of paths) {
    // Change pen if needed
    if (path.penIndex !== undefined && path.penIndex !== currentPen) {
      lines.push(`SP${path.penIndex + 1};`);
      currentPen = path.penIndex;
    }

    if (path.points.length === 0) continue;

    // Move to start (pen up)
    lines.push('PU;');
    lines.push(`PA${Math.round(path.points[0].x * 40)},${Math.round(path.points[0].y * 40)};`);

    // Draw path (pen down)
    lines.push('PD;');
    for (let i = 1; i < path.points.length; i++) {
      lines.push(`PA${Math.round(path.points[i].x * 40)},${Math.round(path.points[i].y * 40)};`);
    }
  }

  // Finish
  lines.push('PU;');
  lines.push('PA0,0;');
  lines.push('SP0;');

  return lines.join('\n');
}

/**
 * Web Serial API integration for direct plotter connection
 */
export class PlotterConnection {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private status: PlotterStatus = {
    connected: false,
    plotting: false,
    paused: false,
    progress: 0,
    currentPath: 0,
    totalPaths: 0,
    estimatedTimeRemaining: 0,
    position: { x: 0, y: 0 },
  };
  private onStatusChange: ((status: PlotterStatus) => void) | null = null;
  private abortController: AbortController | null = null;

  constructor(onStatusChange?: (status: PlotterStatus) => void) {
    this.onStatusChange = onStatusChange ?? null;
  }

  private updateStatus(updates: Partial<PlotterStatus>): void {
    this.status = { ...this.status, ...updates };
    this.onStatusChange?.(this.status);
  }

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      this.updateStatus({ error: 'Web Serial API not supported in this browser' });
      return false;
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });

      this.reader = this.port.readable?.getReader() ?? null;
      this.writer = this.port.writable?.getWriter() ?? null;

      this.updateStatus({ connected: true, error: undefined });
      return true;
    } catch (error) {
      this.updateStatus({
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.abortController?.abort();

    if (this.reader) {
      await this.reader.cancel();
      this.reader.releaseLock();
      this.reader = null;
    }

    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.updateStatus({ connected: false, plotting: false });
  }

  async sendCommand(command: string): Promise<void> {
    if (!this.writer) {
      throw new Error('Not connected to plotter');
    }

    const encoder = new TextEncoder();
    await this.writer.write(encoder.encode(command + '\n'));
  }

  async plot(paths: PathSegment[], config: PlotterConfig, material: MaterialPreset): Promise<void> {
    if (!this.writer) {
      throw new Error('Not connected to plotter');
    }

    this.abortController = new AbortController();
    const totalPaths = paths.length;

    this.updateStatus({
      plotting: true,
      paused: false,
      progress: 0,
      currentPath: 0,
      totalPaths,
    });

    try {
      // Initialize
      await this.sendCommand('IN');
      await this.sendCommand('SP1');
      await this.sendCommand(`VS${Math.round(config.maxSpeed * (material.speed / 100))}`);

      for (let i = 0; i < paths.length; i++) {
        if (this.abortController.signal.aborted) {
          break;
        }

        while (this.status.paused) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (this.abortController.signal.aborted) break;
        }

        const path = paths[i];
        this.updateStatus({
          currentPath: i + 1,
          progress: (i / totalPaths) * 100,
        });

        if (path.points.length === 0) continue;

        // Move to start
        await this.sendCommand('PU');
        await this.sendCommand(
          `PA${Math.round(path.points[0].x * 40)},${Math.round(path.points[0].y * 40)}`
        );

        // Pen down delay
        await new Promise((resolve) => setTimeout(resolve, material.penDownDelay));
        await this.sendCommand('PD');

        // Draw points
        for (let j = 1; j < path.points.length; j++) {
          const point = path.points[j];
          await this.sendCommand(`PA${Math.round(point.x * 40)},${Math.round(point.y * 40)}`);
          this.updateStatus({ position: point });
        }

        // Pen up delay
        await new Promise((resolve) => setTimeout(resolve, material.penUpDelay));
      }

      // Return home
      await this.sendCommand('PU');
      await this.sendCommand('PA0,0');
      await this.sendCommand('SP0');

      this.updateStatus({
        plotting: false,
        progress: 100,
        position: { x: 0, y: 0 },
      });
    } catch (error) {
      this.updateStatus({
        plotting: false,
        error: error instanceof Error ? error.message : 'Plot failed',
      });
    }
  }

  pause(): void {
    this.updateStatus({ paused: true });
  }

  resume(): void {
    this.updateStatus({ paused: false });
  }

  abort(): void {
    this.abortController?.abort();
    this.updateStatus({ plotting: false, paused: false });
  }

  getStatus(): PlotterStatus {
    return { ...this.status };
  }
}

/**
 * Preview renderer for optimized paths
 */
export function renderPathPreview(
  canvas: HTMLCanvasElement,
  result: OptimizationResult,
  options: {
    showDrawPaths?: boolean;
    showTravelPaths?: boolean;
    travelColor?: string;
    backgroundColor?: string;
    scale?: number;
  } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const {
    showDrawPaths = true,
    showTravelPaths = true,
    travelColor = '#ff0000',
    backgroundColor = '#ffffff',
    scale = 1,
  } = options;

  // Clear canvas
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw travel paths first (behind draw paths)
  if (showTravelPaths) {
    ctx.strokeStyle = travelColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);

    for (const travel of result.travelPaths) {
      if (travel.points.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(travel.points[0].x * scale, travel.points[0].y * scale);
      for (let i = 1; i < travel.points.length; i++) {
        ctx.lineTo(travel.points[i].x * scale, travel.points[i].y * scale);
      }
      ctx.stroke();
    }
  }

  // Draw main paths
  if (showDrawPaths) {
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    for (const path of result.paths) {
      if (path.points.length < 2) continue;

      ctx.strokeStyle = path.color || '#000000';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * scale, path.points[0].y * scale);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * scale, path.points[i].y * scale);
      }
      if (path.closed) {
        ctx.closePath();
      }
      ctx.stroke();
    }
  }
}
