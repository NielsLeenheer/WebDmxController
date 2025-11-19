<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import { toCSSIdentifier } from '../../lib/css/utils.js';
	import { getPalette, paletteColorToHex } from '../../lib/inputs/colors.js';
	import removeIcon from '../../assets/icons/remove.svg?raw';

	/**
	 * EditInputDialog - Promise-based dialog for editing input mappings
	 *
	 * Usage:
	 *   const result = await editDialog.open(inputMapping);
	 *   if (result) {
	 *     if (result.delete) {
	 *       // Handle delete
	 *     } else {
	 *       // Update input with result.name, result.buttonMode, result.color
	 *     }
	 *   }
	 */

	let {
		inputController
	} = $props();

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Edit state
	let editingInput = $state(null);
	let editingName = $state('');
	let editingButtonMode = $state('momentary');
	let editingColor = $state(null);

	// Computed: whether this input supports colors
	let showColorPicker = $derived.by(() => {
		if (!editingInput) return false;
		const device = inputController?.getInputDevice(editingInput.inputDeviceId);
		return shouldAssignColor(device, editingInput.inputControlId);
	});

	/**
	 * Open the dialog with an input mapping
	 * @param {InputMapping} input - The input mapping to edit
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

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function deviceSupportsColors(device) {
		if (!device) return false;
		if (device.type === 'hid') {
			return device.id !== 'keyboard';
		}
		// MIDI and Bluetooth (Thingy:52) support colors
		return device.type === 'midi' || device.type === 'bluetooth';
	}

	function isColorCapableControl(controlId) {
		if (!controlId || typeof controlId !== 'string') return false;
		// Thingy:52 button uses 'button' (not 'button-'), so check exact match too
		if (controlId === 'button') return true;
		const COLOR_CAPABLE_PREFIXES = ['button-', 'note-'];
		return COLOR_CAPABLE_PREFIXES.some(prefix => controlId.startsWith(prefix));
	}

	function shouldAssignColor(device, controlId) {
		return deviceSupportsColors(device) && isColorCapableControl(controlId);
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

	function confirmDelete() {
		if (!editingInput) return;

		if (confirm(`Are you sure you want to delete "${editingInput.name}"?`)) {
			// Return special delete signal
			resolvePromise({ delete: true });
			closeDialog();
		}
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
		<div class="dialog-input-group">
			<label for="input-name">Name:</label>
			<input
				id="input-name"
				type="text"
				bind:value={editingName}
				placeholder="Input name"
				onkeydown={(e) => {
					if (e.key === 'Enter') handleSave();
					if (e.key === 'Escape') handleCancel();
				}}
				autofocus
			/>
			<div class="css-identifiers">
				{#if editingInput.isButtonInput()}
					{#if editingButtonMode === 'toggle'}
						<code class="css-identifier">.{toCSSIdentifier(editingName)}-on</code>
						<code class="css-identifier">.{toCSSIdentifier(editingName)}-off</code>
					{:else}
						<code class="css-identifier">.{toCSSIdentifier(editingName)}-down</code>
						<code class="css-identifier">.{toCSSIdentifier(editingName)}-up</code>
					{/if}
				{:else}
					<code class="css-identifier">--{toCSSIdentifier(editingName)}</code>
				{/if}
			</div>
		</div>

		{#if editingInput.isButtonInput()}
			<div class="dialog-input-group">
				<label for="button-mode">Button Mode:</label>
				<select id="button-mode" bind:value={editingButtonMode}>
					<option value="momentary">Down/Up</option>
					<option value="toggle">On/Off</option>
				</select>
			</div>
		{/if}

		{#if showColorPicker}
			<div class="dialog-input-group">
				<label for="input-color">Color:</label>
				<select id="input-color" bind:value={editingColor}>
					{#each getPalette() as color}
						<option value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
					{/each}
				</select>
				<div class="color-preview-wrapper">
					<div
						class="color-preview-large"
						style="background-color: {paletteColorToHex(editingColor)}"
					></div>
				</div>
			</div>
		{/if}
	</form>

	{#snippet tools()}
		<Button onclick={confirmDelete} variant="secondary">
			{@html removeIcon}
			Delete
		</Button>
	{/snippet}

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-input-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

<style>
	.color-preview-wrapper {
		margin-top: 8px;
	}

	.color-preview-large {
		width: 64px;
		height: 32px;
		border-radius: 4px;
		box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
