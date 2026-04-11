/**
 * SceneController
 *
 * Manages the active scene using a priority stack.
 * Priority levels (highest to lowest):
 *   1. Momentary (down/up triggers) - temporary, removed on release
 *   2. Toggle (on/off triggers) - persistent until toggled off
 *   3. Select (select buttons) - persistent until another select button pressed
 *   4. Default - always at the bottom
 *
 * Within each level, the most recently added entry wins.
 * When an entry is removed, the next entry at the same level takes over,
 * or falls to the next lower level.
 */

export class SceneController {
	// Reactive state for active scene ID
	activeSceneId = $state('default');

	// Priority stacks - arrays of { id, sceneId }, newest last
	_momentaryStack = [];
	_toggleStack = [];
	_selectSceneId = null;

	constructor(sceneLibrary) {
		this.sceneLibrary = sceneLibrary;
		this.onSceneChange = null;
	}

	/**
	 * Set callback for scene changes
	 * @param {Function} callback - Called with (sceneCssIdentifier) when scene changes
	 */
	setOnSceneChange(callback) {
		this.onSceneChange = callback;
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
	 * Push a momentary scene override (highest priority)
	 * @param {string} id - Unique identifier (input ID or trigger ID)
	 * @param {string} sceneId - Scene ID to activate
	 */
	pushMomentaryScene(id, sceneId) {
		// Remove existing entry for this id (prevent duplicates)
		this._momentaryStack = this._momentaryStack.filter(e => e.id !== id);
		this._momentaryStack.push({ id, sceneId });
		this._resolveActiveScene();
	}

	/**
	 * Remove a momentary scene override
	 * @param {string} id - Identifier used in pushMomentaryScene
	 */
	removeMomentaryScene(id) {
		this._momentaryStack = this._momentaryStack.filter(e => e.id !== id);
		this._resolveActiveScene();
	}

	/**
	 * Push a toggle scene override (medium priority)
	 * @param {string} id - Unique identifier (input ID or trigger ID)
	 * @param {string} sceneId - Scene ID to activate
	 */
	pushToggleScene(id, sceneId) {
		this._toggleStack = this._toggleStack.filter(e => e.id !== id);
		this._toggleStack.push({ id, sceneId });
		this._resolveActiveScene();
	}

	/**
	 * Remove a toggle scene override
	 * @param {string} id - Identifier used in pushToggleScene
	 */
	removeToggleScene(id) {
		this._toggleStack = this._toggleStack.filter(e => e.id !== id);
		this._resolveActiveScene();
	}

	/**
	 * Set the select-level scene (low priority, persistent)
	 * @param {string} sceneId - Scene ID to activate
	 */
	setSelectScene(sceneId) {
		this._selectSceneId = sceneId;
		this._resolveActiveScene();
	}

	/**
	 * Legacy method - sets scene directly (bypasses priority stack)
	 * Used for UI-initiated scene changes from the Scenes panel
	 * @param {string} sceneId - Scene ID to activate
	 * @returns {boolean} Success status
	 */
	setScene(sceneId) {
		const scene = this.sceneLibrary.get(sceneId);
		if (!scene) return false;

		// Clear all stacks and set as select-level
		this._momentaryStack = [];
		this._toggleStack = [];
		this._selectSceneId = sceneId;
		this._resolveActiveScene();
		return true;
	}

	/**
	 * Reset to default scene
	 */
	resetToDefault() {
		this._momentaryStack = [];
		this._toggleStack = [];
		this._selectSceneId = null;
		this._resolveActiveScene();
	}

	/**
	 * Resolve the active scene from the priority stack
	 * @private
	 */
	_resolveActiveScene() {
		let sceneId;

		if (this._momentaryStack.length > 0) {
			sceneId = this._momentaryStack[this._momentaryStack.length - 1].sceneId;
		} else if (this._toggleStack.length > 0) {
			sceneId = this._toggleStack[this._toggleStack.length - 1].sceneId;
		} else if (this._selectSceneId) {
			sceneId = this._selectSceneId;
		} else {
			sceneId = 'default';
		}

		if (sceneId !== this.activeSceneId) {
			this.activeSceneId = sceneId;
			this._notifySceneChange();
		}
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
	 * Handle scene deletion - clean up stacks
	 * @param {string} sceneId - Deleted scene ID
	 */
	handleSceneDeleted(sceneId) {
		this._momentaryStack = this._momentaryStack.filter(e => e.sceneId !== sceneId);
		this._toggleStack = this._toggleStack.filter(e => e.sceneId !== sceneId);
		if (this._selectSceneId === sceneId) {
			this._selectSceneId = null;
		}
		this._resolveActiveScene();
	}
}
