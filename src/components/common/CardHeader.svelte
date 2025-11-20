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
		justify-content: space-between;
		gap: 8px;

		background: #e6e6e6;
        margin: -15px -15px 12px -15px;
        padding: 12px 15px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
	}
</style>
