<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Group from '../common/form/Group.svelte';
	import InputText from '../common/form/InputText.svelte';
	import SelectField from '../common/form/SelectField.svelte';
	import SelectColorField from '../common/form/SelectColorField.svelte';
	import IdentifierPreview from '../common/IdentifierPreview.svelte';
	import NewGroupDialog from './NewGroupDialog.svelte';
	import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
	import { toUniqueCSSIdentifier, toCSSIdentifier } from '../../lib/css/utils.js';
	import { sceneLibrary } from '../../stores.svelte.js';

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
	let editingSelectGroup = $state(null);
	let newGroupDialog = $state(null);
	let editingColor = $state(null);
	let editingDrawButton = $state(null);
	let editingClearButton = $state(null);
	let showColorPicker = $state(false);

	// Get scenes for the group dropdown
	let scenes = $derived(sceneLibrary.getAll());

	// Compute existing select groups from all inputs (excluding scene: groups)
	let existingGroups = $derived.by(() => {
		if (!editingInput) return [];
		const groups = new Set();
		for (const input of inputLibrary.getAll()) {
			if (input.buttonMode === 'select' && input.selectGroup && !input.selectGroup.startsWith('scene:')) {
				groups.add(input.selectGroup);
			}
		}
		return [...groups].sort();
	});

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
			editingSelectGroup = input.selectGroup || `scene:${sceneLibrary.getAll()[0]?.id || 'default'}`;
			editingColor = input.color;
			editingDrawButton = input.drawButton || null;
			editingClearButton = input.clearButton || null;

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

		// Determine the select group value
		let selectGroup = null;
		if (editingButtonMode === 'select') {
			selectGroup = editingSelectGroup;
		}

		// Return modified data
		const result = {
			name: editingName.trim(),
			buttonMode: editingButtonMode,
			selectGroup,
			color: editingColor,
			drawButton: editingDrawButton,
			clearButton: editingClearButton
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
		editingSelectGroup = null;
		editingColor = null;
		editingDrawButton = null;
		editingClearButton = null;
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
							: editingButtonMode === 'select'
								? editingSelectGroup?.startsWith('scene:')
									? (() => { const sceneId = editingSelectGroup.substring(6); const scene = sceneLibrary.get(sceneId); return [`[scene="${scene?.cssIdentifier || ''}"]`]; })()
									: [`[group-${toCSSIdentifier(editingSelectGroup || '')}="${uniqueId}"]`]
								: editingButtonMode === 'beat'
									? editingInput?.type === 'audio'
										? [`.${uniqueId}-bass`, `.${uniqueId}-mid`, `.${uniqueId}-high`]
										: [`.${uniqueId}-beat`]
									: [`.${uniqueId}-down`, `.${uniqueId}-up`]
						: [`--${uniqueId}`]
					}
				/>
			{/if}
		</Group>

		{#if isButton(editingInput) && editingInput?.type !== 'heartrate' && editingInput?.type !== 'audio'}
			<div class="button-mode-row">
				<Group label="Button Mode:" for="button-mode">
					<SelectField id="button-mode" bind:value={editingButtonMode}>
						<option value="momentary">Down/Up</option>
						<option value="toggle">On/Off</option>
						<option value="select">Select</option>
					</SelectField>
				</Group>

				{#if editingButtonMode === 'select'}
					{@const isCustomGroup = editingSelectGroup && !editingSelectGroup.startsWith('scene:') && editingSelectGroup !== '__new__' && !existingGroups.includes(editingSelectGroup)}
					<Group label="Group:" for="select-group">
						<SelectField id="select-group" bind:value={editingSelectGroup} onchange={async (e) => {
							if (editingSelectGroup === '__new__') {
								const previousValue = e.target.dataset.previous || `scene:${scenes[0]?.id || 'default'}`;
								editingSelectGroup = previousValue;

								const name = await newGroupDialog.open();
								if (name) {
									editingSelectGroup = name;
								}
							}
							e.target.dataset.previous = editingSelectGroup;
						}}>
							{#each scenes as scene}
								<option value="scene:{scene.id}">Scene → {scene.name}</option>
							{/each}
							{#if existingGroups.length > 0 || isCustomGroup}
								<hr>
								{#if isCustomGroup}
									<option value={editingSelectGroup}>{editingSelectGroup}</option>
								{/if}
								{#each existingGroups as group}
									<option value={group}>{group}</option>
								{/each}
							{/if}
							<hr>
							<option value="__new__">New group...</option>
						</SelectField>
					</Group>
				{/if}
			</div>
		{/if}

		{#if editingInput?.type === 'joycon'}
			<Group label="Draw Button:" for="draw-button">
				<SelectField id="draw-button" bind:value={editingDrawButton}>
					<option value="zr">ZR</option>
					<option value="zl">ZL</option>
					<option value="r">R</option>
					<option value="l">L</option>
					<option value="a">A</option>
					<option value="b">B</option>
					<option value="x">X</option>
					<option value="y">Y</option>
					<option value="sl">SL</option>
					<option value="sr">SR</option>
					<option value="plus">+</option>
					<option value="minus">−</option>
					<option value="stickButton">Stick Press</option>
				</SelectField>
			</Group>
			<Group label="Clear Button:" for="clear-button">
				<SelectField id="clear-button" bind:value={editingClearButton}>
					<option value="r">R</option>
					<option value="l">L</option>
					<option value="zr">ZR</option>
					<option value="zl">ZL</option>
					<option value="a">A</option>
					<option value="b">B</option>
					<option value="x">X</option>
					<option value="y">Y</option>
					<option value="sl">SL</option>
					<option value="sr">SR</option>
					<option value="plus">+</option>
					<option value="minus">−</option>
					<option value="stickButton">Stick Press</option>
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
		<Button onclick={handleSave} variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}

<NewGroupDialog bind:this={newGroupDialog} />

<style>
	.button-mode-row {
		display: flex;
		gap: 16px;
	}
</style>
