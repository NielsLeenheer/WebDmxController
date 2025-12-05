<script>
	/**
	 * DialogColumns - Reusable column layout for dialogs
	 *
	 * Usage:
	 *   <DialogColumns layout={['180px', 'line', '180px', '350px']}>
	 *     {#snippet column1()}...{/snippet}
	 *     {#snippet column2()}...{/snippet}
	 *     {#snippet column3()}...{/snippet}
	 *   </DialogColumns>
	 *
	 * The layout array defines the structure:
	 * - Width values (e.g., '180px', '1fr', 'auto') define columns
	 * - 'line' adds a vertical divider between columns
	 *
	 * A 20px gap is automatically added between all elements.
	 * Column widths are exact - dividers are separate grid items.
	 *
	 * @prop {Array<string>} layout - Array of column widths and 'line' dividers
	 * @snippet column1 - Content for the first column
	 * @snippet column2 - Content for the second column (if present)
	 * @snippet column3 - Content for the third column (if present)
	 */
	let {
		layout = ['180px', '180px'],
		column1,
		column2,
		column3
	} = $props();

	// Parse layout into grid items (columns and dividers)
	let gridItems = $derived.by(() => {
		const items = [];
		let colIndex = 0;

		for (let i = 0; i < layout.length; i++) {
			const item = layout[i];

			if (item === 'line') {
				items.push({ type: 'divider' });
			} else {
				colIndex++;
				items.push({
					type: 'column',
					width: item,
					index: colIndex
				});
			}
		}

		return items;
	});

	// Build grid-template-columns CSS value
	let gridTemplate = $derived(
		gridItems.map(item => item.type === 'divider' ? '1px' : item.width).join(' ')
	);

	// Get snippet by column index
	function getSnippet(index) {
		switch (index) {
			case 1: return column1;
			case 2: return column2;
			case 3: return column3;
			default: return null;
		}
	}
</script>

<div class="dialog-columns" style="grid-template-columns: {gridTemplate};">
	{#each gridItems as item}
		{#if item.type === 'divider'}
			<div class="divider"></div>
		{:else}
			{@const snippet = getSnippet(item.index)}
			<div class="column">
				{#if snippet}
					{@render snippet()}
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.dialog-columns {
		display: grid;
		gap: 20px;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.divider {
		background: #ddd;
	}
</style>
