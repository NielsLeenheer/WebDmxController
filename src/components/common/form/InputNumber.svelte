<script>
	/**
	 * InputNumber - A number input field with validation styling
	 *
	 * Props:
	 * - id: Input element id
	 * - value: Bindable number value
	 * - min: Minimum value (optional)
	 * - max: Maximum value (optional)
	 * - step: Step value (optional)
	 * - disabled: Whether the input is disabled (optional)
	 * - valid: Whether the current value is valid (optional, for styling)
	 */

	let {
		id,
		value = $bindable(),
		min = undefined,
		max = undefined,
		step = undefined,
		disabled = false,
		valid = true
	} = $props();
</script>

<input
	{id}
	type="number"
	{min}
	{max}
	{step}
	{disabled}
	bind:value={value}
	class:valid
	class:invalid={!valid}
/>

<style>
	input {
		width: 100%;
		padding: 8px 12px;
		font-size: 11pt;
		border: 2px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #2196F3;
	}

	input.valid {
		border-color: #4caf50;
		background: #f0fdf0;
	}

	input.invalid {
		border-color: #ff4444;
		background: #fff5f5;
	}
</style>
