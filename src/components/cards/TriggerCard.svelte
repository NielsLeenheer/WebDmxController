<script>
	import { deviceLibrary } from '../../lib/libraries.svelte.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import IconButton from '../common/IconButton.svelte';
	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		trigger,          // Trigger plain object
		dnd,              // Drag-and-drop helper
		onEdit,           // Callback when edit button clicked
		// Display functions
		getInputName,
		getInputTypeLabel,
		getInputPreview,
		getAnimationDisplayName,
		getAnimationPreview,
		getSpecialControls,
		getControlValue,
		getValuePreview
	} = $props();

	let device = $derived(deviceLibrary.get(trigger.deviceId));
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
				data={{ color: getInputPreview(trigger) }}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{getInputName(trigger.inputId)} → {getInputTypeLabel(trigger)}
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
				data={{ color: getAnimationPreview(trigger.animation?.id) }}
				class="trigger-preview"
			/>
			<div class="trigger-text">
				{getAnimationDisplayName(trigger.animation?.id)}
			</div>
		{:else}
			{@const specialControls = getSpecialControls(trigger)}
			{#if specialControls}
				<Preview
					type="controls"
					size="medium"
					controls={specialControls}
					data={{
						fuel: getControlValue(trigger, 'Fuel'),
						safety: getControlValue(trigger, 'Safety'),
						output: getControlValue(trigger, 'Output')
					}}
					class="trigger-preview"
				/>
			{:else}
				<Preview
					type="controls"
					size="medium"
					controls={['color']}
					data={{ color: getValuePreview(trigger) }}
					class="trigger-preview"
				/>
			{/if}
			<div class="trigger-text">
				{Object.keys(trigger.values?.channelValues || {}).length} values
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
