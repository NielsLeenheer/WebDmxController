<script>
	import { Icon } from 'svelte-icon';
	import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
	import { getMappedChannels } from '../../lib/channelMapping.js';
	import { getDeviceColor } from '../../lib/colorUtils.js';
	import DraggableCard from '../common/DraggableCard.svelte';
	import CardHeader from '../common/CardHeader.svelte';
	import Controls from '../controls/Controls.svelte';
	import IconButton from '../common/IconButton.svelte';
	import Preview from '../common/Preview.svelte';

	import editIcon from '../../assets/glyphs/edit.svg?raw';
	import linkedIcon from '../../assets/icons/linked.svg?raw';

	let {
		device,       // Device object
		dnd,          // Drag-and-drop helper
		devices,      // All devices (for linked device lookup)
		onSettings,   // Callback when settings button clicked
		onValueChange // Callback when device value changes
	} = $props();

	/**
	 * Get disabled channels for this device based on linked device
	 */
	function getDisabledChannels() {
		if (!device.linkedTo) return [];

		const sourceDevice = devices.find(d => d.id === device.linkedTo);
		if (!sourceDevice) return [];

		return getMappedChannels(sourceDevice.type, device.type, device.syncedControls);
	}

	let disabledChannels = $derived(getDisabledChannels());
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
			icon={editIcon}
			onclick={() => onSettings?.(device)}
			title="Device settings"
			size="small"
		/>
	</CardHeader>

	<Controls
		controls={DEVICE_TYPES[device.type].controls}
		components={DEVICE_TYPES[device.type].components}
		values={device.defaultValues}
		onChange={(channelIndex, value) => onValueChange?.(device, channelIndex, value)}
		disabledChannels={disabledChannels}
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