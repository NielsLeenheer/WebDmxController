<script>
	/**
	 * DraggableCard - Reusable wrapper component for drag-and-drop cards
	 *
	 * Handles all drag event bindings and class states automatically.
	 *
	 * Usage:
	 *   <DraggableCard {dnd} {item} {index} class="device-card">
	 *     <!-- Your card content here -->
	 *   </DraggableCard>
	 */

	let {
		dnd,              // Drag-and-drop helper from createDragDrop()
		item,             // The item being rendered
		index,            // Index in the list
		class: className = '',  // Additional CSS classes
		orientation = 'vertical',  // 'horizontal' or 'vertical' - defaults to vertical
		children
	} = $props();

	// Helper to check if this is the drag-after position
	function isDragAfter() {
		return dnd.dragOverIndex === index && dnd.isAfterMidpoint;
	}

	// Helper to check if this is the drag-before position
	function isDragBefore() {
		return dnd.dragOverIndex === index && !dnd.isAfterMidpoint;
	}
</script>

<div
	class={className}
	class:dragging={dnd.draggedItem === item}
	class:drag-over={isDragBefore()}
	class:drag-after={isDragAfter()}
	class:horizontal={orientation === 'horizontal'}
	class:vertical={orientation === 'vertical'}
	draggable="true"
	onmousedown={dnd.handleMouseDown}
	ondragstart={(e) => dnd.handleDragStart(e, item, index)}
	ondragover={(e) => dnd.handleDragOver(e, index)}
	ondragleave={dnd.handleDragLeave}
	ondrop={(e) => dnd.handleDrop(e, index)}
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

	/* Global card styling */
	:global(.device-card) {
		background: #f0f0f0;
		border-radius: 8px;
		padding: 15px;
		transition: opacity 0.2s, transform 0.2s;
	}
</style>
