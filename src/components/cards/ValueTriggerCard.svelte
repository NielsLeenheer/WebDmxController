<script>
	import { deviceLibrary, inputLibrary } from '../../stores.svelte.js';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import IconButton from '../common/IconButton.svelte';
	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		trigger,          // Value trigger plain object
		dnd,              // Drag-and-drop helper
		onEdit            // Callback when edit button clicked
	} = $props();

	let device = $derived(deviceLibrary.get(trigger.deviceId));
	let input = $derived(trigger.inputId ? inputLibrary.get(trigger.inputId) : null);

	// Get the input value label
	let inputValueLabel = $derived.by(() => {
		if (!input) return 'Value';
		const exportedValues = getInputExportedValues(input);
		const value = exportedValues.find(v => v.key === trigger.inputValueKey);
		return value?.label || 'Value';
	});

	// Get control label with channel if applicable
	let controlLabel = $derived.by(() => {
		if (!device || !trigger.controlName) return 'Unknown';
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return trigger.controlName;

		const controlDef = deviceType.controls.find(c => c.name === trigger.controlName);
		if (!controlDef) return trigger.controlName;

		if (trigger.controlChannel) {
			const values = controlDef.type.getValueMetadata().values;
			const value = values.find(v => v.id === trigger.controlChannel);
			if (value) {
				return `${trigger.controlName} → ${value.label}`;
			}
		}
		return trigger.controlName;
	});
</script>

<DraggableCard {dnd} item={trigger} class="value-trigger-card">
	<!-- Column 1: Input -->
	<div class="trigger-column trigger-input-column">
		<Preview
			type="input"
			size="medium"
			data={input}
			class="trigger-preview"
		/>
		<div class="trigger-text">
			{input?.name || 'Unknown Input'}
		</div>
		<div class="trigger-subtext">
			{inputValueLabel}
		</div>
	</div>

	<!-- Arrow with invert indicator -->
	<div class="trigger-arrow">
		{#if trigger.invert}
			<span class="arrow inverted" title="Inverted">⇄</span>
		{:else}
			<span class="arrow">→</span>
		{/if}
	</div>

	<!-- Column 2: Device + Control -->
	<div class="trigger-column trigger-device-column">
		{#if device}
			<Preview
				type="device"
				size="medium"
				data={device}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{device.name || device.cssId}
			</div>
			<div class="trigger-subtext">
				{controlLabel}
			</div>
		{/if}
	</div>

	<IconButton
		icon={editIcon}
		onclick={() => onEdit?.(trigger)}
		title="Edit value trigger"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.value-trigger-card) {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 15px;
		width: 100%;
		max-width: 600px;
		padding: 15px 20px;
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 1px solid #dee2e6;
	}

	.trigger-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.trigger-input-column {
		flex: 1.2;
	}

	.trigger-device-column {
		flex: 1.2;
	}

	.trigger-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 10px;
	}

	.arrow {
		font-size: 20px;
		color: #6c757d;
	}

	.arrow.inverted {
		color: #dc3545;
	}

	.trigger-text {
		font-size: 10pt;
		color: #333;
		text-align: center;
		word-wrap: break-word;
		width: 100%;
		font-weight: 500;
	}

	.trigger-subtext {
		font-size: 9pt;
		color: #888;
		text-align: center;
		word-wrap: break-word;
		width: 100%;
	}

	:global(.value-trigger-card .trigger-preview) {
		flex-shrink: 0;
	}
</style>
