<script>
	/**
	 * DialogColumnPanel - A styled panel for dialog columns
	 *
	 * Usage:
	 *   <DialogColumnPanel>
	 *     ...content...
	 *   </DialogColumnPanel>
	 *
	 * Provides a darker background panel typically used in the last column
	 * of multi-column dialogs.
	 */
	let { children } = $props();
</script>

<div class="panel">
	{@render children()}
</div>

<style>
	.panel {
		background: #f6f6f6;
		border-radius: 6px;
		padding: 15px;
		height: 100%;
		box-sizing: border-box;
	}
</style>
