<script>
    import { Icon } from 'svelte-icon';
    import { untrack } from 'svelte';
    import { DEVICE_TYPES, Device } from '../../lib/outputs/devices.js';
    import { canLinkDevices, applyLinkedValues, getMappedChannels, getAvailableSyncControls } from '../../lib/channelMapping.js';
    import { getDeviceColor } from '../../lib/colorUtils.js';
    import Controls from '../controls/Controls.svelte';
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';
    import Preview from '../common/Preview.svelte';
    import EditDeviceDialog from '../dialogs/EditDeviceDialog.svelte';

    import editIcon from '../../assets/glyphs/edit.svg?raw';
    import linkedIcon from '../../assets/icons/linked.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let { dmxController, devices = $bindable([]), isActive = false } = $props();

    // Device type selection
    let selectedType = $state('RGB');

    // Dialog reference
    let editDeviceDialog;

    // Drag and drop state
    let draggedDevice = $state(null);
    let draggedIndex = $state(null);
    let dragOverIndex = $state(null);
    let isAfterMidpoint = $state(false);
    let lastMouseDownTarget = null;

    // Preview state for special device types
    let deviceFlamethrower = $state({});
    let deviceSmoke = $state({});

    function handleMouseDown(event) {
        // Track where the mouse was pressed down
        lastMouseDownTarget = event.target;
    }

    function handleDragStart(event, device) {
        // Check where the mousedown happened (not where drag started)
        let clickedElement = lastMouseDownTarget;

        if (!clickedElement) {
            event.preventDefault();
            return;
        }

        // Check if mousedown was on an interactive element
        if (clickedElement.tagName === 'INPUT' ||
            clickedElement.tagName === 'BUTTON' ||
            clickedElement.tagName === 'TEXTAREA') {
            event.preventDefault();
            return;
        }

        // Walk up from the mousedown target to see if we're in header or controls
        let foundHeader = false;
        let foundControls = false;

        let el = clickedElement;
        while (el && el !== event.currentTarget) {
            if (el.classList) {
                if (el.classList.contains('device-header')) {
                    foundHeader = true;
                }
                if (el.classList.contains('controls') ||
                    el.classList.contains('control') ||
                    el.classList.contains('icon-button')) {
                    foundControls = true;
                }
            }
            el = el.parentElement;
        }

        // Only allow drag from header, not from controls
        if (!foundHeader || foundControls) {
            event.preventDefault();
            return;
        }

        draggedDevice = device;
        draggedIndex = devices.findIndex(d => d.id === device.id);
        event.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(event, index) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dragOverIndex = index;

        // Calculate if mouse is in the second half of the card
        const rect = event.currentTarget.getBoundingClientRect();
        const mouseX = event.clientX;
        const cardMidpoint = rect.left + rect.width / 2;
        isAfterMidpoint = mouseX > cardMidpoint;
    }

    function isDragAfter(index) {
        return dragOverIndex === index && isAfterMidpoint;
    }

    function handleDragLeave() {
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDrop(event, targetIndex) {
        event.preventDefault();

        if (!draggedDevice) return;

        const currentIndex = devices.findIndex(d => d.id === draggedDevice.id);
        if (currentIndex === -1) {
            draggedDevice = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Adjust target index based on whether we're inserting after the midpoint
        let insertIndex = targetIndex;
        if (isAfterMidpoint) {
            insertIndex = targetIndex + 1;
        }

        // If dragging from before to after in the same position, no change needed
        if (currentIndex === insertIndex || currentIndex === insertIndex - 1) {
            draggedDevice = null;
            draggedIndex = null;
            dragOverIndex = null;
            isAfterMidpoint = false;
            return;
        }

        // Reorder the array
        const newDevices = [...devices];
        const [removed] = newDevices.splice(currentIndex, 1);
        // Adjust insert position if we removed an item before it
        const finalInsertIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
        newDevices.splice(finalInsertIndex, 0, removed);
        devices = newDevices;

        draggedDevice = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    function handleDragEnd() {
        draggedDevice = null;
        draggedIndex = null;
        dragOverIndex = null;
        isAfterMidpoint = false;
    }

    async function openSettingsDialog(device) {
        const result = await editDeviceDialog.open(device, devices);

        if (!result) return; // User cancelled

        if (result.delete) {
            // Handle delete
            removeDevice(device.id);
            return;
        }

        // Handle save
        const newStartChannel = result.startChannel;
        const newName = result.name;

        // Only preserve cssId if name hasn't changed, otherwise regenerate
        const preserveCssId = newName === device.name ? device.cssId : null;

        // Create new Device instance with all updated properties
        const updatedDevice = new Device(
            device.id,
            device.type,
            newStartChannel,
            newName,
            result.linkedTo,
            preserveCssId,
            result.syncedControls,
            result.mirrorPan
        );
        updatedDevice.defaultValues = [...device.defaultValues];

        // If linking, apply values from source device
        if (result.linkedTo !== null) {
            const sourceDevice = devices.find(d => d.id === result.linkedTo);
            if (sourceDevice) {
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    updatedDevice.type,
                    sourceDevice.defaultValues,
                    updatedDevice.defaultValues,
                    result.syncedControls,
                    result.mirrorPan
                );
                updatedDevice.defaultValues = newValues;
            }
        }

        // Update DMX controller with new channel values
        if (dmxController) {
            updatedDevice.defaultValues.forEach((value, index) => {
                const channelIndex = updatedDevice.startChannel + index;
                dmxController.setChannel(channelIndex, value);
            });
        }

        // Update devices array
        devices = devices.map(d => d.id === device.id ? updatedDevice : d);
    }

    // Load initial state from localStorage
    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('dmx-devices');
            if (saved) {
                const data = JSON.parse(saved);
                // Reconstruct Device objects
                const loadedDevices = data.devices.map(d => {
                    const device = new Device(
                        d.id,
                        d.type,
                        d.startChannel,
                        d.name,
                        d.linkedTo,
                        d.cssId,
                        d.syncedControls || null,
                        d.mirrorPan || false
                    );
                    device.defaultValues = d.defaultValues || new Array(DEVICE_TYPES[d.type].channels).fill(0);
                    return device;
                });
                return {
                    devices: loadedDevices,
                    nextId: data.nextId || 1
                };
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return { devices: [], nextId: 1 };
    }

    // Initialize nextId - must be calculated from devices after loading
    const initialState = devices.length === 0 ? loadFromLocalStorage() : { devices, nextId: null };

    if (devices.length === 0) {
        devices = initialState.devices;
    }

    // Always calculate nextId from current devices to ensure uniqueness
    const maxId = devices.length > 0 ? Math.max(...devices.map(d => d.id)) : 0;
    let nextId = $state(Math.max(maxId + 1, initialState.nextId || 1));

    // Save to localStorage whenever devices change
    $effect(() => {
        try {
            const data = {
                devices: devices.map(d => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    startChannel: d.startChannel,
                    defaultValues: d.defaultValues,
                    linkedTo: d.linkedTo,
                    cssId: d.cssId,
                    syncedControls: d.syncedControls,
                    mirrorPan: d.mirrorPan
                })),
                nextId
            };
            localStorage.setItem('dmx-devices', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    });

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
        const device = new Device(nextId++, type, startChannel);
        devices = [...devices, device];
    }

    export function clearAllDeviceValues() {
        // Reset all device default values to 0
        devices = devices.map(d => {
            d.defaultValues = d.defaultValues.map(() => 0);
            return d;
        });
    }

    function removeDevice(deviceId) {
        // Also unlink any devices linked to this one
        devices = devices.map(d => {
            if (d.linkedTo === deviceId) {
                d.linkedTo = null;
            }
            return d;
        }).filter(d => d.id !== deviceId);
    }

    function handleDeviceValueChange(device, channelIndex, value) {
        // Create new device instance with updated value
        const updatedDevice = new Device(
            device.id,
            device.type,
            device.startChannel,
            device.name,
            device.linkedTo,
            device.cssId,
            device.syncedControls,
            device.mirrorPan
        );
        updatedDevice.defaultValues = [...device.defaultValues];
        updatedDevice.defaultValues[channelIndex] = value;

        // Update devices array with new instance
        devices = devices.map(d => d.id === device.id ? updatedDevice : d);

        // Update preview state for special device types
        if (updatedDevice.type === 'FLAMETHROWER') {
            deviceFlamethrower[updatedDevice.id] = {
                safety: updatedDevice.defaultValues[0] || 0,
                fuel: updatedDevice.defaultValues[1] || 0
            };
        } else if (updatedDevice.type === 'SMOKE') {
            deviceSmoke[updatedDevice.id] = {
                output: updatedDevice.defaultValues[0] || 0
            };
        }

        // Update DMX controller
        updateDeviceToDMX(updatedDevice);

        // Propagate to linked devices
        propagateToLinkedDevices(updatedDevice);
    }

    function updateDeviceToDMX(device) {
        if (!dmxController) return;

        device.defaultValues.forEach((value, index) => {
            const channelIndex = device.startChannel + index;
            dmxController.setChannel(channelIndex, value);
        });
    }

    function propagateToLinkedDevices(sourceDevice) {
        // Create new device instances for all linked devices
        devices = devices.map(device => {
            if (device.linkedTo === sourceDevice.id) {
                // Create new device instance to trigger reactivity
                const updatedDevice = new Device(
                    device.id,
                    device.type,
                    device.startChannel,
                    device.name,
                    device.linkedTo,
                    device.cssId,
                    device.syncedControls,
                    device.mirrorPan
                );

                // Apply linked values with selective syncing and pan mirroring
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    device.type,
                    sourceDevice.defaultValues,
                    device.defaultValues,
                    device.syncedControls,
                    device.mirrorPan
                );
                updatedDevice.defaultValues = newValues;

                // Update DMX
                updateDeviceToDMX(updatedDevice);

                return updatedDevice;
            }
            return device;
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
            <div
                class="device-card"
                class:dragging={draggedDevice?.id === device.id}
                class:drag-over={dragOverIndex === index && !isAfterMidpoint}
                class:drag-after={isDragAfter(index)}
                draggable="true"
                onmousedown={handleMouseDown}
                ondragstart={(e) => handleDragStart(e, device)}
                ondragover={(e) => handleDragOver(e, index)}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, index)}
                ondragend={handleDragEnd}
            >
                <div class="device-header">
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
                    {#if device.isLinked()}
                        <Icon data={linkedIcon} />
                    {/if}
                    <IconButton
                        icon={editIcon}
                        onclick={() => openSettingsDialog(device)}
                        title="Device settings"
                        size="small"
                    />
                </div>

                <Controls
                    controls={DEVICE_TYPES[device.type].controls}
                    components={DEVICE_TYPES[device.type].components}
                    values={device.defaultValues}
                    onChange={(channelIndex, value) => handleDeviceValueChange(device, channelIndex, value)}
                    disabledChannels={getDisabledChannels(device)}
                />
            </div>
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

    .device-card {
        background: #f0f0f0;
        border-radius: 8px;
        padding: 15px;
        transition: opacity 0.2s, transform 0.2s;
    }

    .device-card.dragging {
        opacity: 0.4;
    }

    .device-card.drag-over {
        position: relative;
    }

    .device-card.drag-over::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 0;
        bottom: 0;
        width: 4px;
        background: #2196F3;
        border-radius: 2px;
    }

    .device-card.drag-after::before {
        left: auto;
        right: -8px;
    }

    .device-header {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #e6e6e6;

        margin: -15px -15px 12px -15px;
        padding: 12px 15px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        cursor: grab;
    }

    .device-header:active {
        cursor: grabbing;
    }

    .device-header h3 {
        margin: 0;
        font-size: 11pt;
        font-weight: 600;
        color: #333;
    }

    .device-header :global(.icon-button) {
        margin-left: auto;
    }
</style>
