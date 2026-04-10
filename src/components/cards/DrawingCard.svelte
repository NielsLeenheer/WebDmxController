<script>
	import DraggableCard from '../common/DraggableCard.svelte';
	import IconButton from '../common/IconButton.svelte';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';
	import activeIcon from '../../assets/icons/active.svg?raw';

	let {
		drawing,      // Drawing plain object
		dnd,          // Drag-and-drop helper
		isDefault,    // Whether this is the default drawing
		isSelected,   // Whether this drawing is selected in the UI
		onEdit,       // Callback when edit button clicked
		onSelect      // Callback when drawing is clicked to select
	} = $props();

	let menuButtonRef = $state(null);

	let cardClass = $derived(
		['drawing-card', isSelected && 'selected', isDefault && 'default'].filter(Boolean).join(' ')
	);
</script>

<DraggableCard
	{dnd}
	item={drawing}
	class={cardClass}
	onclick={() => onSelect?.(drawing)}
>
	<h3>{drawing.name}</h3>

	{#if isDefault}
		<span class="default-indicator" title="Default drawing">{@html activeIcon}</span>
	{/if}

	<IconButton
		bind:buttonRef={menuButtonRef}
		icon={dotsIcon}
		onclick={(e) => { e.stopPropagation(); onEdit?.(drawing, menuButtonRef); }}
		title="Drawing options"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.drawing-card) {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	:global(.drawing-card:hover) {
		background: #fafafa;
	}

	:global(.drawing-card.selected) {
		box-shadow: 0 0 0 2px #2196f3, 0 0 12px rgba(33, 150, 243, 0.4);
	}

	:global(.drawing-card) h3 {
		margin: 0;
		font-size: 11pt;
		font-weight: 600;
		color: #333;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.drawing-card) .default-indicator {
		display: flex;
		align-items: center;
		color: #4caf50;
	}

	:global(.drawing-card) .default-indicator :global(svg) {
		width: 20px;
		height: 20px;
	}

	:global(.drawing-card) :global(.icon-button) {
		flex-shrink: 0;
	}
</style>
