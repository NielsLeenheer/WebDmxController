/**
 * SVG Geometry Sampler
 *
 * Samples SVG elements from the DOM and extracts point sequences for laser output.
 * Reads computed CSS styles to handle opacity, visibility, stroke color, and transforms.
 *
 * Ported and adapted from WebAudioOscilloscope/src/utils/svgSampler.js
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Drawable SVG element selectors
 */
const DRAWABLE_SELECTOR = 'path, circle, ellipse, rect, polygon, polyline, line';

/**
 * Parse an RGB/RGBA CSS color string into {r, g, b} (0-255)
 */
function parseColor(cssColor) {
	if (!cssColor || cssColor === 'none' || cssColor === 'transparent') return null;

	const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (match) {
		return {
			r: parseInt(match[1]),
			g: parseInt(match[2]),
			b: parseInt(match[3])
		};
	}

	return null;
}

/**
 * Get the cumulative opacity of an element (multiply ancestor opacities)
 */
function getCumulativeOpacity(element, svgRoot) {
	let opacity = 1;
	let el = element;

	while (el && el !== svgRoot && el.nodeType === 1) {
		const style = window.getComputedStyle(el);
		const elOpacity = parseFloat(style.opacity);
		if (!isNaN(elOpacity)) {
			opacity *= elOpacity;
		}
		el = el.parentElement;
	}

	// Include the SVG root itself
	if (svgRoot && svgRoot.nodeType === 1) {
		const rootStyle = window.getComputedStyle(svgRoot);
		const rootOpacity = parseFloat(rootStyle.opacity);
		if (!isNaN(rootOpacity)) {
			opacity *= rootOpacity;
		}
	}

	return opacity;
}

/**
 * Check if an element is visible (not display:none, not visibility:hidden)
 * Checks the element and all ancestors up to svgRoot
 */
function isElementVisible(element, svgRoot) {
	let el = element;

	while (el && el !== svgRoot?.parentElement && el.nodeType === 1) {
		const style = window.getComputedStyle(el);
		if (style.display === 'none') return false;
		if (style.visibility === 'hidden') return false;
		el = el.parentElement;
	}

	return true;
}

/**
 * Check if an SVG element represents a closed shape
 */
function isClosedShape(element) {
	const tag = element.tagName.toLowerCase();

	if (tag === 'circle' || tag === 'ellipse' || tag === 'rect' || tag === 'polygon') {
		return true;
	}

	if (tag === 'path') {
		const d = element.getAttribute('d') || '';
		return /[Zz]\s*$/.test(d.trim());
	}

	return false;
}

/**
 * Points per unit of path length in viewBox coordinates.
 * This controls sampling density — more points per unit = smoother curves.
 */
const SAMPLES_PER_UNIT = 0.5;
const MIN_SAMPLES = 10;
const MAX_SAMPLES = 500;

// ---- Fast direct path sampling (bypasses getPointAtLength) ----

/**
 * Evaluate a cubic bezier at parameter t
 */
function cubicAt(x0, y0, x1, y1, x2, y2, x3, y3, t) {
	const mt = 1 - t;
	const mt2 = mt * mt;
	const mt3 = mt2 * mt;
	const t2 = t * t;
	const t3 = t2 * t;
	return [
		mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
		mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3
	];
}

/**
 * Evaluate a quadratic bezier at parameter t
 */
function quadAt(x0, y0, x1, y1, x2, y2, t) {
	const mt = 1 - t;
	return [
		mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
		mt * mt * y0 + 2 * mt * t * y1 + t * t * y2
	];
}

/**
 * Approximate length of a cubic bezier using chord/control-polygon average
 */
function approxCubicLength(x0, y0, x1, y1, x2, y2, x3, y3) {
	const chord = Math.hypot(x3 - x0, y3 - y0);
	const poly = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
	return (chord + poly) / 2;
}

/**
 * Approximate length of a quadratic bezier
 */
function approxQuadLength(x0, y0, x1, y1, x2, y2) {
	const chord = Math.hypot(x2 - x0, y2 - y0);
	const poly = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
	return (chord + poly) / 2;
}

