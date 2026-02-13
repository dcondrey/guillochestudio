//! Guilloché WASM Engine
//!
//! High-performance WebAssembly module for generating and rendering
//! mathematical curve patterns (Guilloché, Spirograph, Lissajous).

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;

// Initialize panic hook for better error messages
#[cfg(feature = "console_error_panic_hook")]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Pattern curve family type
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
pub enum CurveFamily {
    Hypotrochoid,
    Epitrochoid,
    Rose,
    Lissajous,
    Spirograph,
    Cyclic,
}

/// Pattern parameters
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PatternParams {
    // Curve parameters
    pub family: String,
    pub r1: f64,        // Outer radius
    pub r2: f64,        // Inner radius
    pub d: f64,         // Pen distance
    pub k: f64,         // K parameter for rose curves
    pub a: f64,         // A frequency for Lissajous
    pub b: f64,         // B frequency for Lissajous
    pub delta: f64,     // Phase shift
    pub steps: u32,     // Resolution
    pub rotations: f64, // Number of rotations

    // Style parameters
    pub stroke_width: f64,
    pub symmetry: u32,
    pub rotation: f64,

    // View parameters
    pub scale: f64,
    pub center_x: f64,
    pub center_y: f64,
}

impl Default for PatternParams {
    fn default() -> Self {
        Self {
            family: "hypotrochoid".to_string(),
            r1: 100.0,
            r2: 60.0,
            d: 80.0,
            k: 4.0,
            a: 3.0,
            b: 4.0,
            delta: PI / 2.0,
            steps: 2000,
            rotations: 1.0,

            stroke_width: 1.0,
            symmetry: 1,
            rotation: 0.0,

            scale: 1.0,
            center_x: 200.0,
            center_y: 200.0,
        }
    }
}

/// Point in 2D space
#[derive(Clone, Copy, Debug)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn rotate(&self, angle: f64, cx: f64, cy: f64) -> Self {
        let cos_a = angle.cos();
        let sin_a = angle.sin();
        let dx = self.x - cx;
        let dy = self.y - cy;
        Self {
            x: cx + dx * cos_a - dy * sin_a,
            y: cy + dx * sin_a + dy * cos_a,
        }
    }

    pub fn scale(&self, factor: f64, cx: f64, cy: f64) -> Self {
        Self {
            x: cx + (self.x - cx) * factor,
            y: cy + (self.y - cy) * factor,
        }
    }
}

/// Main Guilloché pattern engine
#[wasm_bindgen]
pub struct GuillocheEngine {
    params: PatternParams,
    path_cache: Vec<f64>, // Flat array of x,y pairs
    dirty: bool,
}

#[wasm_bindgen]
impl GuillocheEngine {
    /// Create a new engine instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        set_panic_hook();

