<script>
	import Group from './Group.svelte';
	import InputNumber from './InputNumber.svelte';
	import InputCheckbox from './InputCheckbox.svelte';
	import SelectField from './SelectField.svelte';

	/**
	 * AnimationPicker - A reusable component for selecting an animation with duration, looping, and easing options
	 *
	 * Usage:
	 *   <AnimationPicker
	 *     animations={availableAnimations}
	 *     bind:animation={selectedAnimation}
	 *     bind:duration={duration}
	 *     bind:looping={looping}
	 *     bind:easing={easing}
	 *   />
	 */

	let {
		animations = [],
		animation = $bindable(null),
		duration = $bindable(1000),
		looping = $bindable(true),
		easing = $bindable('linear'),
		disabled = false
	} = $props();

	const EASING_FUNCTIONS = [
		'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
		'cubic-bezier(0.4, 0.0, 0.2, 1)',
		'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
	];

	let controlsDisabled = $derived(disabled || !animation);
</script>

<Group label="Animation:">
	<SelectField bind:value={animation} {disabled}>
		{#each animations as anim}
			<option value={anim.id}>{anim.name}</option>
		{/each}
	</SelectField>
</Group>

<Group label="Duration (ms):">
	<div class="duration-with-loop">
		<InputNumber
			bind:value={duration}
			min={100}
			step={100}
			disabled={controlsDisabled}
		/>
		<InputCheckbox
			bind:checked={looping}
			label="Loop"
			disabled={controlsDisabled}
		/>
	</div>
</Group>

<Group label="Easing:">
	<SelectField bind:value={easing} disabled={controlsDisabled}>
		{#each EASING_FUNCTIONS as easingFn}
			<option value={easingFn}>{easingFn}</option>
		{/each}
	</SelectField>
</Group>

<style>
	.duration-with-loop {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.duration-with-loop :global(input[type="number"]) {
		flex: 1;
		max-width: 120px;
	}
</style>
