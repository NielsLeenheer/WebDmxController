/**
 * SVG Script Runner
 *
 * Executes <script> tags within SVG elements in a sandboxed scope.
 * Scripts share a single Function() scope so they can share variables.
 *
 * The function receives shadowed globals:
 *   document  – a Proxy that scopes query methods (querySelector, getElementById,
 *               etc.) to the SVG element while forwarding everything else to the real document.
 *   svg       – the SVG element directly, as a convenience.
 *   setInterval / setTimeout / requestAnimationFrame – wrapped versions that
 *               track timer IDs for cleanup.
 *
 * After the script body executes, the SVG element's `onload` attribute (if any)
 * is evaluated in the same scope so it can call functions defined by the scripts.
 *
 * CDATA wrappers are stripped automatically.
 */

// Per-SVG tracking: Map<svgElement, { timers, lastContent }>
const scriptStates = new Map();

/**
 * Clean up timers created by a specific SVG's scripts
 */
function cleanupTimers(svgElement) {
	const state = scriptStates.get(svgElement);
	if (!state) return;

	for (const { type, id } of state.timers) {
		if (type === 'interval') clearInterval(id);
		else if (type === 'timeout') clearTimeout(id);
		else if (type === 'raf') cancelAnimationFrame(id);
	}

	state.timers = [];
}

/**
 * Execute <script> tags within an SVG element.
 *
 * Re-execution is skipped when the concatenated script content hasn't
 * changed, unless `force` is true.
 *
 * @param {SVGElement} svgElement - The SVG element containing scripts
 * @param {boolean} force - Force re-execution even if content unchanged
 */
export function executeScripts(svgElement, force = false) {
	const scripts = svgElement.querySelectorAll('script');
	if (scripts.length === 0) return;

	// Concatenate all scripts, stripping CDATA wrappers
	const rawContent = Array.from(scripts)
		.map(s => s.textContent.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, ''))
		.join('\n');

	let state = scriptStates.get(svgElement);

	if (!force && state && rawContent === state.lastContent) {
		return;
	}

	// Clean up previous timers
	cleanupTimers(svgElement);

	// Initialize or update state
	if (!state) {
		state = { timers: [], lastContent: null };
		scriptStates.set(svgElement, state);
	}
	state.lastContent = rawContent;

	// Append onload handler so it runs in the same scope as the scripts
	let code = rawContent;
	const onload = svgElement.getAttribute('onload');
	if (onload) {
		code += `\n;${onload};`;
	}

	// Proxy scopes DOM queries to the SVG element while forwarding
	// everything else (addEventListener, createElementNS, …) to the real document.
	const scopedDocument = new Proxy(document, {
		get(target, prop) {
			switch (prop) {
				case 'querySelector':
					return (sel) => svgElement.querySelector(sel);
				case 'querySelectorAll':
					return (sel) => svgElement.querySelectorAll(sel);
				case 'getElementById':
					return (id) => svgElement.querySelector(`#${CSS.escape(id)}`);
				case 'getElementsByTagName':
					return (tag) => svgElement.getElementsByTagName(tag);
				case 'getElementsByClassName':
					return (cls) => svgElement.getElementsByClassName(cls);
				case 'documentElement':
				case 'rootElement':
					return svgElement;
			}
			const val = target[prop];
			return typeof val === 'function' ? val.bind(target) : val;
		}
	});

	const timers = state.timers;

	try {
		const fn = new Function(
			'document',
			'svg',
			'setInterval',
			'setTimeout',
			'requestAnimationFrame',
			code
		);

		fn(
			scopedDocument,
			svgElement,
			(...args) => {
				const id = setInterval(...args);
				timers.push({ type: 'interval', id });
				return id;
			},
			(...args) => {
				const id = setTimeout(...args);
				timers.push({ type: 'timeout', id });
				return id;
			},
			(...args) => {
				const id = requestAnimationFrame(...args);
				timers.push({ type: 'raf', id });
				return id;
			}
		);
	} catch (error) {
		console.error('Error executing SVG script:', error);
	}
}

/**
 * Check if an SVG element has scripts
 * @param {SVGElement} svgElement
 * @returns {boolean}
 */
export function hasScripts(svgElement) {
	return svgElement.querySelectorAll('script').length > 0;
}

/**
 * Clean up script state for an SVG element
 * @param {SVGElement} svgElement
 */
export function cleanupScripts(svgElement) {
	cleanupTimers(svgElement);
	scriptStates.delete(svgElement);
}

/**
 * Clean up all tracked script states
 */
export function cleanupAllScripts() {
	for (const svgElement of scriptStates.keys()) {
		cleanupTimers(svgElement);
	}
	scriptStates.clear();
}
