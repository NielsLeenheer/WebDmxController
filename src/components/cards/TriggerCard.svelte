<script>
	import { deviceLibrary, animationLibrary, inputLibrary } from '../../stores.svelte.js';
	import { getTriggerValuesPreviewData } from '../../lib/outputs/devices.js';
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

	// For values triggers, compute preview data from trigger values
	let valuesPreview = $derived.by(() => {
		if (trigger.actionType !== 'values' || !device) return null;
		return getTriggerValuesPreviewData(device.type, trigger.values);
	});

	// Get input type label (On/Off/Up/Down)
	let inputTypeLabel = $derived.by(() => {
		if (!input) return trigger.triggerType === 'pressed' ? 'Down' : 'Up';

		// Check if it's toggle mode
		if (input.buttonMode === 'toggle') {
			return trigger.triggerType === 'pressed' ? 'On' : 'Off';
		} else {
			return trigger.triggerType === 'pressed' ? 'Down' : 'Up';
		}
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
				{input?.name || 'Unknown Input'} → {inputTypeLabel}
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

	<!-- Column 3: Action -->
	<div class="trigger-column trigger-action-column">
		{#if trigger.actionType === 'animation'}
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

	:global(.trigger-preview) {
		flex-shrink: 0;
	}
</style>
