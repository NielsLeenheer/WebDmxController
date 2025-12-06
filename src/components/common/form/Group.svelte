<script>
	/**
	 * Group - A labeled input group for forms
	 *
	 * Usage:
	 *   <Group label="Name:" for="name-input">
	 *     <input id="name-input" type="text" bind:value={name} />
	 *   </Group>
	 *
	 * Or without a label:
	 *   <Group>
	 *     <Controls ... />
	 *   </Group>
	 *
	 * Wraps form controls with a consistent label and spacing.
	 * Children are wrapped in a div to allow multiple elements.
	 *
	 * @prop {string} [label] - The label text to display (optional)
	 * @prop {string} [for] - The id of the form element (for accessibility)
	 */
	let {
		label = undefined,
		for: forId = undefined,
		children
	} = $props();
</script>

<div class="input-group">
	{#if label}
		<label for={forId}>{label}</label>
	{/if}
	<div>
		{@render children()}
	</div>
</div>

<style>

	.input-group {
		margin-bottom: 20px;
		max-width: -webkit-fill-available;
	}

	.input-group > label {
		display: block;
		margin-bottom: 8px;
		font-size: 10pt;
		font-weight: 400;
		color: #555;
	}

	.input-group :global(small) {
		display: block;
		margin-top: 8px;
		font-size: 8pt;
		color: #888;
	}

</style>