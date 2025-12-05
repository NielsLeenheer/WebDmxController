<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { toUniqueCSSIdentifier } from '../../lib/css/utils.js';

	/**
	 * EditSceneDialog - Promise-based dialog for editing scene properties
	 *
	 * Usage:
	 *   const result = await editSceneDialog.open(scene);
	 *   if (result) {
	 *     // Update scene with result.name
	 *   }
	 */

	let {
		sceneLibrary
	} = $props();

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Edit state
	let editingScene = $state(null);
	let sceneName = $state('');

	/**
	 * Open the dialog with a scene
	 * @param {Object} scene - The scene to edit
	 * @returns {Promise<{name: string}|null>}
	 */
	export function open(scene) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Copy scene data to edit state
			editingScene = scene;
			sceneName = scene.name;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!editingScene || !sceneName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		const result = {
			name: sceneName.trim()
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
		editingScene = null;
		sceneName = '';
	}

	// Check if this is the default scene (cannot rename)
	let isDefault = $derived(sceneLibrary.isDefault(editingScene?.id));
</script>

{#if editingScene}
<Dialog
	bind:dialogRef={dialogRef}
	title="Edit Scene"
	onclose={handleCancel}
>
	<form id="edit-scene-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="dialog-input-group">
			<label for="scene-name">Scene Name:</label>
			<input
				id="scene-name"
				type="text"
				bind:value={sceneName}
				placeholder="Scene name"
				disabled={isDefault}
				autofocus
			/>
			{#if isDefault}
				<small class="help-text">The default scene cannot be renamed</small>
			{:else}
				<div class="css-identifiers">
					<code class="css-identifier">[scene="{toUniqueCSSIdentifier(
						sceneName,
						new Set(sceneLibrary.getAll().filter(s => s.id !== editingScene?.id).map(s => s.cssIdentifier))
					)}"]</code>
				</div>
			{/if}
		</div>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-scene-form" variant="primary" disabled={isDefault}>Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
	.help-text {
		display: block;
		margin-top: 4px;
		color: #666;
		font-size: 9pt;
	}
</style>
