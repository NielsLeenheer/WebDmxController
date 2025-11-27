<script>
	import { deviceLibrary, animationLibrary, inputLibrary } from '../../stores.svelte.js';
	import { getTriggerValuesPreviewData, DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getInputExportedValues } from '../../lib/inputs/valueTypes.js';
	import { isValueTrigger } from '../../lib/triggers/utils.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import IconButton from '../common/IconButton.svelte';
	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		trigger,          // Trigger plain object
		dnd,              // Drag-and-drop helper
		onEdit            // Callback when edit button clicked
	} = $props();

	let device = $derived(deviceLibrary.get(trigger.deviceId));
	let animation = $derived(trigger.animation?.id ? animationLibrary.get(trigger.animation.id) : null);
	let input = $derived(trigger.inputId ? inputLibrary.get(trigger.inputId) : null);

	// Check if this is a value trigger
	let isValue = $derived(isValueTrigger(trigger));

	// For values triggers (actionType='values'), compute preview data from trigger values
	let valuesPreview = $derived.by(() => {
		if (trigger.actionType !== 'values' || !device) return null;
		return getTriggerValuesPreviewData(device.type, trigger.values);
	});

	// Get input type label (On/Off/Up/Down) for button triggers
	let inputTypeLabel = $derived.by(() => {
		if (!input) return trigger.triggerType === 'pressed' ? 'Down' : 'Up';

		// Check if it's toggle mode
		if (input.buttonMode === 'toggle') {
			return trigger.triggerType === 'pressed' ? 'On' : 'Off';
		} else {
			return trigger.triggerType === 'pressed' ? 'Down' : 'Up';
		}
	});

	// For value triggers: get the input value label
	let inputValueLabel = $derived.by(() => {
		if (!isValue || !input) return '';
		const exportedValues = getInputExportedValues(input);
		const value = exportedValues.find(v => v.key === trigger.inputValueKey);
		return value?.label || 'Value';
	});

	// For value triggers: get control label with channel if applicable
	let controlLabel = $derived.by(() => {
		if (!isValue || !device || !trigger.controlName) return '';
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

	// For value triggers: get control preview data
	let controlPreview = $derived.by(() => {
		if (!isValue || !device || !trigger.controlName) return null;
		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return null;

		const controlDef = deviceType.controls.find(c => c.name === trigger.controlName);
		if (!controlDef) return null;

		const controlTypeId = controlDef.type.type;
		const controls = [];
		const data = {};

		if (controlTypeId === 'rgb') {
			controls.push('color');
			// Show a neutral gray for RGB preview
			data.color = 'rgb(128, 128, 128)';
		} else if (controlTypeId === 'slider' || controlTypeId === 'toggle') {
			const controlKey = controlDef.name.toLowerCase();
			controls.push(controlKey);
			// Show midpoint value for slider preview
			data[controlKey] = 128;
		} else if (controlTypeId === 'xypad') {
			controls.push('pantilt');
			data.pan = 128;
			data.tilt = 128;
		}

		return controls.length > 0 ? { controls, data } : null;
	});
</script>

<DraggableCard {dnd} item={trigger} class="trigger-card">
	<!-- Column 1: Input -->
	<div class="trigger-column trigger-input-column">
		{#if trigger.triggerType === 'always'}
			<div class="trigger-text">Always</div>
		{:else}
			<Preview
				type="input"
				size="medium"
				data={input}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{input?.name || 'Unknown Input'} → {#if isValue}{inputValueLabel}{:else}{inputTypeLabel}{/if}
			</div>
		{/if}
	</div>

	<!-- Column 2: Device -->
	<div class="trigger-column trigger-device-column">
		{#if device}
			<Preview
				type="device"
				size="medium"
				data={device}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{device.name}
			</div>
		{/if}
	</div>

	<!-- Column 3: Action / Mapping -->
	<div class="trigger-column trigger-action-column">
		{#if isValue && controlPreview}
			<!-- Value trigger: show control preview -->
			<Preview
				type="controls"
				size="medium"
				controls={controlPreview.controls}
				data={controlPreview.data}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{controlLabel}{#if trigger.invert} <span class="invert-indicator" title="Inverted">⇄</span>{/if}
			</div>
		{:else if trigger.actionType === 'animation'}
			<Preview
				type="animation"
				size="medium"
				data={animation}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{animation?.name || 'Unknown'}
			</div>
		{:else if valuesPreview}
			<Preview
				type="controls"
				size="medium"
				controls={valuesPreview.controls}
				data={valuesPreview.data}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{Object.keys(trigger.values || {}).length} values
			</div>
		{/if}
	</div>

	<IconButton
		icon={editIcon}
		onclick={() => onEdit?.(trigger)}
		title="Edit trigger"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.trigger-card) {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 20px;
		width: 100%;
		max-width: 800px;
		padding: 20px;
	}

	.trigger-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}

	.trigger-input-column {
		flex: 1.2;
	}

	.trigger-device-column {
		flex: 1;
	}

	.trigger-action-column {
		flex: 1;
	}

	.trigger-text {
		font-size: 9pt;
		color: #666;
		text-align: center;
		word-wrap: break-word;
		width: 100%;
	}

	.invert-indicator {
		color: #dc3545;
	}

	:global(.trigger-preview) {
		flex-shrink: 0;
	}
</style>
