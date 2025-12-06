<script>
	/**
	 * SelectColorField - A select field with color preview
	 *
	 * Usage:
	 *   <InputGroup label="Color:" for="input-color">
	 *     <SelectColorField id="input-color" bind:value={selectedColor} />
	 *   </InputGroup>
	 *
	 * @prop {string} id - The id for the select element (for label association)
	 * @prop {string} value - The bound color value (use bind:value)
	 * @prop {boolean} [disabled] - Whether the select is disabled
	 * @prop {function} [onchange] - Change event handler
	 */
	import SelectField from './SelectField.svelte';
	import { getPalette, paletteColorToHex } from '../../lib/inputs/colors.js';

	let {
		id,
		value = $bindable(),
		disabled = false,
		onchange = undefined
	} = $props();
</script>

<div class="color-select-wrapper">
	<div class="color-preview" style="background-color: {paletteColorToHex(value)}"></div>
	<SelectField {id} bind:value {disabled} {onchange}>
		{#each getPalette() as color}
			<option value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
		{/each}
	</SelectField>
</div>

<style>
	.color-select-wrapper {
		display: flex;
		gap: 8px;
	}

	.color-preview {
		width: 48px;
		height: 100%;
		border-radius: 4px;
		box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
