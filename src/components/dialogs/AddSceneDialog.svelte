<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Group from '../common/form/Group.svelte';
	import InputText from '../common/form/InputText.svelte';
	import IdentifierPreview from '../common/IdentifierPreview.svelte';
	import { toUniqueCSSIdentifier } from '../../lib/css/utils.js';

	/**
	 * AddSceneDialog - Promise-based dialog for creating new scenes
	 *
	 * Usage:
	 *   const result = await addSceneDialog.open();
	 *   if (result) {
	 *     // Create scene with result.name
	 *   }
	 */

	let {
		sceneLibrary
	} = $props();

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Form state
	let sceneName = $state('');

	/**
	 * Open the dialog
	 * @returns {Promise<{name: string}|null>}
	 */
	export function open() {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Reset form
			sceneName = '';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleCreate() {
		if (!sceneName.trim()) {
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
		sceneName = '';
	}
</script>

<Dialog
	bind:dialogRef={dialogRef}
	title="Create New Scene"
	onclose={handleCancel}
>
	<form id="new-scene-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
		<Group label="Scene Name:" for="scene-name">
			<InputText
				id="scene-name"
				bind:value={sceneName}
				placeholder="e.g., Warm, Party, Chill"
				autofocus
			/>
			<IdentifierPreview
				identifiers={[`[scene="${toUniqueCSSIdentifier(
					sceneName,
					new Set(sceneLibrary.getAll().map(s => s.cssIdentifier))
				)}"]`]}
			/>
		</Group>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleCreate} variant="primary">Create</Button>
	{/snippet}
</Dialog>
