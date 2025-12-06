<script>
	/**
	 * InputText - A text input field
	 *
	 * Props:
	 * - id: Input element id
	 * - value: Bindable string value
	 * - placeholder: Placeholder text (optional)
	 * - disabled: Whether the input is disabled (optional)
	 * - autofocus: Whether the input should be focused on mount (optional)
	 * - onkeydown: Key down event handler (optional)
	 */

	let {
		id,
		value = $bindable(),
		placeholder = '',
		disabled = false,
		autofocus = false,
		onkeydown = undefined
	} = $props();
</script>

<input
	{id}
	type="text"
	bind:value={value}
	{placeholder}
	{disabled}
	{autofocus}
	{onkeydown}
/>