        Self {
            params: PatternParams::default(),
            path_cache: Vec::new(),
            dirty: true,
        }
    }

    /// Set parameters from JSON string
    #[wasm_bindgen]
    pub fn set_params(&mut self, params_json: &str) -> Result<(), JsValue> {
        match serde_json::from_str::<PatternParams>(params_json) {
            Ok(params) => {
                self.params = params;
                self.dirty = true;
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Invalid params: {}", e))),
        }
    }

    /// Set a single parameter by name
    #[wasm_bindgen]
    pub fn set_param(&mut self, name: &str, value: f64) {
        match name {
            "r1" => self.params.r1 = value,
            "r2" => self.params.r2 = value,
            "d" => self.params.d = value,
            "k" => self.params.k = value,
            "a" => self.params.a = value,
            "b" => self.params.b = value,
            "delta" => self.params.delta = value,
            "steps" => self.params.steps = value as u32,
            "rotations" => self.params.rotations = value,
            "strokeWidth" => self.params.stroke_width = value,
            "symmetry" => self.params.symmetry = value as u32,
            "rotation" => self.params.rotation = value,
            "scale" => self.params.scale = value,
            "centerX" => self.params.center_x = value,
            "centerY" => self.params.center_y = value,
            _ => {}
        }
        self.dirty = true;
    }

    /// Set curve family
    #[wasm_bindgen]
    pub fn set_family(&mut self, family: &str) {
        self.params.family = family.to_string();
        self.dirty = true;
    }

    /// Compute the path points
    #[wasm_bindgen]
    pub fn compute_path(&mut self) -> Vec<f64> {
        if !self.dirty && !self.path_cache.is_empty() {
            return self.path_cache.clone();
        }

        let points = self.generate_curve_points();

        // Flatten points to x,y array
        self.path_cache = points
            .iter()
            .flat_map(|p| vec![p.x, p.y])
            .collect();

        self.dirty = false;
        self.path_cache.clone()
    }

    /// Compute path in chunks for progressive rendering
    #[wasm_bindgen]
    pub fn compute_path_chunk(&self, start: u32, count: u32) -> Vec<f64> {
        let points = self.generate_curve_points_range(start, count);
        points
            .iter()
            .flat_map(|p| vec![p.x, p.y])
            .collect()
    }

    /// Render directly to canvas
    #[wasm_bindgen]
    pub fn render_to_canvas(&mut self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        let path = self.compute_path();

        if path.len() < 4 {
            return Ok(());
        }

        ctx.begin_path();
        ctx.move_to(path[0], path[1]);

        for i in (2..path.len()).step_by(2) {
            ctx.line_to(path[i], path[i + 1]);
        }

        ctx.stroke();
        Ok(())
    }

    /// Generate SVG path data string
    #[wasm_bindgen]
    pub fn to_svg_path(&mut self) -> String {
        let path = self.compute_path();

        if path.len() < 4 {
            return String::new();
        }

        let mut svg = format!("M {:.3} {:.3}", path[0], path[1]);

        for i in (2..path.len()).step_by(2) {
            svg.push_str(&format!(" L {:.3} {:.3}", path[i], path[i + 1]));
        }

        svg
    }

    /// Optimize SVG path using Douglas-Peucker algorithm
    #[wasm_bindgen]
    pub fn optimize_svg(&mut self, tolerance: f64) -> String {
        let path = self.compute_path();

        if path.len() < 6 {
            return self.to_svg_path();
        }

        // Convert to points
        let points: Vec<Point> = (0..path.len())
            .step_by(2)
            .map(|i| Point::new(path[i], path[i + 1]))
            .collect();

        // Douglas-Peucker simplification
        let simplified = douglas_peucker(&points, tolerance);

        if simplified.is_empty() {
            return String::new();
        }

        let mut svg = format!("M {:.3} {:.3}", simplified[0].x, simplified[0].y);

        for point in simplified.iter().skip(1) {
            svg.push_str(&format!(" L {:.3} {:.3}", point.x, point.y));
        }

        svg
    }

    /// Get bounding box [minX, minY, maxX, maxY]
    #[wasm_bindgen]
    pub fn get_bounds(&mut self) -> Vec<f64> {
        let path = self.compute_path();

        if path.len() < 2 {
            return vec![0.0, 0.0, 0.0, 0.0];
        }

        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;

        for i in (0..path.len()).step_by(2) {
            min_x = min_x.min(path[i]);
            max_x = max_x.max(path[i]);
            min_y = min_y.min(path[i + 1]);
            max_y = max_y.max(path[i + 1]);
        }

        vec![min_x, min_y, max_x, max_y]
    }

    /// Get path length (total distance)
    #[wasm_bindgen]
    pub fn get_path_length(&mut self) -> f64 {
        let path = self.compute_path();

        if path.len() < 4 {
            return 0.0;
        }

        let mut length = 0.0;
        for i in (2..path.len()).step_by(2) {
            let dx = path[i] - path[i - 2];
            let dy = path[i + 1] - path[i - 1];
            length += (dx * dx + dy * dy).sqrt();
        }

        length
    }

    /// Get number of points in path
    #[wasm_bindgen]
    pub fn get_point_count(&mut self) -> u32 {
        let path = self.compute_path();
        (path.len() / 2) as u32
    }
}

