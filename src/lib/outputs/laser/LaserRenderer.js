/**
 * Laser Renderer for SVG-to-laser output
 *
 * Converts normalized SVG geometry segments to ILDA laser format and sends to Helios DAC.
 * Ported from WebAudioOscilloscope, adapted for segment-based input.
 */

import { HeliosPoint, connectHeliosDevice, getHeliosDevices, HELIOS } from './HeliosDac.js';

/**
 * Trapezoid calibration for keystone correction
 * Transforms a unit square to an arbitrary quadrilateral using bilinear interpolation
 */
export class TrapezoidCalibration {
	constructor() {
		this.corners = {
			topLeft: { x: 0, y: 0 },
			topRight: { x: 1, y: 0 },
			bottomLeft: { x: 0, y: 1 },
			bottomRight: { x: 1, y: 1 }
		};

		this.coefficients = null;
		this.computeCoefficients();
	}

	setCorners(corners) {
		this.corners = { ...this.corners, ...corners };
		this.computeCoefficients();
	}

	computeCoefficients() {
		const { topLeft, topRight, bottomLeft, bottomRight } = this.corners;

		this.coefficients = {
			ax: topLeft.x,
			bx: topRight.x - topLeft.x,
			cx: bottomLeft.x - topLeft.x,
			dx: topLeft.x - topRight.x - bottomLeft.x + bottomRight.x,
			ay: topLeft.y,
			by: topRight.y - topLeft.y,
			cy: bottomLeft.y - topLeft.y,
			dy: topLeft.y - topRight.y - bottomLeft.y + bottomRight.y
		};
	}

	transform(x, y) {
		const { ax, bx, cx, dx, ay, by, cy, dy } = this.coefficients;

		return {
			x: ax + bx * x + cx * y + dx * x * y,
			y: ay + by * x + cy * y + dy * x * y
		};
	}

	reset() {
		this.corners = {
			topLeft: { x: 0, y: 0 },
			topRight: { x: 1, y: 0 },
			bottomLeft: { x: 0, y: 1 },
			bottomRight: { x: 1, y: 1 }
		};
		this.computeCoefficients();
	}

	toJSON() {
		return { corners: this.corners };
	}

	fromJSON(data) {
		if (data && data.corners) {
			this.setCorners(data.corners);
		}
	}
}

/**
 * Laser output renderer
 */
export class LaserRenderer {
	constructor() {
		this.device = null;
		this.calibration = new TrapezoidCalibration();

		this.calibrationParams = {
			rotate: 0,
			scale: 1.0,
			topBottom: 0,
			leftRight: 0
		};

		// Frame pacing
		this.lastFrameTime = 0;
		this.minFrameInterval = 20;
		this.pendingFrame = null;
		this.isSending = false;

		// Stats tracking
		this.framesSentThisSecond = 0;
		this.framesSkippedThisSecond = 0;
		this.lastStatsTime = 0;

		// Laser output settings
		this.settings = {
			pps: 30000,
			targetFps: 30,
			intensity: 1.0,
			color: { r: 0, g: 255, b: 0 },
			blankingPoints: 8,
			blankingDwell: 3,
			cornerDwell: 2,
			invertX: true,
			invertY: true,
			swapXY: false,
			safetyBorder: 0.05,
			pincushionH: 0.0,
			pincushionV: 0.0,
			offsetX: 0.0,
			offsetY: 0.0,
			velocityDimming: 0.5
		};

		this.enabled = false;
		this.lastFrame = [];
		this.frameCount = 0;
		this.onStatusChange = null;

		this.stats = {
			framesPerSecond: 0,
			pointsPerFrame: 0,
			inputPoints: 0,
			resampledPoints: 0,
			totalBeforeClamp: 0,
			drawingPoints: 0,
			blankingPoints: 0,
			cornerDwellPoints: 0,
			anchorDwellPoints: 0,
			targetPoints: 0,
			processMs: 0,
			sendMs: 0,
			statusMs: 0
		};

		// Last resampled points in virtual space (for preview)
		this.lastResampledPoints = [];
		// Last processed frame points in virtual space (includes blanking/dwell)
		this.lastProcessedPoints = [];
		// Cached overhead from previous frame for single-pass optimization
		this._lastOverhead = 0;
	}

	static isSupported() {
		return 'usb' in navigator && window.isSecureContext;
	}

