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

	/* InputGroup styling within panels - horizontal layout */
	.panel :global(.dialog-input-group) {
		display: flex;
		align-items: baseline;
		margin-bottom: 10px;
	}

	.panel :global(.dialog-input-group > label) {
		width: 120px;
		flex-shrink: 0;
	}

	/* Controls styling within panels */
	.panel :global(.controls) {
		margin: 0;
		grid-template-columns: 20px 5em 1fr 3em;
	}

	.panel :global(.controls .control) {
		margin-bottom: 8px;
	}
</style>
