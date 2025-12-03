<script>
	import { paletteColorToHex } from '../../lib/inputs/colors.js';
	import { isButton, getInputPropertyName } from '../../lib/inputs/utils.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import Preview from '../common/Preview.svelte';
	import IconButton from '../common/IconButton.svelte';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';

	let {
		input,           // Input plain object
		dnd,             // Drag-and-drop helper
		inputState = {}, // Raw state object: { value?, x?, y?, state?, roll?, pitch?, yaw? }
		onEdit           // Callback when edit button clicked
	} = $props();

	let menuButtonRef = $state(null);
</script>

<DraggableCard {dnd} item={input} class="input-card">
	<Preview
		type="input"
		size="medium"
		data={input}
		state={inputState}
		class="input-preview"
	/>

	<div class="input-name">{input.name}</div>

	<div class="input-device-name">
		{input.deviceName || input.deviceId}
		{#if input.controlName}
			<span class="separator">•</span>
			{input.controlName}
		{/if}
	</div>
	
	<IconButton
		bind:buttonRef={menuButtonRef}
		icon={dotsIcon}
		onclick={() => onEdit?.(input, menuButtonRef)}
		title="Input settings"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.input-card) {
		display: grid;
		grid-template-areas:
			"preview name actions"
			"preview device actions";
		
		grid-template-columns: auto 1fr auto;
		grid-template-rows: min-content 1fr;
		gap: 3px 12px;
	}

	:global(.input-card) :global(.input-preview) {
		grid-area: preview;
	}

	:global(.input-card) .input-name {
		grid-area: name;

		font-weight: 600;
		font-size: 11pt;
		color: #333;
		word-wrap: break-word;
	}

	:global(.input-card) .input-device-name {
		grid-area: device;

		font-size: 8pt;
		color: #666;
	}

	:global(.input-card) .input-device-name .separator {
		margin: 0 1px;
		opacity: 0.5;
	}

	:global(.input-card) :global(.icon-button) {
		grid-area: actions;
		align-self: center;
	}

</style>