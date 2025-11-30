<script>
	import { paletteColorToHex } from '../../lib/inputs/colors.js';
	import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		input,           // Input plain object
		dnd,             // Drag-and-drop helper
		state = {},      // Raw state object: { value?, x?, y?, state? }
		eulerAngles,     // Euler angles for Thingy:52 (optional)
		onEdit           // Callback when edit button clicked
	} = $props();

	// Format state for UI display
	const stateDisplay = $derived.by(() => {
		if (!state) return '';

		let parts = [];

		// For sticks (have x and y values)
		if (state.x !== undefined && state.y !== undefined) {
			parts.push(`${state.x}% ${state.y}%`);
		}

		// For knobs/sliders/axis
		if (state.value !== undefined) {
			parts.push(`${state.value}%`);
		}

		// For buttons (toggle or momentary)
		if (isButton(input)) {
			if (input.buttonMode === 'toggle') {
				parts.push(state.state === 'on' ? 'On' : 'Off');
			} else {
				// Momentary buttons - only show when pressed
				if (state.state === 'pressed') {
					parts.push('●');
				}
			}
		}
		
		return parts.join(' ');
	});

</script>

<DraggableCard {dnd} item={input} class="input-card">
	<Preview
		type="input"
		size="medium"
		data={input}
		state={state}
		euler={input.controlId === 'thingy' && eulerAngles ? eulerAngles : null}
		class="input-preview"
	/>
	<div class="input-header">
		<div class="input-name">{input.name}</div>
		<div class="input-device-name">
			{input.deviceName || input.deviceId}
			{#if input.controlName}
				<span class="separator">•</span>
				{input.controlName}
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

	:global(.input-card) .input-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-right: 40px; /* Space for preview */
	}

	:global(.input-card) :global(.input-preview) {
		position: absolute;
		top: 15px;
		right: 15px;
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
		margin: 0 1px;
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