/**
 * Tokenize an SVG path d-attribute string into number tokens.
 * Handles commas, spaces, sign-separated numbers (e.g. "1-2" → [1, -2]).
 */
function tokenizeNumbers(s) {
	const nums = [];
	// Match numbers: optional sign, digits, optional decimal, optional exponent
	const re = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
	let m;
	while ((m = re.exec(s)) !== null) {
		nums.push(parseFloat(m[0]));
	}
	return nums;
}

/**
 * Parse SVG path d-attribute into an array of absolute-coordinate segment objects.
 * Supports M, L, H, V, C, S, Q, T, Z (and lowercase relative versions).
 * Returns null if an arc (A) command or unknown command is encountered.
 */
function parsePathD(d) {
	// Strip path("...") wrapper if present (from CSS computed value)
	const wrapped = d.match(/path\(\s*"(.+?)"\s*\)/);
	if (wrapped) d = wrapped[1];

	const segments = [];
	// Split into command + arguments chunks
	const cmdRe = /([MmLlHhVvCcSsQqTtZzAa])([^MmLlHhVvCcSsQqTtZzAa]*)/g;
	let match;

	let cx = 0, cy = 0;  // current point
	let mx = 0, my = 0;  // last moveto
	let lastCmd = '';
	let lastCx1 = 0, lastCy1 = 0; // last control point (for S/T)

	while ((match = cmdRe.exec(d)) !== null) {
		const cmd = match[1];
		const nums = tokenizeNumbers(match[2]);
		const isRel = cmd === cmd.toLowerCase();
		const CMD = cmd.toUpperCase();

		// Arc commands — bail out, too complex to parse here
		if (CMD === 'A') return null;

		switch (CMD) {
			case 'M': {
				// MoveTo: first pair is moveto, subsequent pairs are implicit LineTo
				for (let i = 0; i < nums.length; i += 2) {
					const x = isRel ? cx + nums[i] : nums[i];
					const y = isRel ? cy + nums[i + 1] : nums[i + 1];
					if (i === 0) {
						segments.push({ type: 'M', x, y });
						mx = x; my = y;
					} else {
						segments.push({ type: 'L', x, y });
					}
					cx = x; cy = y;
				}
				lastCmd = 'M';
				break;
			}
			case 'L': {
				for (let i = 0; i < nums.length; i += 2) {
					const x = isRel ? cx + nums[i] : nums[i];
					const y = isRel ? cy + nums[i + 1] : nums[i + 1];
					segments.push({ type: 'L', x, y });
					cx = x; cy = y;
				}
				lastCmd = 'L';
				break;
			}
			case 'H': {
				for (let i = 0; i < nums.length; i++) {
					const x = isRel ? cx + nums[i] : nums[i];
					segments.push({ type: 'L', x, y: cy });
					cx = x;
				}
				lastCmd = 'H';
				break;
			}
			case 'V': {
				for (let i = 0; i < nums.length; i++) {
					const y = isRel ? cy + nums[i] : nums[i];
					segments.push({ type: 'L', x: cx, y });
					cy = y;
				}
				lastCmd = 'V';
				break;
			}
			case 'C': {
				for (let i = 0; i < nums.length; i += 6) {
					const x1 = isRel ? cx + nums[i] : nums[i];
					const y1 = isRel ? cy + nums[i + 1] : nums[i + 1];
					const x2 = isRel ? cx + nums[i + 2] : nums[i + 2];
					const y2 = isRel ? cy + nums[i + 3] : nums[i + 3];
					const x = isRel ? cx + nums[i + 4] : nums[i + 4];
					const y = isRel ? cy + nums[i + 5] : nums[i + 5];
					segments.push({ type: 'C', x1, y1, x2, y2, x, y, fx: cx, fy: cy });
					lastCx1 = x2; lastCy1 = y2;
					cx = x; cy = y;
				}
				lastCmd = 'C';
				break;
			}
			case 'S': {
				for (let i = 0; i < nums.length; i += 4) {
					// Reflect previous control point
					const x1 = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cx - lastCx1 : cx;
					const y1 = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cy - lastCy1 : cy;
					const x2 = isRel ? cx + nums[i] : nums[i];
					const y2 = isRel ? cy + nums[i + 1] : nums[i + 1];
					const x = isRel ? cx + nums[i + 2] : nums[i + 2];
					const y = isRel ? cy + nums[i + 3] : nums[i + 3];
					segments.push({ type: 'C', x1, y1, x2, y2, x, y, fx: cx, fy: cy });
					lastCx1 = x2; lastCy1 = y2;
					cx = x; cy = y;
					lastCmd = 'S';
				}
				break;
			}
			case 'Q': {
				for (let i = 0; i < nums.length; i += 4) {
					const x1 = isRel ? cx + nums[i] : nums[i];
					const y1 = isRel ? cy + nums[i + 1] : nums[i + 1];
					const x = isRel ? cx + nums[i + 2] : nums[i + 2];
					const y = isRel ? cy + nums[i + 3] : nums[i + 3];
					segments.push({ type: 'Q', x1, y1, x, y, fx: cx, fy: cy });
					lastCx1 = x1; lastCy1 = y1;
					cx = x; cy = y;
				}
				lastCmd = 'Q';
				break;
			}
			case 'T': {
				for (let i = 0; i < nums.length; i += 2) {
					const x1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cx - lastCx1 : cx;
					const y1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cy - lastCy1 : cy;
					const x = isRel ? cx + nums[i] : nums[i];
					const y = isRel ? cy + nums[i + 1] : nums[i + 1];
					segments.push({ type: 'Q', x1, y1, x, y, fx: cx, fy: cy });
					lastCx1 = x1; lastCy1 = y1;
					cx = x; cy = y;
					lastCmd = 'T';
				}
				break;
			}
			case 'Z': {
				if (cx !== mx || cy !== my) {
					segments.push({ type: 'L', x: mx, y: my });
				}
				segments.push({ type: 'Z' });
				cx = mx; cy = my;
				lastCmd = 'Z';
				break;
			}
			default:
				return null; // Unknown command — fall back
		}
	}

	return segments;
}

