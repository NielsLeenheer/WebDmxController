/**
 * Reusable drag-and-drop helper for card lists
 *
 * Usage:
 *   const dnd = createDragDrop({
 *     items: () => myArray,
 *     onReorder: (newArray) => { myArray = newArray; }
 *   });
 *
 * Then in template:
 *   <div
 *     draggable="true"
 *     ondragstart={(e) => dnd.handleDragStart(e, item, index)}
 *     ondragover={(e) => dnd.handleDragOver(e, index)}
 *     ondragleave={dnd.handleDragLeave}
 *     ondrop={(e) => dnd.handleDrop(e, index)}
 *     ondragend={dnd.handleDragEnd}
 *     class:dragging={dnd.draggedItem === item}
 *     class:drag-over-before={dnd.dragOverIndex === index && !dnd.isAfterMidpoint}
 *     class:drag-over-after={dnd.dragOverIndex === index && dnd.isAfterMidpoint}
 *   >
 */

/**
 * Create a drag-and-drop controller
 * @param {Object} options
 * @param {Function} options.items - Function that returns the current items array
 * @param {Function} options.onReorder - Callback when items are reordered, receives new array
 * @param {Function} [options.getItemId] - Function to get unique ID from item (default: item => item.id)
 * @param {Function} [options.shouldAllowDrag] - Function to check if drag should be allowed based on mousedown target
 * @param {string} [options.orientation] - Drag orientation: 'vertical' (default) or 'horizontal'
 * @returns {Object} Drag-and-drop controller with handlers and state
 */
export function createDragDrop(options) {
	const {
		items,
		onReorder,
		getItemId = (item) => item.id,
		shouldAllowDrag = null,
		orientation = 'vertical'
	} = options;

	// Track where mouse was pressed down (for checking if drag should be allowed)
	let lastMouseDownTarget = $state(null);

	// Drag state
	let draggedItem = $state(null);
	let draggedIndex = $state(null);
	let dragOverIndex = $state(null);
	let isAfterMidpoint = $state(false);

	/**
	 * Track mousedown for drag validation
	 */
	function handleMouseDown(event) {
		lastMouseDownTarget = event.target;
	}

	/**
	 * Start dragging an item
	 */
	function handleDragStart(event, item, index) {
		// Check if drag should be allowed based on where mousedown happened
		if (shouldAllowDrag && lastMouseDownTarget) {
			if (!shouldAllowDrag(lastMouseDownTarget)) {
				event.preventDefault();
				return;
			}
		}

		draggedItem = item;
		draggedIndex = index;
		event.dataTransfer.effectAllowed = 'move';
	}

	/**
	 * Handle drag over a target position
	 */
	function handleDragOver(event, index) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		dragOverIndex = index;

		// Calculate if mouse is in the second half of the card
		const rect = event.currentTarget.getBoundingClientRect();
		if (orientation === 'horizontal') {
			const midpoint = rect.left + rect.width / 2;
			isAfterMidpoint = event.clientX > midpoint;
		} else {
			const midpoint = rect.top + rect.height / 2;
			isAfterMidpoint = event.clientY > midpoint;
		}
	}

	/**
	 * Handle drag leave
	 */
	function handleDragLeave() {
		dragOverIndex = null;
		isAfterMidpoint = false;
	}

	/**
	 * Handle drop at target position
	 */
	function handleDrop(event, targetIndex) {
		event.preventDefault();

		if (!draggedItem) return;

		const itemsArray = items();
		const currentIndex = itemsArray.findIndex(item => getItemId(item) === getItemId(draggedItem));

		if (currentIndex === -1) {
			resetDragState();
			return;
		}

		// Adjust target index based on whether we're inserting after the midpoint
		let insertIndex = targetIndex;
		if (isAfterMidpoint) {
			insertIndex = targetIndex + 1;
		}

		// If dragging from before to after in the same position, no change needed
		if (currentIndex === insertIndex || currentIndex === insertIndex - 1) {
			resetDragState();
			return;
		}

		// Reorder the array
		const newItems = [...itemsArray];
		const [removed] = newItems.splice(currentIndex, 1);
		// Adjust insert position if we removed an item before it
		const finalInsertIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
		newItems.splice(finalInsertIndex, 0, removed);

		// Call the reorder callback
		onReorder(newItems);

		resetDragState();
	}

	/**
	 * Handle drag end
	 */
	function handleDragEnd() {
		resetDragState();
	}

	/**
	 * Reset all drag state
	 */
	function resetDragState() {
		draggedItem = null;
		draggedIndex = null;
		dragOverIndex = null;
		isAfterMidpoint = false;
	}

	return {
		// State (for template bindings)
		get draggedItem() { return draggedItem; },
		get draggedIndex() { return draggedIndex; },
		get dragOverIndex() { return dragOverIndex; },
		get isAfterMidpoint() { return isAfterMidpoint; },

		// Event handlers
		handleMouseDown,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDragEnd
	};
}
