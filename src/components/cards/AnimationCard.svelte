<script>
	import DraggableCard from '../common/DraggableCard.svelte';
	import CardHeader from '../common/CardHeader.svelte';
	import IconButton from '../common/IconButton.svelte';
	import Preview from '../common/Preview.svelte';
	import TimelineEditor from '../animations/TimelineEditor.svelte';

	import editIcon from '../../assets/glyphs/edit.svg?raw';

	let {
		animation,       // Animation plain object
		dnd,             // Drag-and-drop helper
		animationLibrary, // Animation library reference
		onSettings       // Callback when settings button clicked
	} = $props();
</script>

<DraggableCard {dnd} item={animation} class="animation-card">
	<CardHeader>
		<Preview
			type="animation"
			size="medium"
			data={animation}
		/>

		<h3>{animation.name}</h3>

		<div class="badge">
			{animation.targetLabel || 'Animation'}
		</div>

		<IconButton
			icon={editIcon}
			onclick={() => onSettings?.(animation)}
			title="Edit animation"
			size="small"
		/>
	</CardHeader>

	<TimelineEditor
		{animation}
		{animationLibrary}
	/>
</DraggableCard>

<style>

	:global(.animation-card) {
		width: 80vw;
	}

	:global(.card-header) h3 {
		margin: 0;
		font-size: 11pt;
		font-weight: 600;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.card-header) .badge {
		background: #f6f6f6;
		color: #888;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 9pt;
		font-weight: 500;
		margin-left: 10px;
	}

	:global(.card-header) :global(.icon-button) {
		margin-left: auto;
	}
</style>