/**
 * Sample a single section of path commands (no M boundaries within it).
 * Returns array of [x, y] points, or null on failure.
 */
function sampleSection(sectionStr, samplesPerUnit) {
	const segments = parsePathD(sectionStr);
	if (!segments || segments.length === 0) return null;

	const points = [];
	let cx = 0, cy = 0;

	for (const seg of segments) {
		switch (seg.type) {
			case 'M':
				cx = seg.x; cy = seg.y;
				points.push([cx, cy]);
				break;
			case 'L':
				points.push([seg.x, seg.y]);
				cx = seg.x; cy = seg.y;
				break;
			case 'C': {
				const len = approxCubicLength(seg.fx, seg.fy, seg.x1, seg.y1, seg.x2, seg.y2, seg.x, seg.y);
				const n = Math.max(2, Math.min(20, Math.round(len * samplesPerUnit)));
				for (let i = 1; i <= n; i++) {
					points.push(cubicAt(seg.fx, seg.fy, seg.x1, seg.y1, seg.x2, seg.y2, seg.x, seg.y, i / n));
				}
				cx = seg.x; cy = seg.y;
				break;
			}
			case 'Q': {
				const len = approxQuadLength(seg.fx, seg.fy, seg.x1, seg.y1, seg.x, seg.y);
				const n = Math.max(2, Math.min(16, Math.round(len * samplesPerUnit)));
				for (let i = 1; i <= n; i++) {
					points.push(quadAt(seg.fx, seg.fy, seg.x1, seg.y1, seg.x, seg.y, i / n));
				}
				cx = seg.x; cy = seg.y;
				break;
			}
			case 'Z':
				break;
		}
	}

	return points.length >= 2 ? points : null;
}

/**
 * Split a path d-string into sections at M (moveto) boundaries.
 * Each section starts with its M command.
 * Returns array of section strings.
 */
