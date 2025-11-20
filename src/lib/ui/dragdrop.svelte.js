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
 * @param {Function} options.onReorder - Callback when items are reordered, receives array of IDs in new visual order
 * @param {Function} [options.getItemId] - Function to get unique ID from item (default: item => item.id)
 * @param {boolean} [options.dragByHeader] - If true, only allow drag from CardHeader component
 * @param {string} [options.orientation] - Drag orientation: 'vertical' (default) or 'horizontal'
 * @returns {Object} Drag-and-drop controller with handlers and state
 */
export function createDragDrop(options) {
	const {
		items,
		onReorder,
		getItemId = (item) => item.id,
		dragByHeader = false,
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
		if (lastMouseDownTarget) {
			// Prevent drag if started on interactive elements
			if (lastMouseDownTarget.tagName === 'INPUT' ||
				lastMouseDownTarget.tagName === 'BUTTON' ||
				lastMouseDownTarget.tagName === 'TEXTAREA') {
				event.preventDefault();
				return;
			}

			// Prevent drag if any element in the path has draggable="false"
			let el = lastMouseDownTarget;
			while (el && !el.classList?.contains('draggable-card')) {
				if (el.getAttribute && el.getAttribute('draggable') === 'false') {
					event.preventDefault();
					return;
				}
				el = el.parentElement;
			}

			// If dragByHeader is enabled, only allow drag from CardHeader
			if (dragByHeader) {
				let foundHeader = false;
				el = lastMouseDownTarget;

				while (el && !el.classList?.contains('draggable-card')) {
					if (el.classList?.contains('card-header')) {
						foundHeader = true;
						break;
					}
					el = el.parentElement;
				}

				if (!foundHeader) {
					event.preventDefault();
					return;
				}
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

		// Sort items by their order property to get visual order
		const visualOrder = [...itemsArray].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

		// Find current visual index of dragged item
		const currentVisualIndex = visualOrder.findIndex(item => getItemId(item) === getItemId(draggedItem));

		if (currentVisualIndex === -1) {
			resetDragState();
			return;
		}

		// Find target visual index from the array index
		const targetItem = itemsArray[targetIndex];
		let targetVisualIndex = visualOrder.findIndex(item => getItemId(item) === getItemId(targetItem));

		if (targetVisualIndex === -1) {
			resetDragState();
			return;
		}

		// Adjust target index based on whether we're inserting after the midpoint
		if (isAfterMidpoint) {
			targetVisualIndex = targetVisualIndex + 1;
		}

		// If dragging to the same position, no change needed
		if (currentVisualIndex === targetVisualIndex || currentVisualIndex === targetVisualIndex - 1) {
			resetDragState();
			return;
		}

		// Reorder the visual array
		const newVisualOrder = [...visualOrder];
		const [removed] = newVisualOrder.splice(currentVisualIndex, 1);
		// Adjust insert position if we removed an item before it
		const finalInsertIndex = currentVisualIndex < targetVisualIndex ? targetVisualIndex - 1 : targetVisualIndex;
		newVisualOrder.splice(finalInsertIndex, 0, removed);

		// Extract IDs in the new visual order
		const orderedIds = newVisualOrder.map(item => getItemId(item));

		// Call the reorder callback with array of IDs
		onReorder(orderedIds);

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
		get orientation() { return orientation; },
		get dragByHeader() { return dragByHeader; },

		// Event handlers
		handleMouseDown,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDragEnd
	};
}
