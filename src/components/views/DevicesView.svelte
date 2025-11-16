<script>
    import { Icon } from 'svelte-icon';
    import { DEVICE_TYPES, Device } from '../../lib/devices.js';
    import { canLinkDevices, applyLinkedValues, getMappedChannels, getAvailableSyncControls } from '../../lib/channelMapping.js';
    import { getDeviceColor } from '../../lib/colorUtils.js';
    import Controls from '../controls/Controls.svelte';
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';
    import IconButton from '../common/IconButton.svelte';

    import editIcon from '../../assets/glyphs/edit.svg?raw';
    import linkedIcon from '../../assets/icons/linked.svg?raw';
    import removeIcon from '../../assets/icons/remove.svg?raw';

    let { dmxController, devices = $bindable([]) } = $props();

    // Device type selection
    let selectedType = $state('RGB');

    // Settings dialog state
    let settingsDialog = null; // DOM reference - should NOT be $state
    let customizeControlsDialog = null; // DOM reference - should NOT be $state
    let editingDevice = $state(null);
    let dialogName = $state('');
    let dialogChannel = $state(1);
    let selectedLinkTarget = $state(null);
    let selectedSyncControls = $state(null); // Array of control names, or null for all
    let mirrorPan = $state(false);

    // Drag and drop state
    let draggedDevice = $state(null);
    let draggedIndex = $state(null);
    let dragOverIndex = $state(null);
    let isAfterMidpoint = $state(false);
    let lastMouseDownTarget = null;

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

    function openSettingsDialog(device) {
        editingDevice = device;
        dialogName = device.name;
        dialogChannel = device.startChannel + 1;
        selectedLinkTarget = device.linkedTo || null;
        selectedSyncControls = device.syncedControls || null;
        mirrorPan = device.mirrorPan || false;

        // Wait for Dialog to mount before showing
        requestAnimationFrame(() => {
            settingsDialog?.showModal();
        });
    }

    function closeSettingsDialog() {
        settingsDialog?.close();
        editingDevice = null;
        dialogName = '';
        selectedLinkTarget = null;
        selectedSyncControls = null;
        mirrorPan = false;
    }

    function openCustomizeControlsDialog() {
        customizeControlsDialog?.showModal();
    }

    function closeCustomizeControlsDialog() {
        customizeControlsDialog?.close();
    }

    function confirmRemoveDevice() {
        if (!editingDevice) return;

        if (confirm(`Are you sure you want to remove "${editingDevice.name}"?`)) {
            removeDevice(editingDevice.id);
            closeSettingsDialog();
        }
    }

    // Generate CSS ID preview from current dialog name
    function getPreviewCssId() {
        const name = dialogName.trim() || editingDevice?.name || '';
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function saveDeviceSettings() {
        if (!editingDevice) return;

        // Validate channel
        if (!isChannelValid(editingDevice, dialogChannel - 1)) {
            return;
        }

        const newStartChannel = Math.max(0, Math.min(511, dialogChannel - 1));
        const newName = dialogName.trim() || editingDevice.name;

        // Only preserve cssId if name hasn't changed, otherwise regenerate
        const preserveCssId = newName === editingDevice.name ? editingDevice.cssId : null;

        // Create new Device instance with all updated properties
        // If not linking, clear sync controls and mirror pan
        const updatedDevice = new Device(
            editingDevice.id,
            editingDevice.type,
            newStartChannel,
            newName,
            selectedLinkTarget,
            preserveCssId,
            selectedLinkTarget !== null ? selectedSyncControls : null,
            selectedLinkTarget !== null ? mirrorPan : false
        );
        updatedDevice.defaultValues = [...editingDevice.defaultValues];

        // If linking, apply values from source device
        if (selectedLinkTarget !== null) {
            const sourceDevice = devices.find(d => d.id === selectedLinkTarget);
            if (sourceDevice) {
                const newValues = applyLinkedValues(
                    sourceDevice.type,
                    updatedDevice.type,
                    sourceDevice.defaultValues,
                    updatedDevice.defaultValues,
                    selectedSyncControls,
                    mirrorPan
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
        devices = devices.map(d => d.id === editingDevice.id ? updatedDevice : d);

        closeSettingsDialog();
    }

    function isChannelValid(device, startChannel0indexed) {
        const deviceChannels = DEVICE_TYPES[device.type].channels;
        const endChannel = startChannel0indexed + deviceChannels;

        // Check if device would exceed channel 512
        if (endChannel > 512 || startChannel0indexed < 0) return false;

        // Check for overlaps with other devices
        for (let otherDevice of devices) {
            if (otherDevice.id === device.id) continue;

            const otherChannels = DEVICE_TYPES[otherDevice.type].channels;
            const otherStart = otherDevice.startChannel;
            const otherEnd = otherStart + otherChannels;

            // Check if ranges overlap
            if (startChannel0indexed < otherEnd && endChannel > otherStart) {
                return false;
            }
        }

        return true;
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

    function getLinkableDevices(device) {
        return devices.filter(d =>
            d.id !== device.id &&
            !d.isLinked() && // Can't link to a device that's already linked
            canLinkDevices(device.type, d.type) &&
            d.linkedTo !== device.id // Don't allow circular links
        );
    }

    function getDisabledChannels(device) {
        if (!device.linkedTo) return [];

        const sourceDevice = devices.find(d => d.id === device.linkedTo);
        if (!sourceDevice) return [];

        return getMappedChannels(sourceDevice.type, device.type, device.syncedControls);
    }

    // Get available sync controls for current link target
    function getAvailableControlsForLink() {
        if (!selectedLinkTarget || !editingDevice) return [];

        const sourceDevice = devices.find(d => d.id === selectedLinkTarget);
        if (!sourceDevice) return [];

        return getAvailableSyncControls(sourceDevice.type, editingDevice.type);
    }

    // Toggle a sync control selection
    function toggleSyncControl(controlName) {
        if (selectedSyncControls === null) {
            // If currently syncing all, create array with all except this one
            const available = getAvailableControlsForLink();
            selectedSyncControls = available
                .map(c => c.controlName)
                .filter(name => name !== controlName);
        } else if (selectedSyncControls.includes(controlName)) {
            // Remove from array
            selectedSyncControls = selectedSyncControls.filter(name => name !== controlName);
            // If all controls are deselected, set to empty array (none synced)
        } else {
            // Add to array
            selectedSyncControls = [...selectedSyncControls, controlName];
        }
    }

    // Check if a control is currently selected for syncing
    function isSyncControlSelected(controlName) {
        if (selectedSyncControls === null) return true; // All controls selected
        return selectedSyncControls.includes(controlName);
    }

    // Check if Pan/Tilt control is available for current link
    function isPanTiltControlAvailable() {
        const available = getAvailableControlsForLink();
        return available.some(c => c.controlName === 'Pan/Tilt');
    }

    // Restore all device values to DMX controller on load
    $effect(() => {
        if (dmxController) {
            devices.forEach(device => {
                updateDeviceToDMX(device);
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
                    <div
                        class="color-preview"
                        style="background-color: {getDeviceColor(device.type, device.defaultValues)}"
                    ></div>
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

{#if editingDevice}
<Dialog
    bind:dialogRef={settingsDialog}
    title="Device"
    onclose={closeSettingsDialog}
>
    <form id="device-settings-form" method="dialog" onsubmit={(e) => { e.preventDefault(); saveDeviceSettings(); }}>
        <div class="dialog-input-group">
            <label for="name-input">Name:</label>
            <input
                id="name-input"
                type="text"
                bind:value={dialogName}
                placeholder="Device name"
            />

            <div class="css-identifiers">
                <code class="css-identifier">#{getPreviewCssId()}</code>
            </div>
        </div>

        <div class="dialog-input-group">
            <label for="channel-input">Starting channel (1-512):</label>
            <input
                id="channel-input"
                type="number"
                min="1"
                max="512"
                bind:value={dialogChannel}
                class:valid={isChannelValid(editingDevice, dialogChannel - 1)}
                class:invalid={!isChannelValid(editingDevice, dialogChannel - 1)}
            />
            <small class="channel-range">
                Device uses {DEVICE_TYPES[editingDevice.type].channels} channels:
                {dialogChannel}-{dialogChannel + DEVICE_TYPES[editingDevice.type].channels - 1}
            </small>
        </div>

        <div class="dialog-input-group">
            <label for="link-select">Link to device:</label>
            {#if getLinkableDevices(editingDevice).length > 0 || editingDevice.isLinked()}
                <div class="link-select-row">
                    <select id="link-select" bind:value={selectedLinkTarget}>
                        <option value={null}>None</option>
                        {#each getLinkableDevices(editingDevice) as linkableDevice}
                            <option value={linkableDevice.id}>
                                {linkableDevice.name} ({DEVICE_TYPES[linkableDevice.type].name})
                            </option>
                        {/each}
                    </select>
                    {#if selectedLinkTarget !== null}
                        <Button onclick={openCustomizeControlsDialog} variant="secondary">
                            Customize
                        </Button>
                    {/if}
                </div>
                <small class="link-help">Link this device to follow another device's values</small>
            {:else}
                <p class="no-devices">No compatible devices available to link</p>
            {/if}
        </div>
    </form>

    {#snippet tools()}
        <Button onclick={confirmRemoveDevice} variant="secondary">
            {@html removeIcon}
            Delete
        </Button>
    {/snippet}

    {#snippet buttons()}
        <Button onclick={closeSettingsDialog} variant="secondary">Cancel</Button>
        <Button
            type="submit"
            form="device-settings-form"
            variant="primary"
            disabled={!isChannelValid(editingDevice, dialogChannel - 1)}
        >
            Save
        </Button>
    {/snippet}
</Dialog>
{/if}

<Dialog
    bind:dialogRef={customizeControlsDialog}
    title="Customize Synced Controls"
    onclose={closeCustomizeControlsDialog}
>
    <div class="customize-controls-content">
        <p class="dialog-description">Select which controls to sync from the linked device:</p>
        <div class="sync-controls-vertical">
            {#each getAvailableControlsForLink() as control}
                <div class="sync-control-row">
                    <label class="sync-control-item">
                        <input
                            type="checkbox"
                            checked={isSyncControlSelected(control.controlName)}
                            onchange={() => toggleSyncControl(control.controlName)}
                        />
                        <span>{control.controlName}</span>
                    </label>
                    {#if control.controlName === 'Pan/Tilt'}
                        <label class="mirror-option">
                            <input
                                type="checkbox"
                                bind:checked={mirrorPan}
                                disabled={!isSyncControlSelected('Pan/Tilt')}
                            />
                            <span>Mirror pan</span>
                        </label>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    {#snippet buttons()}
        <Button onclick={closeCustomizeControlsDialog} variant="primary">Done</Button>
    {/snippet}
</Dialog>
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

    .color-preview {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }

    .device-header h3 {
        margin: 0;
        font-size: 11pt;
        color: #333;
    }

    .device-header :global(.icon-button) {
        margin-left: auto;
    }

    /* Dialog-specific overrides */
    .dialog-input-group input[type="number"] {
        width: 10ch;
    }

    .no-devices {
        margin: 0;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
        color: #999;
        text-align: center;
        font-size: 10pt;
    }

    .sync-controls-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px;
        background: #f9f9f9;
        border-radius: 4px;
        border: 1px solid #e0e0e0;
    }

    .sync-control-item {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
    }

    .sync-control-item input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
    }

    .sync-control-item span {
        font-size: 10pt;
        color: #333;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        padding: 8px 0;
    }

    .checkbox-label input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
    }

    .checkbox-label span {
        font-size: 10pt;
        color: #333;
    }

    .link-select-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .link-select-row select {
        flex: 1;
    }

    .customize-controls-content {
        min-width: 400px;
    }

    .dialog-description {
        margin: 0 0 16px 0;
        font-size: 10pt;
        color: #666;
    }

    .sync-controls-vertical {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .sync-control-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 12px;
        background: #f9f9f9;
        border-radius: 4px;
        border: 1px solid #e0e0e0;
    }

    .mirror-option {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
        margin-left: auto;
        font-size: 9pt;
        color: #666;
    }

    .mirror-option input[type="checkbox"]:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .mirror-option input[type="checkbox"] {
        cursor: pointer;
        width: 14px;
        height: 14px;
    }
</style>
