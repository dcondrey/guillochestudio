export { GuillocheEngine } from './engine.js';
export type { Point, PathSegment, GeneratedPath } from './engine.js';
export { SVGRenderer } from './renderers/svg.js';
export type { SVGLayer, SVGRenderOptions } from './renderers/svg.js';
export { CanvasRenderer } from './renderers/canvas.js';
export { EPSRenderer } from './renderers/eps.js';
export type { EPSRenderOptions } from './renderers/eps.js';
export { PatternDNA } from './dna.js';
export * from './generator.js';

// Boolean operations and shape creation
export {
  union,
  intersect,
  difference,
  xor,
  offset,
  simplify,
  pointInPath,
  pathArea,
  isClockwise,
  reversePath,
  createCircle,
  createEllipse,
  createRectangle,
  createPolygon,
} from './operations/boolean.js';

// Spatial indexing
export {
  PointIndex,
  SegmentIndex,
  computeSegmentBBox,
  bboxIntersects,
  bboxContainsPoint,
  pointToSegmentDistance,
  pointToPathDistance,
} from './spatial/rtree.js';
export type { BBox, IndexedPoint, IndexedSegment } from './spatial/rtree.js';

// Curve fitting and simplification
export { fitCurve, evaluateBezier, bezierToSVGPath, flattenBezier } from './utils/curve-fit.js';
export type { BezierSegment } from './utils/curve-fit.js';

export {
  simplifyPath,
  simplifyVisvalingam,
  simplifyRadial,
  simplifyCombined,
  simplifyAdaptive,
  pathLength,
  resamplePath,
} from './utils/simplify.js';
