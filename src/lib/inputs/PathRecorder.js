/**
 * Path Recorder
 *
 * Records motion controller input and converts to SVG path data exposed as a
 * CSS custom property via CustomPropertyManager.
 *
 *   #my-shape { d: var(--drawing-path); }
 *   #moving { offset-path: var(--drawing-path); }
 *
 * Performance strategy — incremental chunked pipeline:
 *   1. Raw points accumulate in a "tail" buffer
 *   2. When the tail exceeds CHUNK_SIZE, RDP-simplify it and freeze as path string
 *   3. Each RAF, only the (small) tail is simplified and converted to path string
 *   4. Final CSS = frozen prefix + live tail suffix — no full reprocessing
 */

export class PathRecorder {
	constructor(customPropertyManager) {
		this.customPropertyManager = customPropertyManager;

		// All raw points (kept for pointCount / final export)
		this.points = [];

		this.recording = false;

		// RAF state
		this._rafId = null;
		this._rafPending = false;
		this._dirty = false;

		// Incremental path building
		this._frozenPathData = '';       // Already-simplified path segments (M ... C ... C ...)
		this._frozenPointCount = 0;      // How many raw points have been frozen
		this._frozenLastPoint = null;    // Last point of frozen path (for continuity)
		this._totalSimplified = 0;       // Total simplified point count

		// Configuration
		this.viewBox = { width: 100, height: 100 };
		this.smoothing = 0.5;
		this.minDistance = 1.0;
		this.simplifyTolerance = 0.8;

		this.propertyName = 'drawing-path';

		// Tail buffer size before freezing a chunk
		this._CHUNK_SIZE = 200;

		// Set after a part boundary so the next freeze/tail starts with M
		this._newPart = true;

		// Device ownership & drawing-enabled state
		this._activeDeviceId = null;
		this._idleTimerId = null;
		this._IDLE_TIMEOUT = 15_000; // ms of no cursor movement before auto-disable

		// Set default CSS values
		this._setDefaults();
	}

	/** The device that currently owns the drawing session, or null. */
	get activeDeviceId() {
		return this._activeDeviceId;
	}

	/**
	 * Claim drawing ownership for a device.
	 * Clears any existing path, resets the cursor to center, and enables drawing mode.
	 * If another device was active, it is replaced.
	 */
	activate(deviceId) {
		this.clear();
		this._activeDeviceId = deviceId;
		this._setCursorProperties(50, 50);
		this.customPropertyManager.setProperty('drawing-enabled', '1');
		this._resetIdleTimer();
	}

	/**
	 * Disable drawing mode and reset to defaults.
	 */
	deactivate() {
		if (this.recording) {
			this.pauseRecording();
		}
		this._activeDeviceId = null;
		this._clearIdleTimer();
		this._setDefaults();
	}

	/**
	 * Update the cursor CSS properties. Only works when drawing is enabled.
	 * Resets the idle timer on each call.
	 */
	setCursor(x, y) {
		if (!this._activeDeviceId) return;
		this._setCursorProperties(x, y);
		this._resetIdleTimer();
	}

	/**
	 * Check if a device is allowed to draw (is the active device).
	 */
	isActiveDevice(deviceId) {
		return this._activeDeviceId === deviceId;
	}

	_setCursorProperties(x, y) {
		this.customPropertyManager.setProperty('drawing-cursor-x', x.toFixed(1));
		this.customPropertyManager.setProperty('drawing-cursor-y', y.toFixed(1));
	}

	_setDefaults() {
		this.customPropertyManager.setProperty('drawing-cursor-x', '50');
		this.customPropertyManager.setProperty('drawing-cursor-y', '50');
		this.customPropertyManager.setProperty('drawing-enabled', '0');
		this.customPropertyManager.setProperty(this.propertyName, 'none');
	}

	_resetIdleTimer() {
		this._clearIdleTimer();
		this._idleTimerId = setTimeout(() => {
			this.deactivate();
		}, this._IDLE_TIMEOUT);
	}

	_clearIdleTimer() {
		if (this._idleTimerId !== null) {
			clearTimeout(this._idleTimerId);
			this._idleTimerId = null;
		}
	}

	/**
	 * Start a new disconnected part (or the first part).
	 * Freezes any existing tail as a section with a part boundary, then begins recording.
	 */
	startPart() {
		if (this.points.length > this._frozenPointCount) {
			this._freezeAllTail();
		}
		// Reset raw points for the new part (frozen data is preserved)
		this._frozenPointCount = this.points.length;
		this.recording = true;
	}

