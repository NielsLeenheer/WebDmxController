<script>
	import { getTriggerValuesPreviewData, DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import IconButton from '../common/IconButton.svelte';
	import Preview from '../common/Preview.svelte';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';

	let {
		device,           // Device object from DeviceLibrary
		deviceEntry,      // Device entry from scene (type, values, animation)
		animation,        // Animation object (if deviceEntry.type === 'animation')
		dnd = null,       // Drag-and-drop helper
		onEdit            // Callback when edit button clicked
	} = $props();

	let menuButtonRef = $state(null);

	// For values entries: generate preview data for the affected controls
	let valuesPreview = $derived.by(() => {
		if (deviceEntry.type !== 'values' || !device) return null;
		return getTriggerValuesPreviewData(device.type, deviceEntry.values);
	});

	// For values entries: generate a label listing affected controls
	let valuesLabel = $derived.by(() => {
		if (deviceEntry.type !== 'values' || !device) return '';
		const values = deviceEntry.values || {};
		const controlIds = Object.keys(values);
		if (controlIds.length === 0) return 'No values';

		const deviceType = DEVICE_TYPES[device.type];
		if (!deviceType) return `${controlIds.length} values`;

		// Get control names
		const controlNames = controlIds.map(id => {
			const controlDef = deviceType.controls.find(c => c.id === id);
			return controlDef?.type?.name || id;
		});

		if (controlNames.length <= 3) {
			return controlNames.join(', ');
		} else {
			const first = controlNames.slice(0, 2).join(', ');
			const remaining = controlNames.length - 2;
			return `${first} and ${remaining} more`;
		}
	});
</script>

<DraggableCard {dnd} item={deviceEntry} class="scene-device-card">
	<!-- Column 1: Device -->
	<div class="scene-column scene-device-column">
		<Preview
			type="device"
			size="medium"
			data={device}
			class="scene-preview"
		/>
		<div class="scene-text">
			{device.name}
		</div>
	</div>

	<!-- Column 2: Action (values or animation) -->
	<div class="scene-column scene-action-column">
		{#if deviceEntry.type === 'animation' && animation}
			<Preview
				type="animation"
				size="medium"
				data={animation}
				class="scene-preview"
			/>
			<div class="scene-text">
				{animation.name}
			</div>
		{:else if valuesPreview}
			<Preview
				type="controls"
				size="medium"
				controls={valuesPreview.controls}
				data={valuesPreview.data}
				class="scene-preview"
			/>
			<div class="scene-text">
				{valuesLabel}
			</div>
		{:else}
			<div class="scene-text">No settings</div>
		{/if}
	</div>

	<IconButton
		bind:buttonRef={menuButtonRef}
		icon={dotsIcon}
		onclick={() => onEdit?.(device, deviceEntry, menuButtonRef)}
		title="Edit device settings"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.scene-device-card) {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 20px;
		width: 100%;
		padding: 20px;
	}

	.scene-column {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}

	.scene-device-column {
		flex: 1;
	}

	.scene-action-column {
		flex: 1;
	}

	.scene-text {
		font-size: 9pt;
		color: #666;
		text-align: left;
		word-wrap: break-word;
		width: 100%;
	}

	:global(.scene-preview) {
		flex-shrink: 0;
	}
</style>
