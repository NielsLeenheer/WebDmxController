<script>
	import Dialog from '../common/Dialog.svelte';
	import DialogColumns from '../common/DialogColumns.svelte';
	import DialogColumnPanel from '../common/DialogColumnPanel.svelte';
	import Group from '../common/form/Group.svelte';
	import InputCheckbox from '../common/form/InputCheckbox.svelte';
	import SelectField from '../common/form/SelectField.svelte';
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
				<Group label="Input:" for="edit-value-trigger-input">
					<SelectField id="edit-value-trigger-input" bind:value={selectedInputId}>
						{#each availableInputs as input}
							<option value={input.id}>{input.name}</option>
						{/each}
					</SelectField>
				</Group>

				{#if exportedValues.length > 0}
					<Group label="Value:" for="edit-value-trigger-value">
						<SelectField id="edit-value-trigger-value" bind:value={selectedValueKey}>
							{#each exportedValues as value}
								<option value={value.key}>{value.label}</option>
							{/each}
						</SelectField>
					</Group>
				{/if}
			{/snippet}

			{#snippet column2()}
				<!-- Column 2: Device Configuration -->
				<Group label="Device:" for="edit-value-trigger-device">
					<SelectField id="edit-value-trigger-device" bind:value={selectedDeviceId}>
						{#each devices as device}
							<option value={device.id}>{device.name || device.cssIdentifier}</option>
						{/each}
					</SelectField>
				</Group>

				{#if controls.length > 0}
					<Group label="Control:" for="edit-value-trigger-control">
						<SelectField id="edit-value-trigger-control" bind:value={selectedControlId}>
							{#each controls as control}
								<option value={control.id}>{control.type.name}</option>
							{/each}
						</SelectField>
					</Group>
				{/if}

				{#if needsValueSelection}
					<Group label="Component:" for="edit-value-trigger-value-id">
						<SelectField id="edit-value-trigger-value-id" bind:value={selectedValueId}>
							{#each controlValues as value}
								<option value={value.id}>{value.label}</option>
							{/each}
						</SelectField>
					</Group>
				{/if}
			{/snippet}

			{#snippet column3()}
				<!-- Column 3: Options -->
				<DialogColumnPanel>
					<InputCheckbox
						bind:checked={invert}
						label="Invert mapping"
						description="Reverse the input-to-output direction"
					/>
				</DialogColumnPanel>
			{/snippet}
		</DialogColumns>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleSave} variant="primary">Save</Button>
	{/snippet}
</Dialog>
