<script>
	/**
	 * CardHeader - Reusable card header component
	 *
	 * Provides consistent styling and drag handle functionality for card headers.
	 *
	 * Usage:
	 *   <CardHeader>
	 *     <Preview ... />
	 *     <h3>Card Title</h3>
	 *     <IconButton ... />
	 *   </CardHeader>
	 */

	let {
		children
	} = $props();
</script>

<div class="card-header">
	{@render children()}
</div>

<style>
	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: grab;
	}

	.card-header:active {
		cursor: grabbing;
	}
</style>
