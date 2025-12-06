<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Group from '../common/form/Group.svelte';
	import InputText from '../common/form/InputText.svelte';
	import SelectField from '../common/form/SelectField.svelte';
	import SelectColorField from '../common/form/SelectColorField.svelte';
	import IdentifierPreview from '../common/IdentifierPreview.svelte';
	import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
	import { toUniqueCSSIdentifier } from '../../lib/css/utils.js';

	/**
	 * EditInputDialog - Promise-based dialog for editing inputs
	 *
	 * Usage:
	 *   const result = await editDialog.open(input);
	 *   if (result) {
	 *     if (result.delete) {
	 *       // Handle delete
	 *     } else {
	 *       // Update input with result.name, result.buttonMode, result.color
	 *     }
	 *   }
	 */

	let {
		inputLibrary
	} = $props();

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Edit state
	let editingInput = $state(null);
	let editingName = $state('');
	let editingButtonMode = $state('momentary');
	let editingColor = $state(null);
	let showColorPicker = $state(false);

	/**
	 * Open the dialog with an input
	 * @param {Input} input - The input to edit
	 * @returns {Promise<{name: string, buttonMode: string, color: string}|{delete: true}|null>}
	 */
	export function open(input) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Copy input data to edit state
			editingInput = input;
			editingName = input.name;
			editingButtonMode = input.buttonMode || 'momentary';
			editingColor = input.color;

			// Only show color picker for RGB color support
			// Single-color buttons (red, green) don't need a picker
			showColorPicker = input.colorSupport === 'rgb';

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!editingInput || !editingName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		// Return modified data
		const result = {
			name: editingName.trim(),
			buttonMode: editingButtonMode,
			color: editingColor
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
		editingInput = null;
		editingName = '';
		editingColor = null;
	}
</script>

{#if editingInput}
<Dialog
	bind:dialogRef={dialogRef}
	title="Input"
	onclose={handleCancel}
>
	<form id="edit-input-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<Group label="Name:" for="input-name">
			<InputText
				id="input-name"
				bind:value={editingName}
				placeholder="Input name"
				onkeydown={(e) => {
					if (e.key === 'Enter') handleSave();
					if (e.key === 'Escape') handleCancel();
				}}
				autofocus
			/>
			{#if editingInput}
				{@const uniqueId = toUniqueCSSIdentifier(
					editingName,
					new Set(inputLibrary.getAll().filter(i => i.id !== editingInput.id).map(i => i.cssIdentifier))
				)}
				<IdentifierPreview
					identifiers={isButton(editingInput)
						? editingButtonMode === 'toggle'
							? [`.${uniqueId}-on`, `.${uniqueId}-off`]
							: [`.${uniqueId}-down`, `.${uniqueId}-up`]
						: [`--${uniqueId}`]
					}
				/>
			{/if}
		</Group>

		{#if isButton(editingInput)}
			<Group label="Button Mode:" for="button-mode">
				<SelectField id="button-mode" bind:value={editingButtonMode}>
					<option value="momentary">Down/Up</option>
					<option value="toggle">On/Off</option>
				</SelectField>
			</Group>
		{/if}

		{#if showColorPicker}
			<Group label="Color:" for="input-color">
				<SelectColorField id="input-color" bind:value={editingColor} />
			</Group>
		{/if}
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-input-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
</style>