impl GuillocheEngine {
    /// Generate curve points based on family
    fn generate_curve_points(&self) -> Vec<Point> {
        self.generate_curve_points_range(0, self.params.steps)
    }

    fn generate_curve_points_range(&self, start: u32, count: u32) -> Vec<Point> {
        let family = self.params.family.to_lowercase();
        let end = (start + count).min(self.params.steps);

        let base_points: Vec<Point> = match family.as_str() {
            "hypotrochoid" => self.compute_hypotrochoid(start, end),
            "epitrochoid" => self.compute_epitrochoid(start, end),
            "rose" => self.compute_rose(start, end),
            "lissajous" => self.compute_lissajous(start, end),
            "spirograph" => self.compute_spirograph(start, end),
            _ => self.compute_hypotrochoid(start, end),
        };

        // Apply symmetry
        if self.params.symmetry <= 1 {
            return self.transform_points(base_points);
        }

        let mut all_points = Vec::new();
        let angle_step = 2.0 * PI / self.params.symmetry as f64;

        for i in 0..self.params.symmetry {
            let angle = i as f64 * angle_step;
            let rotated: Vec<Point> = base_points
                .iter()
                .map(|p| p.rotate(angle, self.params.center_x, self.params.center_y))
                .collect();
            all_points.extend(self.transform_points(rotated));
        }

        all_points
    }

    fn transform_points(&self, points: Vec<Point>) -> Vec<Point> {
        points
            .into_iter()
            .map(|p| {
                let scaled = p.scale(self.params.scale, self.params.center_x, self.params.center_y);
                scaled.rotate(self.params.rotation, self.params.center_x, self.params.center_y)
            })
            .collect()
    }

    /// Hypotrochoid: point on a circle rolling inside another circle
    fn compute_hypotrochoid(&self, start: u32, end: u32) -> Vec<Point> {
        let r1 = self.params.r1;
        let r2 = self.params.r2;
        let d = self.params.d;
        let cx = self.params.center_x;
        let cy = self.params.center_y;

        let total_angle = 2.0 * PI * self.params.rotations;

        (start..end)
            .map(|i| {
                let t = (i as f64 / self.params.steps as f64) * total_angle;
                let x = cx + (r1 - r2) * t.cos() + d * ((r1 - r2) / r2 * t).cos();
                let y = cy + (r1 - r2) * t.sin() - d * ((r1 - r2) / r2 * t).sin();
                Point::new(x, y)
            })
            .collect()
    }

    /// Epitrochoid: point on a circle rolling outside another circle
    fn compute_epitrochoid(&self, start: u32, end: u32) -> Vec<Point> {
        let r1 = self.params.r1;
        let r2 = self.params.r2;
        let d = self.params.d;
        let cx = self.params.center_x;
        let cy = self.params.center_y;

        let total_angle = 2.0 * PI * self.params.rotations;

        (start..end)
            .map(|i| {
                let t = (i as f64 / self.params.steps as f64) * total_angle;
                let x = cx + (r1 + r2) * t.cos() - d * ((r1 + r2) / r2 * t).cos();
                let y = cy + (r1 + r2) * t.sin() - d * ((r1 + r2) / r2 * t).sin();
                Point::new(x, y)
            })
            .collect()
    }

    /// Rose curve (rhodonea)
    fn compute_rose(&self, start: u32, end: u32) -> Vec<Point> {
        let k = self.params.k;
        let r = self.params.r1;
        let cx = self.params.center_x;
        let cy = self.params.center_y;

        let total_angle = 2.0 * PI * self.params.rotations;

        (start..end)
            .map(|i| {
                let t = (i as f64 / self.params.steps as f64) * total_angle;
                let rho = r * (k * t).cos();
                let x = cx + rho * t.cos();
                let y = cy + rho * t.sin();
                Point::new(x, y)
            })
            .collect()
    }

