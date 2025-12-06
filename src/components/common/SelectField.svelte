<script>
	/**
	 * SelectField - A styled select element for forms
	 *
	 * Usage:
	 *   <InputGroup label="Device:" for="device-select">
	 *     <SelectField id="device-select" bind:value={selectedDevice}>
	 *       {#each devices as device}
	 *         <option value={device.id}>{device.name}</option>
	 *       {/each}
	 *     </SelectField>
	 *   </InputGroup>
	 *
	 * @prop {string} id - The id for the select element (for label association)
	 * @prop {any} value - The bound value (use bind:value)
	 * @prop {boolean} [disabled] - Whether the select is disabled
	 * @prop {function} [onchange] - Change event handler
	 */
	let {
		id,
		value = $bindable(),
		disabled = false,
		onchange = undefined,
		children
	} = $props();
</script>

<select
	{id}
	bind:value
	{disabled}
	{onchange}
>
	{@render children()}
</select>

<style>
	select {
		height: auto;
		padding: 8px 32px 8px 12px;
		font-size: 11pt;
		border: 2px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
		max-width: 100%;
		background: white;
	}

	select:focus {
		outline: none;
		border-color: #2196F3;
	}

	select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
