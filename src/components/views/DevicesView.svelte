<script>
    import { Icon } from 'svelte-icon';
    import { untrack } from 'svelte';
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { applyLinkedValues, getMappedChannels } from '../../lib/channelMapping.js';
    import { getDeviceColor } from '../../lib/colorUtils.js';
    import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
    import DraggableCard from '../common/DraggableCard.svelte';
    import CardHeader from '../common/CardHeader.svelte';
    import Controls from '../controls/Controls.svelte';
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Preview from '../common/Preview.svelte';
    import EditDeviceDialog from '../dialogs/EditDeviceDialog.svelte';

    import editIcon from '../../assets/glyphs/edit.svg?raw';
    import linkedIcon from '../../assets/icons/linked.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let { dmxController, deviceLibrary, isActive = false } = $props();

    // Get devices reactively - automatic thanks to $state in library!
    let devices = $derived(deviceLibrary.getAll());

    // Device type selection
    let selectedType = $state('RGB');

    // Dialog reference
    let editDeviceDialog;

    // Preview state for special device types
    let deviceFlamethrower = $state({});
    let deviceSmoke = $state({});

    // Drag and drop helper
    const dnd = createDragDrop({
        items: () => devices,
        onReorder: (orderedIds) => { deviceLibrary.reorder(orderedIds); },
        orientation: 'horizontal',
        dragByHeader: true
    });

    async function openSettingsDialog(device) {
        const result = await editDeviceDialog.open(device, devices);

        if (!result) return; // User cancelled

        if (result.delete) {
            // Handle delete
            removeDevice(device.id);
            return;
        }

        // Update device in library
        deviceLibrary.updateDevice(device.id, {
            startChannel: result.startChannel,
            name: result.name,
            linkedTo: result.linkedTo,
            syncedControls: result.syncedControls,
            mirrorPan: result.mirrorPan
        });

        // If linking, apply values from source device
        if (result.linkedTo !== null) {
            const sourceDevice = devices.find(d => d.id === result.linkedTo);
            if (sourceDevice) {
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    device.type,
                    sourceDevice.defaultValues,
                    device.defaultValues,
                    result.syncedControls,
                    result.mirrorPan
                );
                // Update values in place
                newValues.forEach((value, index) => {
                    device.defaultValues[index] = value;
                });
                deviceLibrary.save();
            }
        }

        // Update DMX controller with new channel values
        if (dmxController) {
            device.defaultValues.forEach((value, index) => {
                const channelIndex = device.startChannel + index;
                dmxController.setChannel(channelIndex, value);
            });
        }
    }


    function getNextFreeChannel() {
        if (devices.length === 0) return 0; // Channel 1 (0-indexed)

        // Find the highest used channel
        let maxChannel = 0;
        devices.forEach(device => {
            const deviceEndChannel = device.startChannel + DEVICE_TYPES[device.type].channels;
            if (deviceEndChannel > maxChannel) {
                maxChannel = deviceEndChannel;
            }
        });

        // Return next free channel, or wrap to 1 if over 512
        return maxChannel >= 512 ? 0 : maxChannel;
    }

    function validateDevice(device) {
        const deviceChannels = DEVICE_TYPES[device.type].channels;
        const deviceEnd = device.startChannel + deviceChannels;

        // Check if device goes beyond channel 512
        if (deviceEnd > 512) {
            return false;
        }

        // Check for overlaps with other devices
        for (let otherDevice of devices) {
            if (otherDevice.id === device.id) continue;

            const otherChannels = DEVICE_TYPES[otherDevice.type].channels;
            const otherStart = otherDevice.startChannel;
            const otherEnd = otherStart + otherChannels;

            // Check if ranges overlap
            if (device.startChannel < otherEnd && deviceEnd > otherStart) {
                return false;
            }
        }

        return true;
    }

    export function addDevice(type = selectedType) {
        const startChannel = getNextFreeChannel();
        deviceLibrary.create(type, startChannel);
    }

    function removeDevice(deviceId) {
        // Also unlink any devices linked to this one
        devices.forEach(d => {
            if (d.linkedTo === deviceId) {
                deviceLibrary.updateDevice(d.id, { linkedTo: null });
            }
        });
        deviceLibrary.remove(deviceId);
    }

    function handleDeviceValueChange(device, channelIndex, value) {
        // Update the device value in library (automatically propagates to linked devices)
        deviceLibrary.updateValue(device.id, channelIndex, value);

        // Update preview state for special device types
        if (device.type === 'FLAMETHROWER') {
            deviceFlamethrower[device.id] = {
                safety: device.defaultValues[0] || 0,
                fuel: device.defaultValues[1] || 0
            };
        } else if (device.type === 'SMOKE') {
            deviceSmoke[device.id] = {
                output: device.defaultValues[0] || 0
            };
        }

        // Update DMX controller
        updateDeviceToDMX(device);

        // Update all linked devices to DMX
        devices.forEach(d => {
            if (d.linkedTo === device.id) {
                updateDeviceToDMX(d);
            }
        });
    }

    function updateDeviceToDMX(device) {
        if (!dmxController) return;

        device.defaultValues.forEach((value, index) => {
            const channelIndex = device.startChannel + index;
            dmxController.setChannel(channelIndex, value);
        });
    }

    function getDisabledChannels(device) {
        if (!device.linkedTo) return [];

        const sourceDevice = devices.find(d => d.id === device.linkedTo);
        if (!sourceDevice) return [];

        return getMappedChannels(sourceDevice.type, device.type, device.syncedControls);
    }

    // Restore all device values to DMX controller on load (only when controller changes, not on devices updates)
    $effect(() => {
        if (dmxController) {
            // Use untrack to prevent this effect from re-running when devices array changes
            untrack(() => {
                devices.forEach(device => {
                    updateDeviceToDMX(device);
                });
            });
        }
    });

    // Re-output default device values when Devices tab becomes active
    // This ensures default values are restored when switching from other tabs
    $effect(() => {
        if (isActive && dmxController) {
            untrack(() => {
                devices.forEach(device => {
                    updateDeviceToDMX(device);
                });
            });
        }
    });