    /// Lissajous curve
    fn compute_lissajous(&self, start: u32, end: u32) -> Vec<Point> {
        let a = self.params.a;
        let b = self.params.b;
        let delta = self.params.delta;
        let r = self.params.r1;
        let cx = self.params.center_x;
        let cy = self.params.center_y;

        let total_angle = 2.0 * PI * self.params.rotations;

        (start..end)
            .map(|i| {
                let t = (i as f64 / self.params.steps as f64) * total_angle;
                let x = cx + r * (a * t + delta).sin();
                let y = cy + r * (b * t).sin();
                Point::new(x, y)
            })
            .collect()
    }

    /// Spirograph (simplified using hypotrochoid with dynamic d)
    fn compute_spirograph(&self, start: u32, end: u32) -> Vec<Point> {
        let r1 = self.params.r1;
        let r2 = self.params.r2;
        let d = self.params.d;
        let cx = self.params.center_x;
        let cy = self.params.center_y;

        let total_angle = 2.0 * PI * self.params.rotations;

        (start..end)
            .map(|i| {
                let t = (i as f64 / self.params.steps as f64) * total_angle;
                let ratio = (r1 - r2) / r2;

                // Spirograph with inner pattern
                let x = cx + (r1 - r2) * t.cos() + d * (ratio * t).cos();
                let y = cy + (r1 - r2) * t.sin() - d * (ratio * t).sin();
                Point::new(x, y)
            })
            .collect()
    }
}

impl Default for GuillocheEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Douglas-Peucker line simplification algorithm
fn douglas_peucker(points: &[Point], tolerance: f64) -> Vec<Point> {
    if points.len() < 3 {
        return points.to_vec();
    }

    // Find point with maximum distance
    let mut max_dist = 0.0;
    let mut max_idx = 0;

    let start = &points[0];
    let end = &points[points.len() - 1];

    for (i, point) in points.iter().enumerate().skip(1).take(points.len() - 2) {
        let dist = perpendicular_distance(point, start, end);
        if dist > max_dist {
            max_dist = dist;
            max_idx = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if max_dist > tolerance {
        let left = douglas_peucker(&points[..=max_idx], tolerance);
        let right = douglas_peucker(&points[max_idx..], tolerance);

        // Combine results (excluding duplicate point at junction)
        let mut result = left;
        result.extend(right.into_iter().skip(1));
        result
    } else {
        // Return only start and end points
        vec![*start, *end]
    }
}

/// Calculate perpendicular distance from point to line segment
fn perpendicular_distance(point: &Point, line_start: &Point, line_end: &Point) -> f64 {
    let dx = line_end.x - line_start.x;
    let dy = line_end.y - line_start.y;

    if dx.abs() < f64::EPSILON && dy.abs() < f64::EPSILON {
        // Line is actually a point
        let pdx = point.x - line_start.x;
        let pdy = point.y - line_start.y;
        return (pdx * pdx + pdy * pdy).sqrt();
    }

    let line_length = (dx * dx + dy * dy).sqrt();

    // Calculate perpendicular distance using cross product
    let cross = (point.x - line_start.x) * dy - (point.y - line_start.y) * dx;
    cross.abs() / line_length
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = GuillocheEngine::new();
        assert_eq!(engine.params.steps, 2000);
    }

    #[test]
    fn test_compute_path() {
        let mut engine = GuillocheEngine::new();
        let path = engine.compute_path();
        assert!(!path.is_empty());
        assert_eq!(path.len() % 2, 0); // Should be pairs of x,y
    }

    #[test]
    fn test_svg_path_generation() {
        let mut engine = GuillocheEngine::new();
        engine.params.steps = 100;
        let svg = engine.to_svg_path();
        assert!(svg.starts_with("M "));
        assert!(svg.contains(" L "));
    }

    #[test]
    fn test_douglas_peucker() {
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(1.0, 0.1),
            Point::new(2.0, 0.0),
            Point::new(3.0, 0.1),
            Point::new(4.0, 0.0),
        ];

        let simplified = douglas_peucker(&points, 0.2);
        assert!(simplified.len() < points.len());
    }
}
