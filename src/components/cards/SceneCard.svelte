<script>
	import DraggableCard from '../common/DraggableCard.svelte';
	import IconButton from '../common/IconButton.svelte';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';
	import activeIcon from '../../assets/icons/active.svg?raw';

	let {
		scene,        // Scene plain object
		dnd,          // Drag-and-drop helper
		isActive,     // Whether this is the active scene
		isSelected,   // Whether this scene is selected in the UI
		isDefault,    // Whether this is the default scene
		onEdit,       // Callback when edit button clicked
		onActivate    // Callback when scene is clicked to activate
	} = $props();

	let menuButtonRef = $state(null);

	// Build class string dynamically
	let cardClass = $derived(
		['scene-card', isActive && 'active', isSelected && 'selected', isDefault && 'default'].filter(Boolean).join(' ')
	);
</script>

<DraggableCard
	{dnd}
	item={scene}
	class={cardClass}
	onclick={() => onActivate?.(scene)}
>
	<h3>{scene.name}</h3>

	{#if isActive}
		<span class="active-indicator" title="Active scene">{@html activeIcon}</span>
	{/if}

	<div class="device-count">
		{scene.devices.length} {scene.devices.length === 1 ? 'device' : 'devices'}
	</div>

	<IconButton
		bind:buttonRef={menuButtonRef}
		icon={dotsIcon}
		onclick={(e) => { e.stopPropagation(); onEdit?.(scene, menuButtonRef); }}
		title="Scene options"
		size="small"
	/>
</DraggableCard>

<style>
	:global(.scene-card) {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	:global(.scene-card:hover) {
		background: #fafafa;
	}

	:global(.scene-card.active) {
		background: #e8f4fd;
		border-color: #2196f3;
	}

	:global(.scene-card.selected) {
		box-shadow: 0 0 0 2px #2196f3, 0 0 12px rgba(33, 150, 243, 0.4);
	}

	:global(.scene-card) h3 {
		margin: 0;
		font-size: 11pt;
		font-weight: 600;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.scene-card) .active-indicator {
		display: flex;
		align-items: center;
		color: #2196f3;
	}

	:global(.scene-card) .active-indicator :global(svg) {
		width: 20px;
		height: 20px;
	}

	:global(.scene-card) .device-count {
		color: #666;
		font-size: 9pt;
		margin-left: auto;
		margin-right: 10px;
	}

	:global(.scene-card) :global(.icon-button) {
		flex-shrink: 0;
	}
</style>
