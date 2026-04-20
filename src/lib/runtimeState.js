/**
 * Runtime State Persistence
 *
 * Small localStorage-backed store for live runtime state that should survive
 * a browser reload — toggle button on/off, select-group active button,
 * and the scene controller's persistent stacks.
 *
 * This is distinct from project data (devices, animations, inputs, …) which
 * each have their own dedicated library/localStorage key.
 */

const KEY = 'dmx-runtime-state';

export function loadRuntimeState() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return {};
		return JSON.parse(raw);
	} catch (err) {
		console.warn('Failed to load runtime state:', err);
		return {};
	}
}

export function saveRuntimeState(patch) {
	try {
		const current = loadRuntimeState();
		const merged = { ...current, ...patch };
		localStorage.setItem(KEY, JSON.stringify(merged));
	} catch (err) {
		console.warn('Failed to save runtime state:', err);
	}
}

export function clearRuntimeState() {
	try {
		localStorage.removeItem(KEY);
	} catch (err) {
		console.warn('Failed to clear runtime state:', err);
	}
}