function splitPathSections(d) {
	// Strip path("...") wrapper
	const wrapped = d.match(/path\(\s*"(.+?)"\s*\)/);
	if (wrapped) d = wrapped[1];

	// Split at M/m boundaries — each section starts with M
	const sections = [];
	const re = /[Mm]/g;
	const positions = [];
	let m;
	while ((m = re.exec(d)) !== null) positions.push(m.index);

	if (positions.length === 0) return [];

	for (let i = 0; i < positions.length; i++) {
		const start = positions[i];
		const end = i + 1 < positions.length ? positions[i + 1] : d.length;
		const section = d.substring(start, end).trim();
		if (section) sections.push(section);
	}

	return sections;
}

/**
 * Sample a path using section-level caching.
 * Sections are delimited by M commands. Frozen sections (all but last) are cached.
 * Only the last (active) section is re-evaluated each frame.
 *
 * An M-only section (just "M x,y" with no drawing commands) signals a part
 * boundary — a disconnected jump. Sections between part boundaries are merged
 * into continuous parts; parts are returned as separate point arrays.
 *
 * cache object: { sections: string[], sectionPoints: Array<Array<[x,y]>|null> }
 * Returns: array of point arrays (one per disconnected part), or null.
 */
function samplePathSectioned(d, samplesPerUnit, cache) {
	const sections = splitPathSections(d);
	if (sections.length === 0) return null;

	// Check how many leading sections match the cache
	const oldSections = cache.sections;
	let match = 0;
	if (oldSections) {
		const limit = Math.min(sections.length - 1, oldSections.length);
		while (match < limit && sections[match] === oldSections[match]) match++;
	}

	// Evaluate sections (reuse cache for matched prefix)
	const sectionPoints = [];
	for (let i = 0; i < sections.length; i++) {
		let pts;
		if (i < match) {
			pts = cache.sectionPoints[i];
		} else {
			pts = sampleSection(sections[i], samplesPerUnit);
		}
		sectionPoints.push(pts);
	}

	cache.sections = sections;
	cache.sectionPoints = sectionPoints;

	// Group sections into parts, splitting at M-only sections (null points = part gap)
	const parts = [];
	let currentPart = [];

	for (let i = 0; i < sectionPoints.length; i++) {
		const pts = sectionPoints[i];
		if (!pts || pts.length < 2) {
			// M-only section = part boundary
			if (currentPart.length >= 2) {
				parts.push(currentPart);
			}
			currentPart = [];
			continue;
		}
		// Append to current part (skip first point of non-first sections within a part to avoid duplicate)
		if (currentPart.length > 0 && pts.length > 1) {
			for (let j = 1; j < pts.length; j++) currentPart.push(pts[j]);
		} else {
			for (let j = 0; j < pts.length; j++) currentPart.push(pts[j]);
		}
	}
	if (currentPart.length >= 2) {
		parts.push(currentPart);
	}

	if (parts.length === 0) return null;

	// Cap each part to MAX_SAMPLES (distributed proportionally)
	let totalPoints = 0;
	for (const part of parts) totalPoints += part.length;

	if (totalPoints > MAX_SAMPLES) {
		const ratio = MAX_SAMPLES / totalPoints;
		for (let i = 0; i < parts.length; i++) {
			const cap = Math.max(2, Math.round(parts[i].length * ratio));
			if (parts[i].length > cap) {
				const step = parts[i].length / cap;
				const capped = [];
				for (let j = 0; j < cap; j++) capped.push(parts[i][Math.round(j * step)]);
				parts[i] = capped;
			}
		}
	}

	return parts;
}

/**
 * Extract corner points for geometric primitives.
 * Returns array of distances along the path where corners are located.
 */
