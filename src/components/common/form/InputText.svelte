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
</style>
