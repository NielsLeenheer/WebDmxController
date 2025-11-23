<script>
	import { paletteColorToHex } from '../../lib/inputs/colors.js';
	import { isButtonInput, getInputPropertyName } from '../../lib/inputs/utils.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		input,           // Input plain object
		dnd,             // Drag-and-drop helper
		stateDisplay,    // Computed state display string
		eulerAngles,     // Euler angles for Thingy:52 (optional)
		onEdit           // Callback when edit button clicked
	} = $props();

	// Check if this input should show a color preview
	let showColorPreview = $derived(input.color && input.supportsColor);
</script>

<DraggableCard {dnd} item={input} class="input-card">
	{#if showColorPreview}
		<Preview
			type="input"
			size="medium"
			data={input}
			euler={input.inputControlId === 'button' && eulerAngles ? eulerAngles : null}
			class="input-color-badge"
		/>
	{/if}
	<div class="input-header">
		<div class="input-name">{input.name}</div>
		<div class="input-device-name">
			{input.inputDeviceName || input.inputDeviceId}
			{#if input.friendlyName}
				<span class="separator">•</span>
				{input.friendlyName}
			{/if}
		</div>
	</div>
	<div class="input-state">
		{stateDisplay}
	</div>
	<div class="input-actions">
		<button
			class="edit-button"
			onclick={() => onEdit?.(input)}
			title="Rename input"
		>
			{@html editIcon}
		</button>
	</div>
</DraggableCard>

<style>
	:global(.input-card) {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	:global(.input-card) .input-color-badge {
		position: absolute;
		top: 15px;
		right: 15px;
	}

	:global(.input-card) .input-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-right: 40px; /* Space for color badge */
	}

	:global(.input-card) .input-name {
		font-weight: 600;
		font-size: 11pt;
		color: #333;
		word-wrap: break-word;
	}

	:global(.input-card) .input-device-name {
		font-size: 9pt;
		color: #666;
	}

	:global(.input-card) .input-device-name .separator {
		margin: 0 4px;
		opacity: 0.5;
	}

	:global(.input-card) .input-state {
		position: absolute;
		bottom: 14px;
		left: 14px;
		font-size: 9pt;
		font-weight: 600;
		color: #666;
		min-height: 14px;
	}

	:global(.input-card) .input-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: auto;
	}

	:global(.input-card) .edit-button {
		padding: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		color: #666;
		transition: background 0.2s;
	}

	:global(.input-card) .edit-button:hover {
		background: #e0e0e0;
	}

	:global(.input-card) .edit-button :global(svg) {
		width: 20px;
		height: 20px;
	}
</style>
