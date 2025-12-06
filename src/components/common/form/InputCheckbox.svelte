<script>
	/**
	 * InputCheckbox - A checkbox input with label and optional description
	 *
	 * Props:
	 * - checked: Bindable boolean value
	 * - label: Label text for the checkbox
	 * - description: Optional description text below the label
	 * - disabled: Whether the checkbox is disabled (optional)
	 */

	let {
		checked = $bindable(),
		label,
		description = '',
		disabled = false
	} = $props();
</script>

<div class="checkbox-field">
	<label>
		<input
			type="checkbox"
			bind:checked={checked}
			{disabled}
		/>
		{label}
	</label>
	{#if description}
		<p class="description">{description}</p>
	{/if}
</div>

<style>
	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 10pt;
		cursor: pointer;
	}

	.description {
		font-size: 9pt;
		color: #888;
		margin: 0;
		padding: 0;
		margin-top: 4px;
		margin-left: 24px;
	}
</style>
