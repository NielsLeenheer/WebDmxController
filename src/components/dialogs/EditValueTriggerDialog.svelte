<script>
	import Dialog from '../common/Dialog.svelte';
	import DialogColumns from '../common/DialogColumns.svelte';
	import DialogColumnPanel from '../common/DialogColumnPanel.svelte';
	import InputGroup from '../common/InputGroup.svelte';
	import SelectField from '../common/SelectField.svelte';
	import Button from '../common/Button.svelte';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';

	/**
	 * EditValueTriggerDialog - Promise-based dialog for editing value-based triggers
	 *
	 * Usage:
	 *   const result = await editValueTriggerDialog.open(trigger, availableInputs, devices);
	 *   if (result.action === 'save') { ... }
	 *   if (result.action === 'delete') { ... }
	 */

	// Dialog state
	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	// Data props
	let trigger = $state(null);
	let availableInputs = $state([]);
	let devices = $state([]);

	// Form state
	let selectedInputId = $state(null);
	let selectedValueKey = $state('value');
	let selectedDeviceId = $state(null);
	let selectedControlId = $state(null);
	let selectedValueId = $state(null);
	let invert = $state(false);

	// Derived values
	let selectedInput = $derived(availableInputs.find(i => i.id === selectedInputId));
	let exportedValues = $derived(selectedInput ? getInputExportedValues(selectedInput) : []);
	let selectedDevice = $derived(devices.find(d => d.id === selectedDeviceId));
	let deviceType = $derived(selectedDevice ? DEVICE_TYPES[selectedDevice.type] : null);
	let controls = $derived(deviceType ? deviceType.controls : []);

	// Get control values for selected control
	let selectedControlDef = $derived(controls.find(c => c.id === selectedControlId));
	let controlValues = $derived(selectedControlDef ? selectedControlDef.type.getValueMetadata().values : []);
	let needsValueSelection = $derived(controlValues.length > 1);

	/**
	 * Open the dialog
	 * @param {Object} trig - Existing trigger to edit
	 * @param {Array} inputs - Available inputs
	 * @param {Array} devs - Available devices
	 * @returns {Promise<{action: 'save'|'delete'|'cancel', data: Object}>}
	 */
	export function open(trig, inputs, devs) {
		return new Promise((resolve) => {
			resolvePromise = resolve;

			// Store data
			trigger = trig;
			availableInputs = inputs;
			devices = devs;

			// Initialize form state from existing trigger
			selectedInputId = trig.input?.id;
			selectedValueKey = trig.input?.value || 'value';
			selectedDeviceId = trig.output?.id;
			selectedControlId = trig.action?.copy?.control;
			selectedValueId = trig.action?.copy?.component;
			invert = trig.action?.copy?.invert || false;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!selectedInputId || !selectedDeviceId || !selectedControlId) {
			resolvePromise({ action: 'cancel' });
			closeDialog();
			return;
		}

		// Return updated trigger configuration
		const result = {
			action: 'save',
			data: {
				inputId: selectedInputId,
				inputValueKey: selectedValueKey,
				deviceId: selectedDeviceId,
				controlId: selectedControlId,
				controlValueId: needsValueSelection ? selectedValueId : null,
				invert
			}
		};

		resolvePromise(result);
		closeDialog();
	}

	function handleCancel() {
		resolvePromise({ action: 'cancel' });
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
	}

	// Get description of the selected input value
	function getInputValueDescription() {
		const value = exportedValues.find(v => v.key === selectedValueKey);
		return value?.description || '';
	}

	// Get description of the selected control
	function getControlDescription() {
		if (!selectedControlDef) return '';
		const meta = selectedControlDef.type.getValueMetadata(
			selectedControlId,
			needsValueSelection ? selectedValueId : null
		);
		return meta?.description || '';
	}
</script>

<Dialog bind:dialogRef={dialogRef} title="Edit Value Trigger" onclose={handleCancel}>
	<form id="edit-value-trigger-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<DialogColumns layout={['180px', 'line', '180px', '350px']}>
			{#snippet column1()}
				<!-- Column 1: Input Configuration -->
				<InputGroup label="Input:" for="edit-value-trigger-input">
					<SelectField id="edit-value-trigger-input" bind:value={selectedInputId}>
						{#each availableInputs as input}
							<option value={input.id}>{input.name}</option>
						{/each}
					</SelectField>
				</InputGroup>

				{#if exportedValues.length > 0}
					<InputGroup label="Value:" for="edit-value-trigger-value">
						<SelectField id="edit-value-trigger-value" bind:value={selectedValueKey}>
							{#each exportedValues as value}
								<option value={value.key}>{value.label}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}
			{/snippet}

			{#snippet column2()}
				<!-- Column 2: Device Configuration -->
				<InputGroup label="Device:" for="edit-value-trigger-device">
					<SelectField id="edit-value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssIdentifier}</option>
						{/each}
					</SelectField>
				</InputGroup>

				{#if controls.length > 0}
					<InputGroup label="Control:" for="edit-value-trigger-control">
						<SelectField id="edit-value-trigger-control" bind:value={selectedControlId}>
							{#each controls as control}
								<option value={control.id}>{control.type.name}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}

				{#if needsValueSelection}
					<InputGroup label="Component:" for="edit-value-trigger-value-id">
						<SelectField id="edit-value-trigger-value-id" bind:value={selectedValueId}>
							{#each controlValues as value}
								<option value={value.id}>{value.label}</option>
							{/each}
						</SelectField>
					</InputGroup>
				{/if}
			{/snippet}

			{#snippet column3()}
				<!-- Column 3: Options -->
				<DialogColumnPanel>
					<div class="checkbox-field">
						<label>
							<input
								type="checkbox"
								bind:checked={invert}
							/>
							Invert mapping
						</label>
						<p class="description">Reverse the input-to-output direction</p>
					</div>
				</DialogColumnPanel>
			{/snippet}
		</DialogColumns>
	</form>

	{#snippet buttons()}
		<Button type="button" onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button type="submit" form="edit-value-trigger-form" variant="primary">Save</Button>
	{/snippet}
</Dialog>

<style>
	.description {
		font-size: 9pt;
		color: #888;
		margin: 0;
		padding: 0;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 10pt;
		cursor: pointer;
	}

	.checkbox-field .description {
		margin-top: 4px;
		margin-left: 24px;
	}
</style>