function getCornerDistances(element) {
	const tag = element.tagName.toLowerCase();
	const length = element.getTotalLength();

	if (tag === 'rect') {
		// Rect has 4 corners at roughly 0, 1/4, 2/4, 3/4 of the perimeter
		return [0, length * 0.25, length * 0.5, length * 0.75];
	}

	if (tag === 'polygon') {
		// Sample at each vertex — polygons have their vertices at evenly spaced distances
		const pointsAttr = element.getAttribute('points') || '';
		const vertices = pointsAttr.trim().split(/[\s,]+/);
		const numVertices = Math.floor(vertices.length / 2);
		if (numVertices < 2) return [];

		const corners = [];
		// Walk the perimeter to find each vertex distance
		const step = length / 1000;
		let prevPt = element.getPointAtLength(0);
		let accumulated = 0;
		let vertexIndex = 0;
		const vx = [], vy = [];
		for (let i = 0; i < numVertices; i++) {
			vx.push(parseFloat(vertices[i * 2]));
			vy.push(parseFloat(vertices[i * 2 + 1]));
		}
		corners.push(0); // First vertex is at distance 0
		for (let d = step; d <= length && vertexIndex < numVertices - 1; d += step) {
			const pt = element.getPointAtLength(d);
			accumulated = d;
			// Check if we're near the next vertex
			const nextV = vertexIndex + 1;
			const dx = pt.x - vx[nextV];
			const dy = pt.y - vy[nextV];
			if (Math.sqrt(dx * dx + dy * dy) < step * 2) {
				corners.push(d);
				vertexIndex++;
			}
		}
		return corners;
	}

	if (tag === 'line') {
		return [0, length];
	}

	if (tag === 'polyline') {
		// Similar approach to polygon
		const pointsAttr = element.getAttribute('points') || '';
		const vertices = pointsAttr.trim().split(/[\s,]+/);
		const numVertices = Math.floor(vertices.length / 2);
		if (numVertices < 2) return [0, length];

		const corners = [0];
		const step = length / 1000;
		let vertexIndex = 0;
		const vx = [], vy = [];
		for (let i = 0; i < numVertices; i++) {
			vx.push(parseFloat(vertices[i * 2]));
			vy.push(parseFloat(vertices[i * 2 + 1]));
		}
		for (let d = step; d <= length && vertexIndex < numVertices - 1; d += step) {
			const pt = element.getPointAtLength(d);
			const nextV = vertexIndex + 1;
			const dx = pt.x - vx[nextV];
			const dy = pt.y - vy[nextV];
			if (Math.sqrt(dx * dx + dy * dy) < step * 2) {
				corners.push(d);
				vertexIndex++;
			}
		}
		return corners;
	}

	// For paths, circles, ellipses — no explicit corners, uniform sampling is fine
	return [];
}

/**
 * Sample points from an SVG element using native SVG DOM methods.
 * For <path> elements, uses direct bezier evaluation (fast).
 * For other shapes, falls back to getPointAtLength.
 * Returns array of [x, y] points in SVG coordinate space.
 */
function sampleElement(element) {
	try {
		const tag = element.tagName.toLowerCase();

		// For path elements, use sampleSection directly (no caching, used as fallback)
		if (tag === 'path') {
			let d = element.getAttribute('d');
			if (!d || d === 'none') {
				const computed = window.getComputedStyle(element).getPropertyValue('d');
				if (!computed || computed === 'none') {
					// Fall through to getPointAtLength
				} else {
					d = computed;
				}
			}
			if (d) {
				const wrapped = d.match(/path\(\s*"(.+?)"\s*\)/);
				if (wrapped) d = wrapped[1];
				const pts = sampleSection(d, SAMPLES_PER_UNIT);
				if (pts) return pts;
			}
			// Fall through to getPointAtLength if parsing failed
		}

		const length = element.getTotalLength();
		if (!isFinite(length) || length === 0) return [];

		const closed = isClosedShape(element);

		// Calculate sample count based on path length
		const numSamples = Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.round(length * SAMPLES_PER_UNIT)));

		// Get corner distances for this element type
		const cornerDists = getCornerDistances(element);
		const cornerSet = new Set(cornerDists.map(d => d.toFixed(2)));

		// Build sample distances: uniform + corners merged
		const distances = new Set();

		// Uniform samples
		for (let i = 0; i < numSamples; i++) {
			const d = closed
				? (i / numSamples) * length
				: (i / (numSamples - 1)) * length;
			distances.add(d);
		}

		// Add corner distances
		for (const d of cornerDists) {
			distances.add(d);
		}

		// Sort and sample
		const sortedDistances = [...distances].sort((a, b) => a - b);

		const points = [];
		for (const d of sortedDistances) {
			const pt = element.getPointAtLength(d);
			points.push([pt.x, pt.y]);
		}

		// Close the shape
		if (closed && points.length > 0) {
			points.push([points[0][0], points[0][1]]);
		}

		return points;
	} catch (error) {
		console.warn('Failed to sample SVG element:', error);
		return [];
	}
}

