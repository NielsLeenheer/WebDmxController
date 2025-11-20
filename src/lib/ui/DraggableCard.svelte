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