	/**
	 * Pause recording (draw-end). Keeps all data, just stops accepting points.
	 */
	pauseRecording() {
		if (!this.recording) return;
		this._freezeAllTail();
		this.recording = false;
		this._cancelRAF();
		this._updateCSSProperty();
	}

	clear() {
		this.points = [];
		this._frozenPathData = '';
		this._frozenPointCount = 0;
		this._frozenLastPoint = null;
		this._totalSimplified = 0;
		this._newPart = true;
		this._dirty = false;
		this.recording = false;
		this._cancelRAF();
		this._clearIdleTimer();
		this._updateCSSProperty();
	}

	addPoint(normalizedX, normalizedY) {
		if (!this.recording) return;

		const x = normalizedX * this.viewBox.width;
		const y = normalizedY * this.viewBox.height;

		if (this.points.length > 0) {
			const last = this.points[this.points.length - 1];
			const dx = x - last.x;
			const dy = y - last.y;
			if (dx * dx + dy * dy < this.minDistance * this.minDistance) return;
		}

		this.points.push({ x, y });
		this._dirty = true;

		// Freeze old chunks when tail gets large
		const tailLength = this.points.length - this._frozenPointCount;
		if (tailLength >= this._CHUNK_SIZE) {
			this._freezeChunk();
		}

		this._scheduleRAF();
	}

	/**
	 * Simplify and freeze the current tail (minus a small overlap for continuity),
	 * appending the resulting bezier path data to _frozenPathData.
	 */
	_freezeChunk() {
		const tail = this.points.slice(this._frozenPointCount);
		if (tail.length < 4) return;

		// Keep last 4 points as overlap for smooth join with next chunk
		const freezeEnd = tail.length - 4;
		const toFreeze = tail.slice(0, freezeEnd + 1); // include overlap point

		const simplified = this.simplifyTolerance > 0
			? PathRecorder._rdpSimplify(toFreeze, this.simplifyTolerance)
			: toFreeze;

		if (simplified.length < 2) return;

		// Start with M if this is the first chunk ever, or the first chunk of a new part
		const isFirst = this._frozenPathData === '' || this._newPart;
		const pathData = this._pointsToIncrementalPath(simplified, isFirst);
		this._newPart = false;

		// End the frozen section with M to the last point — section boundary marker.
		// The next section (frozen or tail) will start with its own M at the same point.
		const lastPt = simplified[simplified.length - 1];
		this._frozenPathData += pathData + ` M ${lastPt.x.toFixed(1)},${lastPt.y.toFixed(1)}`;

		this._frozenLastPoint = lastPt;
		this._frozenPointCount = this._frozenPointCount + freezeEnd;
		this._totalSimplified += simplified.length - (isFirst ? 0 : 1);
	}

	/**
	 * Freeze the entire remaining tail (used when pausing or starting a new part).
	 * Unlike _freezeChunk, this freezes everything with no overlap kept.
	 * Ends with double M M to signal a disconnected part boundary.
	 */
	_freezeAllTail() {
		const tail = this.points.slice(this._frozenPointCount);
		if (tail.length < 2) return;

		const simplified = this.simplifyTolerance > 0
			? PathRecorder._rdpSimplify(tail, this.simplifyTolerance)
			: tail;

		if (simplified.length < 2) return;

		const isFirst = this._frozenPathData === '' || this._newPart;
		const pathData = this._pointsToIncrementalPath(simplified, isFirst);
		this._newPart = false;

		// Double M M = part boundary (disconnected). The sampler treats an M-only
		// section as a gap between independent parts.
		const lastPt = simplified[simplified.length - 1];
		this._frozenPathData += pathData
			+ ` M ${lastPt.x.toFixed(1)},${lastPt.y.toFixed(1)}`
			+ ` M ${lastPt.x.toFixed(1)},${lastPt.y.toFixed(1)}`;

		this._frozenLastPoint = lastPt;
		this._frozenPointCount = this.points.length;
		this._totalSimplified += simplified.length - (isFirst ? 0 : 1);
		this._newPart = true; // next freeze starts a fresh part
		this._dirty = true;
	}

	_scheduleRAF() {
		if (this._rafPending) return;
		this._rafPending = true;
		this._rafId = requestAnimationFrame(() => {
			this._rafPending = false;
			this._rafId = null;
			if (this._dirty) {
				this._dirty = false;
				this._updateCSSProperty();
			}
		});
	}

