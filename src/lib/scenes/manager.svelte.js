/**
 * SceneController
 *
 * Manages the active scene and notifies listeners when it changes.
 * Uses Svelte 5 reactive state for the active scene ID.
 * Works with TriggerManager to respond to scene change triggers.
 */

export class SceneController {
	// Reactive state for active scene ID
	activeSceneId = $state('default');

	constructor(sceneLibrary) {
		this.sceneLibrary = sceneLibrary;
		this.onSceneChange = null; // Callback for scene changes
	}

	/**
	 * Set callback for scene changes
	 * @param {Function} callback - Called with (sceneCssIdentifier) when scene changes
	 */
	setOnSceneChange(callback) {
		this.onSceneChange = callback;
		// Immediately notify with current scene
		this._notifySceneChange();
	}

	/**
	 * Get the currently active scene ID
	 * @returns {string} Active scene ID
	 */
	getActiveSceneId() {
		return this.activeSceneId;
	}

	/**
	 * Get the currently active scene object
	 * @returns {Object|null} Active scene or null
	 */
	getActiveScene() {
		return this.sceneLibrary.get(this.activeSceneId);
	}

	/**
	 * Change to a different scene
	 * @param {string} sceneId - Scene ID to activate
	 * @returns {boolean} Success status
	 */
	setScene(sceneId) {
		const scene = this.sceneLibrary.get(sceneId);
		if (!scene) return false;

		this.activeSceneId = sceneId;
		this._notifySceneChange();
		return true;
	}

	/**
	 * Reset to default scene
	 */
	resetToDefault() {
		this.activeSceneId = 'default';
		this._notifySceneChange();
	}

	/**
	 * Notify listener of scene change
	 * @private
	 */
	_notifySceneChange() {
		if (!this.onSceneChange) return;

		const scene = this.sceneLibrary.get(this.activeSceneId);
		const cssIdentifier = scene?.cssIdentifier || 'default';
		this.onSceneChange(cssIdentifier);
	}

	/**
	 * Handle scene deletion - reset to default if deleted scene was active
	 * @param {string} sceneId - Deleted scene ID
	 */
	handleSceneDeleted(sceneId) {
		if (this.activeSceneId === sceneId) {
			this.resetToDefault();
		}
	}
}
