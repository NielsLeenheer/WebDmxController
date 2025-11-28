<script>
    import { onMount, onDestroy } from 'svelte';
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { controlValuesToDMX } from '../../lib/outputs/controls.js';
    import { deviceLibrary } from '../../stores.svelte.js';
    import TabBar from '../common/TabBar.svelte';
    import Button from '../common/Button.svelte';

    import { Icon } from 'svelte-icon';
    import clearIcon from '../../assets/icons/clear.svg?raw';
    import restoreIcon from '../../assets/icons/restore.svg?raw';


    let { dmxController, isActive = false, mode = $bindable('view') } = $props();

    const modeTabs = [
        { id: 'view', label: 'View' },
        { id: 'edit', label: 'Edit' }
    ];

    // Universe values for display
    let viewUniverse = $state(new Array(512).fill(0));
    let editUniverse = $state(new Array(512).fill(0));

    // Current display values based on mode
    let universe = $derived(mode === 'view' ? viewUniverse : editUniverse);

    let updateInterval;

    // Update view universe from sampled values (read from DMX controller)
    function updateViewUniverse() {
        if (dmxController) {
            viewUniverse = Array.from(dmxController.getUniverse());
        }
    }

    // Copy default values from devices to edit universe
    function copyDefaultsToEditUniverse() {
        // Start with zeros
        const newEditUniverse = new Array(512).fill(0);

        // Copy default values from each device
        deviceLibrary.getAll().forEach(device => {
            const deviceType = DEVICE_TYPES[device.type];
            if (!deviceType) return;

            // Convert device default values to DMX array
            const dmxArray = controlValuesToDMX(deviceType, device.defaultValues);

            // Copy to edit universe at device's start channel
            dmxArray.forEach((value, index) => {
                const channel = device.startChannel + index;
                if (channel < 512) {
                    newEditUniverse[channel] = value;
                }
            });
        });

        editUniverse = newEditUniverse;
    }

    // Clear all edit universe values to 0
    function clearEditUniverse() {
        editUniverse = new Array(512).fill(0);
        
        // Output zeros to DMX controller
        if (dmxController) {
            for (let channel = 0; channel < 512; channel++) {
                dmxController.setChannel(channel, 0);
            }
        }
    }

    onMount(() => {
        // Periodically update view universe with sampled values
        updateInterval = setInterval(updateViewUniverse, 100);
    });

    onDestroy(() => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // When switching to edit mode, copy default values
    $effect(() => {
        if (mode === 'edit') {
            copyDefaultsToEditUniverse();
        }
    });

    // Output DMX values when in edit mode and tab is active
    $effect(() => {
        if (isActive && dmxController && mode === 'edit') {
            editUniverse.forEach((value, channel) => {
                dmxController.setChannel(channel, value);
            });
        }
    });

    function handleChannelChange(channel, event) {
        if (mode !== 'edit') return;
        
        const value = Math.max(0, Math.min(255, parseInt(event.target.value) || 0));
        if (dmxController) {
            dmxController.setChannel(channel, value);
        }
        editUniverse[channel] = value;
    }

    // Restore edit universe to current default values from devices
    function restoreEditUniverse() {
        copyDefaultsToEditUniverse();
        
        // Output restored values to DMX controller
        if (dmxController) {
            editUniverse.forEach((value, channel) => {
                dmxController.setChannel(channel, value);
            });
        }
    }
</script>

<div class="universe-container">
    <div class="universe-header">
        <TabBar
            tabs={modeTabs}
            bind:activeTab={mode}
        />
        <div class="header-buttons">
            <Button 
                onclick={restoreEditUniverse} 
                variant="secondary"
                disabled={mode !== 'edit'}
            >
                <Icon data={restoreIcon} />
                Restore
            </Button>
            <Button 
                onclick={clearEditUniverse} 
                variant="secondary"
                disabled={mode !== 'edit'}
            >
                <Icon data={clearIcon} />
                Clear
            </Button>
        </div>
    </div>
    <div class="channels-grid">
        {#each universe as value, channel}
            <div class="channel" class:readonly={mode === 'view'}>
                <label for="ch-{channel}">{channel + 1}</label>
                {#if mode === 'view'}
                    <span class="value">{value}</span>
                {:else}
                    <input
                        id="ch-{channel}"
                        type="number"
                        min="0"
                        max="255"
                        value={value}
                        onchange={(e) => handleChannelChange(channel, e)}
                    />
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .universe-container {
        flex: 1;
        overflow: auto;
        padding: 20px;
    }

    .universe-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .header-buttons {
        display: flex;
        gap: 8px;
    }

    .channels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    }

    .channel {
        display: flex;
        flex-direction: row;
        background: white;
        border: 1px solid #fafafa;
        padding: 8px;
        align-items: baseline;
    }

    .channel label {
        font-size: 7pt;
        color: #ccc;
        margin-bottom: 4px;
        font-weight: 600;
        width: 7em;
    }

    .channel input {
        border: none;
        border-radius: 4px;
        padding: 6px;
        font-size: 10pt;
        font-family: var(--font-stack-mono);
        width: 7em;
    }

    .channel input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .channel .value {
        font-size: 10pt;
        font-family: var(--font-stack-mono);
        color: #888;
        padding: 6px 0;
        width: 7em;
        margin-left: -6px;
    }
</style>
