<script>
	/**
	 * DraggableCard - Reusable wrapper component for drag-and-drop cards
	 *
	 * Handles all drag event bindings and class states automatically.
	 * If dnd is null, the card is rendered as non-draggable.
	 *
	 * Usage:
	 *   <DraggableCard {dnd} {item} class="device-card">
	 *     <!-- Your card content here -->
	 *   </DraggableCard>
	 */

	let {
		dnd = null,   // Drag-and-drop helper from createDragDrop(), or null for non-draggable
		item,             // The item being rendered
		class: className = '',  // Additional CSS classes
		onclick,          // Optional click handler
		children
	} = $props();

	// Helper to check if this is the drag-after position
	function isDragAfter() {
		return dnd?.dragOverItem === item && dnd?.isAfterMidpoint;
	}

	// Helper to check if this is the drag-before position
	function isDragBefore() {
		return dnd?.dragOverItem === item && !dnd?.isAfterMidpoint;
	}

	// Check if dragging is enabled
	let isDraggable = $derived(dnd !== null);
</script>

<div
	class="draggable-card {className}"
	class:dragging={dnd?.draggedItem === item}
	class:drag-over={isDragBefore()}
	class:drag-after={isDragAfter()}
	class:horizontal={dnd?.orientation === 'horizontal'}
	class:vertical={dnd?.orientation === 'vertical'}
	class:drag-by-header={dnd?.dragByHeader}
	class:drag-by-card={dnd && !dnd.dragByHeader}
	class:non-draggable={!isDraggable}
	style:order={item.order}
	role="listitem"
	draggable={isDraggable}
	onmousedown={dnd?.handleMouseDown}
	ondragstart={isDraggable ? (e) => dnd.handleDragStart(e, item) : undefined}
	ondragover={isDraggable ? (e) => dnd.handleDragOver(e, item) : undefined}
	ondragleave={dnd?.handleDragLeave}
	ondrop={isDraggable ? (e) => dnd.handleDrop(e, item) : undefined}
	ondragend={dnd?.handleDragEnd}
	{onclick}
>
	{@render children()}
</div>

<style>
	/* Base drag state */
	div.dragging {
		opacity: 0.5;
	}

	/* Drag indicator positioning - shared */
	div.drag-over,
	div.drag-after {
		position: relative;
	}

	div.drag-over::before,
	div.drag-after::before {
		content: '';
		position: absolute;
		background: #2196F3;
		border-radius: 2px;
	}
	div:not(.dragging).drag-over::before,
	div:not(.dragging).drag-after::before {
		opacity: 0.5;
	}

	/* Horizontal orientation (left/right indicators) */
	div.horizontal.drag-over::before {
		left: -9.5px;
		top: 0;
		bottom: 0;
		width: 4px;
	}

	div.horizontal.drag-after::before {
		right: -9.5px;
		top: 0;
		bottom: 0;
		width: 4px;
	}

	/* Vertical orientation (top/bottom indicators) */
	div.vertical.drag-over::before {
		top: -9.5px;
		left: 0;
		right: 0;
		height: 4px;
	}

	div.vertical.drag-after::before {
		bottom: -9.5px;
		left: 0;
		right: 0;
		height: 4px;
	}

	div.draggable-card {
		background: #f0f0f0;
		border-radius: 8px;
		padding: 15px;
		transition: opacity 0.2s, transform 0.2s;
		position: relative;
	}

	/* Cursor styles when dragging by card (whole card is draggable) */
	div.drag-by-card {
		cursor: grab;
	}

	div.drag-by-card:active {
		cursor: grabbing;
	}

	/* Cursor styles when dragging by header (only header is draggable) */
	div.drag-by-header :global(.card-header) {
		cursor: grab;
	}

	div.drag-by-header :global(.card-header:active) {
		cursor: grabbing;
	}
</style>
