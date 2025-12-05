<script>
	/**
	 * InputGroup - A labeled input group for dialog forms
	 *
	 * Usage:
	 *   <InputGroup label="Name:" for="name-input">
	 *     <input id="name-input" type="text" bind:value={name} />
	 *   </InputGroup>
	 *
	 * Or without a label:
	 *   <InputGroup>
	 *     <Controls ... />
	 *   </InputGroup>
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

<div class="dialog-input-group">
	{#if label}
		<label for={forId}>{label}</label>
	{/if}
	<div>
		{@render children()}
	</div>
</div>
