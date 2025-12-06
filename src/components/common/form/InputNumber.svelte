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
