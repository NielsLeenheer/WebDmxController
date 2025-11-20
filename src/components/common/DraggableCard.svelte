<script>
	/**
	 * DraggableCard - Reusable wrapper component for drag-and-drop cards
	 *
	 * Handles all drag event bindings and class states automatically.
	 *
	 * Usage:
	 *   <DraggableCard {dnd} {item} class="device-card">
	 *     <!-- Your card content here -->
	 *   </DraggableCard>
	 */

	let {
		dnd,              // Drag-and-drop helper from createDragDrop()
		item,             // The item being rendered
		class: className = '',  // Additional CSS classes
		children
	} = $props();

	// Helper to check if this is the drag-after position
	function isDragAfter() {
		return dnd.dragOverItem === item && dnd.isAfterMidpoint;
	}

	// Helper to check if this is the drag-before position
	function isDragBefore() {
		return dnd.dragOverItem === item && !dnd.isAfterMidpoint;
	}
</script>

<div
	class="draggable-card {className}"
	class:dragging={dnd.draggedItem === item}
	class:drag-over={isDragBefore()}
	class:drag-after={isDragAfter()}
	class:horizontal={dnd.orientation === 'horizontal'}
	class:vertical={dnd.orientation === 'vertical'}
	class:drag-by-header={dnd.dragByHeader}
	class:drag-by-card={!dnd.dragByHeader}
	style:order={item.order}
	draggable="true"
	onmousedown={dnd.handleMouseDown}
	ondragstart={(e) => dnd.handleDragStart(e, item)}
	ondragover={(e) => dnd.handleDragOver(e, item)}
	ondragleave={dnd.handleDragLeave}
	ondrop={(e) => dnd.handleDrop(e, item)}
	ondragend={dnd.handleDragEnd}
>
	{@render children()}
</div>

<style>
	/* Base drag state */
	div.dragging {
		opacity: 0.4;
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

	/* Horizontal orientation (left/right indicators) */
	div.horizontal.drag-over::before {
		left: -8px;
		top: 0;
		bottom: 0;
		width: 4px;
	}

	div.horizontal.drag-after::before {
		right: -8px;
		top: 0;
		bottom: 0;
		width: 4px;
	}

	/* Vertical orientation (top/bottom indicators) */
	div.vertical.drag-over::before {
		top: -8px;
		left: 0;
		right: 0;
		height: 4px;
	}

	div.vertical.drag-after::before {
		bottom: -8px;
		left: 0;
		right: 0;
		height: 4px;
	}

	div.draggable-card {
		background: #f0f0f0;
		border-radius: 8px;
		padding: 15px;
		transition: opacity 0.2s, transform 0.2s;
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