</script>

<div class="devices-container">
    <div class="add-device-section">
        <select bind:value={selectedType}>
            {#each Object.entries(DEVICE_TYPES) as [key, type]}
                <option value={key}>{type.name}</option>
            {/each}
        </select>
        <Button onclick={() => addDevice(selectedType)} variant="secondary">
            Add Device
        </Button>
    </div>

    <div class="devices-list">
        {#if devices.length === 0}
            <div class="empty-state">
                <p>No devices added yet. Add a device to get started!</p>
            </div>
        {/if}

        {#each devices as device, index (device.id)}
            <DraggableCard {dnd} item={device} {index} class="device-card">
                <CardHeader>
                    {#if device.type === 'FLAMETHROWER'}
                        {@const flame = deviceFlamethrower[device.id] || { safety: device.defaultValues[0] || 0, fuel: device.defaultValues[1] || 0 }}
                        <Preview
                            type="device"
                            size="medium"
                            controls={['fuel', 'safety']}
                            data={{ fuel: flame.fuel, safety: flame.safety }}
                        />
                    {:else if device.type === 'SMOKE'}
                        {@const smoke = deviceSmoke[device.id] || { output: device.defaultValues[0] || 0 }}
                        <Preview
                            type="device"
                            size="medium"
                            controls={['output']}
                            data={{ output: smoke.output }}
                        />
                    {:else}
                        <Preview
                            type="device"
                            size="medium"
                            controls={['color']}
                            data={{ color: getDeviceColor(device.type, device.defaultValues) }}
                        />
                    {/if}
                    <h3>{device.name}</h3>
                    {#if device.linkedTo !== null}
                        <Icon data={linkedIcon} />
                    {/if}
                    <IconButton
                        icon={editIcon}
                        onclick={() => openSettingsDialog(device)}
                        title="Device settings"
                        size="small"
                    />
                </CardHeader>

                <Controls
                    controls={DEVICE_TYPES[device.type].controls}
                    components={DEVICE_TYPES[device.type].components}
                    values={device.defaultValues}
                    onChange={(channelIndex, value) => handleDeviceValueChange(device, channelIndex, value)}
                    disabledChannels={getDisabledChannels(device)}
                />
            </DraggableCard>
        {/each}
    </div>

<!-- Edit Device Dialog -->
<EditDeviceDialog
    bind:this={editDeviceDialog}
/>
</div>

<style>
    .devices-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .add-device-section {
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
    }

    .add-device-section select {
        min-width: 200px;
        border: 2px solid #f0f0f0;
        cursor: pointer;
    }

    .add-device-section select:focus {
        outline: none;
        border-color: #2196F3;
    }

    .devices-list {
        overflow-y: auto;
        padding: 20px 40px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(16em, 1fr));
        gap: 15px;
    }

    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        min-height: 50vh;
        align-content: center;
        color: #999;
        font-size: 0.9em;
    }

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
