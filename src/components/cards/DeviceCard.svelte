<script>
	import { Icon } from 'svelte-icon';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getMappedControls } from '../../lib/outputs/sync.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import CardHeader from '../common/CardHeader.svelte';
	import Controls from '../controls/Controls.svelte';
	import IconButton from '../common/IconButton.svelte';
	import Preview from '../common/Preview.svelte';

	import dotsIcon from '../../assets/glyphs/dots.svg?raw';
	import linkedIcon from '../../assets/icons/linked.svg?raw';

	let {
		device,       // Device object
		dnd,          // Drag-and-drop helper
		devices,      // All devices (for linked device lookup)
		onEdit,       // Callback when edit button clicked
		onValueChange // Callback when device value changes
	} = $props();

	let menuButtonRef = $state(null);

	/**
	 * Get disabled controls for this device based on linked device
	 */
	function getDisabledControls() {
		if (!device.linkedTo) return [];

		const sourceDevice = devices.find(d => d.id === device.linkedTo);
		if (!sourceDevice) return [];

		return getMappedControls(sourceDevice.type, device.type, device.syncedControls);
	}

	let disabledControls = $derived(getDisabledControls());
</script>

<DraggableCard {dnd} item={device} class="device-card">
	<CardHeader>
		<Preview
			type="device"
			size="medium"
			data={device}
		/>
		<h3>{device.name}</h3>
		{#if device.linkedTo !== null}
			<Icon data={linkedIcon} />
		{/if}
		<IconButton
			bind:buttonRef={menuButtonRef}
			icon={dotsIcon}
			onclick={() => onEdit?.(device, menuButtonRef)}
			title="Device settings"
			size="small"
		/>
	</CardHeader>

	<Controls
		controls={DEVICE_TYPES[device.type].controls}
		values={device.defaultValues}
		onChange={(controlId, value) => onValueChange?.(device, controlId, value)}
		disabledControls={disabledControls}
	/>
</DraggableCard>

<style>

	:global(.card-header) h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    :global(.card-header) :global(.icon-button) {
        margin-left: auto;
    }

</style>