	async connect() {
		try {
			this.emitStatus('connecting');
			this.device = await connectHeliosDevice();

			if (this.device) {
				this.device.pps = this.settings.pps;
				this.device.onStatusChange = (status) => {
					if (this.onStatusChange) {
						this.onStatusChange(status);
					}
				};

				const result = await this.device.connect();
				this.emitStatus('connected', {
					name: this.device.name,
					firmware: this.device.firmwareVersion
				});
				return true;
			}
			return false;
		} catch (error) {
			console.error('[LaserRenderer] Failed to connect:', error);
			this.emitStatus('error', { error: error.message });
			return false;
		}
	}

	async getAvailableDevices() {
		return getHeliosDevices();
	}

	async disconnect() {
		if (this.device) {
			await this.device.close();
			this.device = null;
			this.enabled = false;
			this.emitStatus('disconnected');
		}
	}

	setEnabled(enabled) {
		this.enabled = enabled && this.device && !this.device.closed;
		this.emitStatus(enabled ? 'enabled' : 'disabled');
	}

	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings };
		if (this.device) {
			this.device.pps = this.settings.pps;
		}
	}

	emitStatus(status, data = {}) {
		if (this.onStatusChange) {
			this.onStatusChange({ status, ...data });
		}
	}

	isReady() {
		return this.device && !this.device.closed && this.enabled;
	}

	/**
	 * Convert virtual coordinates (-1 to 1) to laser DAC coordinates (0-4095)
	 * Applies calibration transformation
	 */
	virtualToLaser(x, y) {
		const { invertX, invertY, swapXY, safetyBorder, pincushionH, pincushionV, offsetX, offsetY } = this.settings;

		x += offsetX;
		y += offsetY;

		let nx = (x + 1) / 2;
		let ny = (y + 1) / 2;

		if (pincushionH !== 0 || pincushionV !== 0) {
			const cx = nx - 0.5;
			const cy = ny - 0.5;
			const r2 = cx * cx + cy * cy;
			nx = 0.5 + cx * (1 + pincushionH * r2 * 0.4);
			ny = 0.5 + cy * (1 + pincushionV * r2 * 0.4);
		}

		if (invertX) nx = 1 - nx;
		if (invertY) ny = 1 - ny;

		if (swapXY) {
			[nx, ny] = [ny, nx];
		}

		const range = 1 - 2 * safetyBorder;
		nx = safetyBorder + nx * range;
		ny = safetyBorder + ny * range;

		const calibrated = this.calibration.transform(nx, ny);

		return {
			x: Math.max(0, Math.min(4095, Math.round(calibrated.x * 4095))),
			y: Math.max(0, Math.min(4095, Math.round(calibrated.y * 4095)))
		};
	}

	/**
	 * Generate blanking points to travel from one position to another
	 */
	generateBlanking(fromX, fromY, toX, toY) {
		const points = [];
		const count = this.settings.blankingPoints;
		const dwell = this.settings.blankingDwell;

		const turnOffDwell = Math.max(2, Math.floor(dwell / 2));
		for (let i = 0; i < turnOffDwell; i++) {
			points.push(HeliosPoint.blank(fromX, fromY));
		}

		for (let i = 0; i <= count; i++) {
			const t = i / count;
			const x = fromX + (toX - fromX) * t;
			const y = fromY + (toY - fromY) * t;
			points.push(HeliosPoint.blank(x, y));
		}

		for (let i = 0; i < dwell; i++) {
			points.push(HeliosPoint.blank(toX, toY));
		}

		return points;
	}

	/**
	 * Convert normalized point segments to laser points
	 * Each point: { x, y, r?, g?, b?, opacity?, segmentStart? }
	 * Coordinates in virtual space (-1 to 1)
	 */
	convertTraceToLaserPoints(points, speeds, params = {}) {
		if (!points || points.length < 2) return { points: [], counts: { drawing: 0, blanking: 0, cornerDwell: 0, anchorDwell: 0 } };

		const {
			velocityDimming = this.settings.velocityDimming,
			basePower = 1.0
		} = params;

		const laserPoints = [];
		const { color, intensity, cornerDwell } = this.settings;
		const counts = { drawing: 0, blanking: 0, cornerDwell: 0, anchorDwell: 0 };

		let prevLaserPoint = null;
		let prevVirtual = null;
		let lastWasBlank = true;

		for (let i = 0; i < points.length; i++) {
			const pt = points[i];
			const speed = speeds ? speeds[i] : 0;

			const laserCoords = this.virtualToLaser(pt.x, pt.y);

			const speedFactor = 1 - Math.min(speed * velocityDimming, 0.9);
			const opacityFactor = pt.opacity !== undefined ? pt.opacity : 1;
			const pointIntensity = intensity * basePower * speedFactor * opacityFactor * 255;

			let needsBlanking = pt.segmentStart || i === 0;

			if (!needsBlanking && prevVirtual) {
				const dx = pt.x - prevVirtual.x;
				const dy = pt.y - prevVirtual.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist > 0.15) {
					needsBlanking = true;
				}
			}

			if (needsBlanking && prevLaserPoint && !lastWasBlank) {
				// End-of-segment anchor dwell
				for (let d = 0; d < cornerDwell; d++) {
					laserPoints.push(prevLaserPoint);
	
					counts.anchorDwell++;
				}
				// Blanking travel
				const blanking = this.generateBlanking(
					prevLaserPoint.x, prevLaserPoint.y,
					laserCoords.x, laserCoords.y
				);
				laserPoints.push(...blanking);
				counts.blanking += blanking.length;
				lastWasBlank = true;
			}

			let isCorner = false;
			if (i > 0 && i < points.length - 1 && !lastWasBlank) {
				const prev = points[i - 1];
				const next = points[i + 1];
				const angle = Math.abs(
					Math.atan2(next.y - pt.y, next.x - pt.x) -
					Math.atan2(pt.y - prev.y, pt.x - prev.x)
				);
				isCorner = angle > Math.PI / 4;
			}

			const ptColor = pt.r !== undefined ? pt : color;
			const laserPoint = new HeliosPoint(
				laserCoords.x,
				laserCoords.y,
				Math.round(ptColor.r * pointIntensity / 255),
				Math.round(ptColor.g * pointIntensity / 255),
				Math.round(ptColor.b * pointIntensity / 255),
				Math.round(pointIntensity)
			);

			const dwellCount = lastWasBlank ? Math.max(cornerDwell, this.settings.blankingDwell) : (isCorner ? cornerDwell : 1);
			for (let d = 0; d < dwellCount; d++) {
				laserPoints.push(laserPoint);
				if (d === 0) {
					counts.drawing++;
				} else if (isCorner) {
					counts.cornerDwell++;
				} else {
					counts.anchorDwell++;
				}
			}

			prevLaserPoint = laserPoint;
			prevVirtual = pt;
			lastWasBlank = laserPoint.isBlank();
		}

		// Close the frame
		if (laserPoints.length > 0 && prevLaserPoint) {
			for (let d = 0; d < cornerDwell; d++) {
				laserPoints.push(prevLaserPoint);
				counts.anchorDwell++;
			}
			const firstPoint = laserPoints[0];
			const blanking = this.generateBlanking(
				prevLaserPoint.x, prevLaserPoint.y,
				firstPoint.x, firstPoint.y
			);
			laserPoints.push(...blanking);
			counts.blanking += blanking.length;
		}

		return { points: laserPoints, counts };
	}

	/**
	 * Process segments through the full render pipeline (resample + convert).
	 * Updates stats and lastResampledPoints. Returns the final HeliosPoints array.
	 */
	processSegments(segments) {
		if (!segments || segments.length === 0) {
			this.lastFrame = [];
			this.lastProcessedPoints = [];
			this.lastResampledPoints = [];
			return null;
		}
		const _t0 = performance.now();

		// Flatten segments into a single point array with segmentStart markers
		const points = [];
		for (const segment of segments) {
			for (let i = 0; i < segment.length; i++) {
				const pt = { ...segment[i] };
				if (i === 0) pt.segmentStart = true;
				points.push(pt);
			}
		}

		if (points.length < 2) return null;

		const targetPoints = Math.min(Math.floor(this.settings.pps / (this.settings.targetFps || 30)), HELIOS.MAX_POINTS);
		this.stats.inputPoints = points.length;

		const convertParams = {
			velocityDimming: this.settings.velocityDimming,
			basePower: 1.0
		};

		// Use cached overhead from previous frame for budget estimation.
		// This avoids a costly two-pass pipeline every frame.
		// The overhead is recalculated after conversion and cached for the next frame.
		const drawingBudget = Math.max(20, Math.floor((targetPoints - this._lastOverhead) * 0.98));
		const resampledPoints = this.resampleInputPoints(points, drawingBudget);
		this.lastResampledPoints = resampledPoints;

		const result = this.convertTraceToLaserPoints(resampledPoints, null, convertParams);

		if (result.points.length === 0) return null;

		const finalPoints = result.points;

		// Cache actual overhead for next frame's budget estimation
		this._lastOverhead = finalPoints.length - resampledPoints.length;

		this.lastFrame = finalPoints;
		this.stats.pointsPerFrame = finalPoints.length;
		this.stats.targetPoints = targetPoints;
		this.stats.resampledPoints = resampledPoints.length;
		this.stats.totalBeforeClamp = finalPoints.length;
		this.stats.drawingPoints = result.counts.drawing;
		this.stats.blankingPoints = result.counts.blanking;
		this.stats.cornerDwellPoints = result.counts.cornerDwell;
		this.stats.anchorDwellPoints = result.counts.anchorDwell;

		this.stats.processMs = performance.now() - _t0;

		// Build preview from DAC coordinates mapped to 0-1 range
		this.lastProcessedPoints = finalPoints.map(pt => ({
			x: pt.x / 4095,
			y: pt.y / 4095,
			r: pt.r, g: pt.g, b: pt.b,
			blank: pt.isBlank()
		}));

		return finalPoints;
	}

	/**
	 * Start the async send loop.
	 * Runs independently from rAF, polling the DAC as fast as it can accept frames.
	 * Reads the latest processed frame from lastFrame.
	 */
	startSendLoop() {
		if (this._sendLoopRunning) return;
		this._sendLoopRunning = true;
		this._runSendLoop();
	}

	stopSendLoop() {
		this._sendLoopRunning = false;
	}

	async _runSendLoop() {
		while (this._sendLoopRunning && this.isReady()) {
			try {
				const _ts0 = performance.now();
				const status = await this.device.getStatus();
				this.stats.statusMs = performance.now() - _ts0;

				if (status !== 1) {
					continue;
				}

				const frame = this.lastFrame;
				if (!frame || frame.length === 0) {
					// Send a blank frame to clear the projector
					if (!this._sentBlank) {
						const blankPoints = [];
						for (let i = 0; i < 100; i++) {
							blankPoints.push(HeliosPoint.blank(2048, 2048));
						}
						await this.device.sendFrame(blankPoints, this.settings.pps);
						this._sentBlank = true;
					}
					await new Promise(r => setTimeout(r, 10));
					continue;
				}
				this._sentBlank = false;

				const _ts1 = performance.now();
				await this.device.sendFrame(frame, this.settings.pps);
				this.stats.sendMs = performance.now() - _ts1;
				this.framesSentThisSecond++;

				const now = performance.now();
				if (now - this.lastStatsTime > 1000) {
					this.stats.framesPerSecond = this.framesSentThisSecond;
					this.framesSentThisSecond = 0;
					this.framesSkippedThisSecond = 0;
					this.lastStatsTime = now;
				}
			} catch (error) {
				console.error('[LaserRenderer] Send loop error:', error);
				await new Promise(r => setTimeout(r, 100));
			}
		}

		this._sendLoopRunning = false;
	}

	/**
	 * Resample raw input points to a target count
	 * Corner-aware: distributes more points near sharp angles
	 */
	resampleInputPoints(points, targetCount) {
		if (points.length === 0) return points;
		if (points.length === targetCount) return points;

		const segments = [];
		let segStart = 0;
		for (let i = 1; i <= points.length; i++) {
			let isBreak = i === points.length;
			if (!isBreak && points[i].segmentStart) isBreak = true;
			if (!isBreak) {
				const dx = points[i].x - points[i - 1].x;
				const dy = points[i].y - points[i - 1].y;
				if (Math.sqrt(dx * dx + dy * dy) > 0.15) isBreak = true;
			}
			if (isBreak) {
				segments.push({ start: segStart, end: i - 1 });
				segStart = i;
			}
		}

		for (const seg of segments) {
			seg.weight = 0;
			for (let i = seg.start; i < seg.end; i++) {
				const dx = points[i + 1].x - points[i].x;
				const dy = points[i + 1].y - points[i].y;
				const edgeLen = Math.sqrt(dx * dx + dy * dy);
				seg.weight += edgeLen;
				seg.weight += this._inputCornerWeight(points, i + 1, seg.start, seg.end);
			}
			seg.weight = Math.max(seg.weight, 0.001);
		}

		const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);
		const result = [];

		for (const seg of segments) {
			const segLen = seg.end - seg.start + 1;
			const segBudget = Math.max(2, Math.round(targetCount * seg.weight / totalWeight));

			if (segLen <= 2) {
				for (let i = seg.start; i <= seg.end; i++) {
					const pt = { ...points[i] };
					if (i === seg.start && result.length > 0) pt.segmentStart = true;
					result.push(pt);
				}
			} else {
				const cumWeight = [0];
				for (let i = seg.start; i < seg.end; i++) {
					const dx = points[i + 1].x - points[i].x;
					const dy = points[i + 1].y - points[i].y;
					const edgeLen = Math.sqrt(dx * dx + dy * dy);
					const cornerW = this._inputCornerWeight(points, i + 1, seg.start, seg.end);
					cumWeight.push(cumWeight[cumWeight.length - 1] + edgeLen + cornerW);
				}
				const totalW = cumWeight[cumWeight.length - 1];

				if (totalW === 0) {
					const pt = { ...points[seg.start] };
					if (result.length > 0) pt.segmentStart = true;
					result.push(pt);
					continue;
				}

				const isUpsampling = segBudget > segLen;

				for (let j = 0; j < segBudget; j++) {
					const targetW = segBudget > 1 ? (j / (segBudget - 1)) * totalW : 0;
					let lo = 0, hi = cumWeight.length - 2;
					while (lo < hi) {
						const mid = (lo + hi) >> 1;
						if (cumWeight[mid + 1] < targetW) lo = mid + 1;
						else hi = mid;
					}

					let pt;
					if (isUpsampling) {
						const edgeW = cumWeight[lo + 1] - cumWeight[lo];
						const frac = edgeW > 0 ? (targetW - cumWeight[lo]) / edgeW : 0;
						const a = points[seg.start + lo];
						const b = points[Math.min(seg.start + lo + 1, seg.end)];
						pt = {
							x: a.x + (b.x - a.x) * frac,
							y: a.y + (b.y - a.y) * frac,
						};
						if (a.r !== undefined) {
							pt.r = Math.round(a.r + ((b.r || 0) - a.r) * frac);
							pt.g = Math.round(a.g + ((b.g || 0) - a.g) * frac);
							pt.b = Math.round(a.b + ((b.b || 0) - a.b) * frac);
						}
						if (a.opacity !== undefined) {
							pt.opacity = a.opacity + ((b.opacity !== undefined ? b.opacity : 1) - a.opacity) * frac;
						}
					} else {
						const edgeW = cumWeight[lo + 1] - cumWeight[lo];
						const frac = edgeW > 0 ? (targetW - cumWeight[lo]) / edgeW : 0;
						const idx = frac < 0.5 ? seg.start + lo : Math.min(seg.start + lo + 1, seg.end);
						pt = { ...points[idx] };
					}

					if (j === 0 && result.length > 0) pt.segmentStart = true;
					else if (j > 0) pt.segmentStart = false;
					result.push(pt);
				}
			}
		}
		return result;
	}

	_inputCornerWeight(points, idx, segStart, segEnd) {
		if (idx <= segStart || idx >= segEnd) return 0;
		const prev = points[idx - 1], cur = points[idx], next = points[idx + 1];
		const ax = cur.x - prev.x, ay = cur.y - prev.y;
		const bx = next.x - cur.x, by = next.y - cur.y;
		const magA = Math.sqrt(ax * ax + ay * ay);
		const magB = Math.sqrt(bx * bx + by * by);
		if (magA === 0 || magB === 0) return 0;
		const dot = ax * bx + ay * by;
		const cosAngle = dot / (magA * magB);
		const sharpness = Math.max(0, (1 - cosAngle) / 2);
		const avgEdge = (magA + magB) / 2;
		return sharpness * avgEdge * (this.settings.cornerDwell || 3);
	}

	/**
	 * Generate a test pattern for calibration
	 */
	generateTestPattern() {
		const points = [];

		const addLine = (x1, y1, x2, y2, r, g, b, steps, segmentStart = false) => {
			for (let s = 0; s <= steps; s++) {
				const t = s / steps;
				points.push({
					x: x1 + (x2 - x1) * t,
					y: y1 + (y2 - y1) * t,
					r, g, b,
					segmentStart: s === 0 && segmentStart
				});
			}
		};

		// Green square
		const border = 0.9;
		const corners = [
			[-border, -border], [border, -border],
			[border, border], [-border, border]
		];
		for (let c = 0; c < 4; c++) {
			const [x1, y1] = corners[c];
			const [x2, y2] = corners[(c + 1) % 4];
			addLine(x1, y1, x2, y2, 0, 255, 0, 50, c === 0);
		}

		// Red circle
		const radius = 0.6;
		const circleSteps = 100;
		for (let s = 0; s <= circleSteps; s++) {
			const angle = (s / circleSteps) * Math.PI * 2;
			points.push({
				x: radius * Math.cos(angle),
				y: radius * Math.sin(angle),
				r: 255, g: 0, b: 0,
				segmentStart: s === 0
			});
		}

		// Blue cross
		addLine(-0.4, 0, 0.4, 0, 0, 0, 255, 30, true);
		addLine(0, -0.4, 0, 0.4, 0, 0, 255, 30, true);

		// Letter markers drawn as laser strokes
		const s = 0.06; // half-size of each letter
		const r = 255, gm = 255, bm = 255; // white

		// N (top center, at y = -border + offset)
		const ny = -border + s + 0.04;
		addLine(-s, ny + s, -s, ny - s, r, gm, bm, 8, true);  // left vertical
		addLine(-s, ny - s, s, ny + s, r, gm, bm, 8, true);    // diagonal
		addLine(s, ny + s, s, ny - s, r, gm, bm, 8, true);     // right vertical

		// S (bottom center, at y = border - offset)
		const sy = border - s - 0.04;
		addLine(s, sy - s, -s, sy - s, r, gm, bm, 8, true);    // top horizontal
		addLine(-s, sy - s, -s, sy, r, gm, bm, 6, true);       // left vertical
		addLine(-s, sy, s, sy, r, gm, bm, 8, true);             // middle horizontal
		addLine(s, sy, s, sy + s, r, gm, bm, 6, true);          // right vertical
		addLine(s, sy + s, -s, sy + s, r, gm, bm, 8, true);    // bottom horizontal

		// E (right center, at x = border - offset)
		const ex = border - s - 0.04;
		addLine(ex + s, -s, ex - s, -s, r, gm, bm, 8, true);   // top horizontal
		addLine(ex - s, -s, ex - s, s, r, gm, bm, 8, true);    // left vertical
		addLine(ex - s, 0, ex + s * 0.5, 0, r, gm, bm, 6, true); // middle horizontal
		addLine(ex - s, s, ex + s, s, r, gm, bm, 8, true);     // bottom horizontal

		// W (left center, at x = -border + offset)
		const wx = -border + s + 0.04;
		addLine(wx - s, -s, wx - s * 0.5, s, r, gm, bm, 8, true);  // left diagonal down
		addLine(wx - s * 0.5, s, wx, 0, r, gm, bm, 8, true);       // left diagonal up
		addLine(wx, 0, wx + s * 0.5, s, r, gm, bm, 8, true);       // right diagonal down
		addLine(wx + s * 0.5, s, wx + s, -s, r, gm, bm, 8, true);  // right diagonal up

		return points;
	}

	/**
	 * Display the test pattern for calibration
	 */
	async showTestPattern() {
		if (!this.isReady()) return;
		if (this.isSending) return;

		this.isSending = true;
		try {
			const status = await this.device.getStatus();
			if (status !== 1) {
				this.isSending = false;
				return;
			}
			const points = this.generateTestPattern();
			const result = this.convertTraceToLaserPoints(points, null, {
				velocityDimming: 0,
				basePower: 1.0
			});
			if (result.points.length === 0) {
				this.isSending = false;
				return;
			}
			const maxPoints = HELIOS.MAX_POINTS;
			const finalPoints = result.points.length > maxPoints
				? result.points.slice(0, maxPoints)
				: result.points;
			await this.device.sendFrame(finalPoints, this.settings.pps);
		} catch (error) {
			console.error('[LaserRenderer] Error sending test pattern:', error);
		} finally {
			this.isSending = false;
		}
	}

	/**
	 * Clear the laser output (send blank frame)
	 */
	async clear() {
		if (!this.device || this.device.closed) return;

		while (this.isSending) {
			await new Promise(resolve => setTimeout(resolve, 5));
		}

		try {
			let ready = false;
			for (let i = 0; i < 25 && !ready; i++) {
				const status = await this.device.getStatus();
				if (status === 1) {
					ready = true;
				} else {
					await new Promise(resolve => setTimeout(resolve, 20));
				}
			}

			const blankPoints = [];
			for (let i = 0; i < 100; i++) {
				blankPoints.push(HeliosPoint.blank(2048, 2048));
			}
			await this.device.sendFrame(blankPoints, this.settings.pps);
		} catch (error) {
			console.error('[LaserRenderer] Error clearing laser:', error);
		}
	}

	async destroy() {
		await this.disconnect();
	}
}

export default LaserRenderer;
