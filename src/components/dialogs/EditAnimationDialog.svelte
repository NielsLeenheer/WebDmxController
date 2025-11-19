<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { toCSSIdentifier } from '../../lib/css/utils.js';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditAnimationDialog - Promise-based dialog for editing animations
	 *
	 * Usage:
	 *   const result = await editAnimationDialog.open(animation);
	 *   if (result) {
	 *     if (result.delete) {
	 *       // Handle delete
	 *     } else {
	 *       // Update animation with result.name
	 *     }
	 *   }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Edit state
	let editingAnimation = $state(null);
	let editingName = $state('');

	/**
	 * Open the dialog with an animation
	 * @param {Animation} animation - The animation to edit
	 * @returns {Promise<{name: string}|{delete: true}|null>}
	 */
	export function open(animation) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Copy animation data to edit state
			editingAnimation = animation;
			editingName = animation.name;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!editingAnimation || !editingName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return modified data
		const result = {
			name: editingName.trim()
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function confirmDelete() {
		if (!editingAnimation) return;

		if (confirm(`Are you sure you want to delete "${editingAnimation.name}"?`)) {
			// Return special delete signal
			resolvePromise({ delete: true });
			closeDialog();
		}
	}

	function closeDialog() {
		dialogRef?.close();
		editingAnimation = null;
		editingName = '';
	}
</script>

{#if editingAnimation}
<Dialog
	bind:dialogRef={dialogRef}
	title="Animation"
	onclose={handleCancel}
>
	<form id="edit-animation-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<div class="dialog-input-group">
			<label for="edit-animation-name">Name:</label>
			<input
				id="edit-animation-name"
				type="text"
				bind:value={editingName}
				placeholder="Animation name"
				autofocus
			/>
			<div class="css-identifiers">
				<code class="css-identifier">@keyframes {toCSSIdentifier(editingName)} &lbrace; &rbrace;</code>
			</div>
		</div>
	</form>

	{#snippet tools()}
		<Button onclick={confirmDelete} variant="secondary">
			{@html removeIcon}
			Delete
		</Button>
	{/snippet}

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-animation-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}