/**
 * Apply transformation matrix to a set of points
 * Uses getScreenCTM to capture CSS transforms and SVG transforms
 */
function transformPoints(points, element, svgRoot) {
	try {
		const elementCTM = element.getScreenCTM();
		const svgCTM = svgRoot.getScreenCTM();
		if (!elementCTM || !svgCTM) return points;

		const inverseSvgCTM = svgCTM.inverse();
		const relativeMatrix = inverseSvgCTM.multiply(elementCTM);

		const svgPoint = svgRoot.createSVGPoint();

		return points.map(([x, y]) => {
			svgPoint.x = x;
			svgPoint.y = y;
			const transformed = svgPoint.matrixTransform(relativeMatrix);
			return [transformed.x, transformed.y];
		});
	} catch (error) {
		return points;
	}
}

/**
 * Normalize points from SVG viewBox coordinates to [-1, 1] range
 */
function normalizeToViewBox(points, viewBox) {
	const centerX = viewBox.x + viewBox.width / 2;
	const centerY = viewBox.y + viewBox.height / 2;
	const scale = Math.max(viewBox.width, viewBox.height);

	if (scale === 0) return points;

	return points.map(([x, y]) => [
		((x - centerX) / scale) * 2,
		((y - centerY) / scale) * 2
	]);
}

/**
 * Check if a point is inside the visible range [-1, 1]
 */
function isInRange(x, y) {
	return x >= -1 && x <= 1 && y >= -1 && y <= 1;
}

/**
 * Interpolate between two points to find the intersection with the [-1, 1] boundary
 */
function clipEdge(inside, outside) {
	const dx = outside[0] - inside[0];
	const dy = outside[1] - inside[1];
	let t = 1;

	// Find the smallest t where the line crosses a boundary
	if (dx !== 0) {
		const tx = dx > 0 ? (1 - inside[0]) / dx : (-1 - inside[0]) / dx;
		if (tx >= 0 && tx < t) t = tx;
	}
	if (dy !== 0) {
		const ty = dy > 0 ? (1 - inside[1]) / dy : (-1 - inside[1]) / dy;
		if (ty >= 0 && ty < t) t = ty;
	}

	return [
		inside[0] + dx * t,
		inside[1] + dy * t
	];
}

/**
 * Clip a series of points to the visible range [-1, 1].
 * Returns an array of sub-segments (each an array of [x, y] points).
 * Points outside the range are dropped. Transitions between
 * inside and outside are interpolated to the boundary.
 */
function clipToVisibleRange(points) {
	if (points.length === 0) return [];

	const segments = [];
	let currentSegment = [];

	for (let i = 0; i < points.length; i++) {
		const pt = points[i];
		const inside = isInRange(pt[0], pt[1]);

		if (inside) {
			// If previous point was outside, add clipped entry point
			if (currentSegment.length === 0 && i > 0) {
				const prev = points[i - 1];
				if (!isInRange(prev[0], prev[1])) {
					currentSegment.push(clipEdge(pt, prev));
				}
			}
			currentSegment.push(pt);
		} else {
			// Point is outside — if we were inside, add clipped exit point and close segment
			if (currentSegment.length > 0) {
				const prev = points[i - 1];
				if (isInRange(prev[0], prev[1])) {
					currentSegment.push(clipEdge(prev, pt));
				}
				segments.push(currentSegment);
				currentSegment = [];
			}
		}
	}

	// Close final segment
	if (currentSegment.length > 0) {
		segments.push(currentSegment);
	}

	return segments;
}

/**
 * Calculate distance between two points
 */