	_cancelRAF() {
		if (this._rafId !== null) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
			this._rafPending = false;
		}
	}

	toPathValue() {
		if (this.points.length < 2) return '';

		// Build live tail (un-frozen recent points)
		const tail = this.points.slice(this._frozenPointCount);

		const simplified = this.simplifyTolerance > 0 && tail.length > 4
			? PathRecorder._rdpSimplify(tail, this.simplifyTolerance)
			: tail;

		if (this._frozenPathData === '' && simplified.length < 2) return '';

		// Tail always starts with M (either it's the first section, or
		// the frozen prefix ends with M at the junction point)
		const tailPath = simplified.length >= 2
			? this._pointsToIncrementalPath(simplified, true)
			: '';

		const pathData = this._frozenPathData + tailPath;
		if (!pathData) return '';

		return `path("${pathData}")`;
	}

	/**
	 * Convert simplified points to path data.
	 * @param {boolean} isFirst - if true, emit leading M; otherwise just C segments
	 */
	_pointsToIncrementalPath(pts, isFirst) {
		if (pts.length < 2) return '';

		if (this.smoothing > 0 && pts.length > 2) {
			return this._toCubicBezier(pts, isFirst);
		}

		let d = '';
		if (isFirst) {
			d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
		}
		const start = isFirst ? 1 : 0;
		for (let i = start; i < pts.length; i++) {
			d += ` L ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
		}
		return d;
	}

	_toCubicBezier(pts, isFirst) {
		if (pts.length < 2) return '';

		const tension = 1 - this.smoothing;
		let d = '';

		if (isFirst) {
			d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
		}

		for (let i = 0; i < pts.length - 1; i++) {
			if (i === 0 && !isFirst) {
				// First segment of a continuation chunk — skip, it's the overlap point
				continue;
			}

			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];

			const cp1x = p1.x + (p2.x - p0.x) / (6 / tension);
			const cp1y = p1.y + (p2.y - p0.y) / (6 / tension);
			const cp2x = p2.x - (p3.x - p1.x) / (6 / tension);
			const cp2y = p2.y - (p3.y - p1.y) / (6 / tension);

			d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
		}

		return d;
	}

	_updateCSSProperty() {
		if (!this.customPropertyManager) return;

		const pathValue = this.toPathValue();
		if (pathValue) {
			this.customPropertyManager.setProperty(this.propertyName, pathValue);
		} else {
			this.customPropertyManager.setProperty(this.propertyName, 'none');
		}
	}

	/**
	 * Ramer-Douglas-Peucker line simplification (iterative)
	 */
	static _rdpSimplify(points, epsilon) {
		if (points.length <= 2) return points.slice();

		const keep = new Uint8Array(points.length);
		keep[0] = 1;
		keep[points.length - 1] = 1;

		const stack = [[0, points.length - 1]];

		while (stack.length > 0) {
			const [start, end] = stack.pop();
			if (end - start < 2) continue;

			let maxDist = 0;
			let maxIdx = start;

			const ax = points[start].x, ay = points[start].y;
			const bx = points[end].x, by = points[end].y;
			const dx = bx - ax, dy = by - ay;
			const lenSq = dx * dx + dy * dy;

			for (let i = start + 1; i < end; i++) {
				let dist;
				if (lenSq === 0) {
					const ex = points[i].x - ax, ey = points[i].y - ay;
					dist = Math.sqrt(ex * ex + ey * ey);
				} else {
					const t = Math.max(0, Math.min(1,
						((points[i].x - ax) * dx + (points[i].y - ay) * dy) / lenSq));
					const projX = ax + t * dx;
					const projY = ay + t * dy;
					const ex = points[i].x - projX, ey = points[i].y - projY;
					dist = Math.sqrt(ex * ex + ey * ey);
				}

				if (dist > maxDist) {
					maxDist = dist;
					maxIdx = i;
				}
			}

			if (maxDist > epsilon) {
				keep[maxIdx] = 1;
				stack.push([start, maxIdx]);
				stack.push([maxIdx, end]);
			}
		}

		const result = [];
		for (let i = 0; i < points.length; i++) {
			if (keep[i]) result.push(points[i]);
		}
		return result;
	}

	get pointCount() {
		return this.points.length;
	}

	get simplifiedPointCount() {
		// Frozen simplified + live tail simplified (approximate)
		const tail = this.points.slice(this._frozenPointCount);
		const tailSimplified = this.simplifyTolerance > 0 && tail.length > 4
			? PathRecorder._rdpSimplify(tail, this.simplifyTolerance).length
			: tail.length;
		return this._totalSimplified + tailSimplified;
	}

	get hasPath() {
		return this.points.length >= 2;
	}
}