function distance(p1, p2) {
	const dx = p1[0] - p2[0];
	const dy = p1[1] - p2[1];
	return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Optimize segment order to minimize jump distances between segments
 * Uses greedy nearest-neighbor starting from center
 */
function optimizeSegmentOrder(segments) {
	if (segments.length <= 1) return segments;

	const ordered = [];
	const remaining = [...segments];

	// Start with segment closest to center
	let startIndex = 0;
	let minDistToCenter = Infinity;
	remaining.forEach((segment, index) => {
		const segStart = segment.points[0];
		const segEnd = segment.points[segment.points.length - 1];

		const distStart = distance(segStart, [0, 0]);
		const distEnd = distance(segEnd, [0, 0]);
		const minDist = Math.min(distStart, distEnd);

		if (minDist < minDistToCenter) {
			minDistToCenter = minDist;
			startIndex = index;
		}
	});

	let current = remaining.splice(startIndex, 1)[0];
	ordered.push(current);

	while (remaining.length > 0) {
		const currentEnd = current.points[current.points.length - 1];
		let bestIndex = 0;
		let bestDist = Infinity;
		let bestReverse = false;

		for (let i = 0; i < remaining.length; i++) {
			const seg = remaining[i];
			const segStart = seg.points[0];
			const segEnd = seg.points[seg.points.length - 1];

			const distToStart = distance(currentEnd, segStart);
			const distToEnd = distance(currentEnd, segEnd);

			if (distToStart < bestDist) {
				bestDist = distToStart;
				bestIndex = i;
				bestReverse = false;
			}
			if (distToEnd < bestDist) {
				bestDist = distToEnd;
				bestIndex = i;
				bestReverse = true;
			}
		}

		current = remaining.splice(bestIndex, 1)[0];
		if (bestReverse) {
			current.points = current.points.slice().reverse();
		}
		ordered.push(current);
	}

	return ordered;
}

/**
 * SVG Sampler class
 * Samples SVG geometry from a container element each frame
 */
export class SVGSampler {
	constructor() {
		this.container = null;
		// Per-element geometry cache: WeakMap<Element, { key: string, points: Array }>
		this._cache = new WeakMap();
	}

	/**
	 * Set the container element that holds all SVG drawings
	 */
	setContainer(container) {
		this.container = container;
	}

	/**
	 * Sample all visible SVG geometry and return normalized segments
	 * Iterates over all <svg> elements in the container, skipping hidden ones.
	 * Returns array of segments, each segment is array of {x, y, r, g, b, opacity}
	 * Coordinates are in [-1, 1] range
	 */
	sampleFrame() {
		if (!this.container) return [];

		// Find direct child SVG elements (the drawings)
		const svgElements = this.container.querySelectorAll(':scope > svg');

		if (svgElements.length === 0) return [];

		// Force reflow before checking computed styles
		this.container.offsetHeight;

		const rawSegments = [];

		for (const svgRoot of svgElements) {
			const svgStyle = window.getComputedStyle(svgRoot);
			if (svgStyle.visibility === 'hidden' || svgStyle.display === 'none') continue;
			if (parseFloat(svgStyle.opacity) <= 0) continue;

			this._sampleSVG(svgRoot, rawSegments);
		}

		if (rawSegments.length === 0) return [];

		// Optimize segment order across all visible SVGs
		const optimized = optimizeSegmentOrder(rawSegments);

		// Convert to output format
		return optimized.map(seg => {
			return seg.points.map(([x, y]) => ({
				x, y,
				r: seg.color.r, g: seg.color.g, b: seg.color.b,
				opacity: seg.opacity
			}));
		});
	}

	/**
	 * Sample a single SVG element and add segments to rawSegments
	 */
	_sampleSVG(svgRoot, rawSegments) {
		const viewBox = this._getViewBox(svgRoot);
		if (!viewBox) return;

		// Force reflow
		svgRoot.getBoundingClientRect();

		const elements = svgRoot.querySelectorAll(DRAWABLE_SELECTOR);
		if (elements.length === 0) return;

		for (const element of elements) {
			if (!isElementVisible(element, svgRoot)) continue;

			const opacity = getCumulativeOpacity(element, svgRoot);
			if (opacity <= 0) continue;

			const computed = window.getComputedStyle(element);
			const strokeColor = parseColor(computed.stroke);
			const color = strokeColor || { r: 0, g: 255, b: 0 };

			const tag = element.tagName.toLowerCase();
			let pointSets = null; // array of point arrays (one per part/segment)

			if (tag === 'path') {
				// Section-level path caching — splits at M boundaries
				let d = computed.getPropertyValue('d') || element.getAttribute('d') || '';
				if (d && d !== 'none') {
					let pathCache = this._cache.get(element);
					if (!pathCache || !pathCache._sect) {
						pathCache = { _sect: true, sections: null, sectionPoints: [] };
						this._cache.set(element, pathCache);
					}
					pointSets = samplePathSectioned(d, SAMPLES_PER_UNIT, pathCache);
				}
				if (!pointSets) {
					const fallback = sampleElement(element);
					if (fallback && fallback.length >= 2) pointSets = [fallback];
				}
			} else {
				// Non-path elements: full geometry cache by key
				const geoKey = this._getGeometryKey(element, computed);
				const cached = this._cache.get(element);
				let rawPoints;
				if (cached && !cached._sect && cached.key === geoKey) {
					rawPoints = cached.points;
				} else {
					rawPoints = sampleElement(element);
					this._cache.set(element, { key: geoKey, points: rawPoints });
				}
				if (rawPoints && rawPoints.length >= 2) pointSets = [rawPoints];
			}
			if (!pointSets || pointSets.length === 0) continue;

			// Process each part independently (transform, normalize, clip)
			for (const rawPoints of pointSets) {
				if (!rawPoints || rawPoints.length < 2) continue;

				const transformedPoints = transformPoints(rawPoints, element, svgRoot);
				const normalizedPoints = normalizeToViewBox(transformedPoints, viewBox);
				const clippedSegments = clipToVisibleRange(normalizedPoints);

				for (const clippedPoints of clippedSegments) {
					if (clippedPoints.length < 2) continue;
					rawSegments.push({
						points: clippedPoints,
						color,
						opacity
					});
				}
			}
		}
	}

	/**
	 * Get a cache key string representing the element's geometry definition.
	 * Changes when the shape itself changes, but NOT for transform/opacity/color changes.
	 */
	_getGeometryKey(element, computed) {
		const tag = element.tagName.toLowerCase();
		switch (tag) {
			case 'path': {
				// Prefer CSS computed d (handles d: var(--drawing-path)) over DOM attribute
				const cssD = computed.getPropertyValue('d');
				return cssD || element.getAttribute('d') || '';
			}
			case 'circle':
				return `${element.getAttribute('cx')},${element.getAttribute('cy')},${element.getAttribute('r')}`;
			case 'ellipse':
				return `${element.getAttribute('cx')},${element.getAttribute('cy')},${element.getAttribute('rx')},${element.getAttribute('ry')}`;
			case 'rect':
				return `${element.getAttribute('x')},${element.getAttribute('y')},${element.getAttribute('width')},${element.getAttribute('height')},${element.getAttribute('rx')},${element.getAttribute('ry')}`;
			case 'line':
				return `${element.getAttribute('x1')},${element.getAttribute('y1')},${element.getAttribute('x2')},${element.getAttribute('y2')}`;
			case 'polygon':
			case 'polyline':
				return element.getAttribute('points') || '';
			default:
				return ''; // No cache — always re-sample
		}
	}

	/**
	 * Get the effective viewBox of the SVG element
	 */
	_getViewBox(svgRoot) {
		// Prefer explicit viewBox attribute
		const viewBoxAttr = svgRoot.getAttribute('viewBox');
		if (viewBoxAttr) {
			const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
			if (parts.length === 4 && parts.every(n => isFinite(n))) {
				return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
			}
		}

		// Fall back to width/height attributes
		const width = parseFloat(svgRoot.getAttribute('width'));
		const height = parseFloat(svgRoot.getAttribute('height'));
		if (isFinite(width) && isFinite(height) && width > 0 && height > 0) {
			return { x: 0, y: 0, width, height };
		}

		// Fall back to bounding box
		try {
			const bbox = svgRoot.getBBox();
			if (bbox.width > 0 && bbox.height > 0) {
				return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
			}
		} catch (e) {
			// getBBox can fail if SVG is not rendered
		}

		return null;
	}
}
