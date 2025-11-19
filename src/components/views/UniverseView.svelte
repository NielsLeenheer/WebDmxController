<script>
    import { onMount, onDestroy } from 'svelte';

    let { dmxController, isActive = false } = $props();

    let universe = $state(new Array(512).fill(0));
    let updateInterval;

    // Update local universe state when dmxController changes
    function updateUniverse() {
        if (dmxController) {
            universe = Array.from(dmxController.getUniverse());
        }
    }

    onMount(() => {
        // Periodically sync universe state
        updateInterval = setInterval(updateUniverse, 100);
    });

    onDestroy(() => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // Re-output universe values when Universe tab becomes active
    // This ensures universe values are restored when switching from other tabs
    $effect(() => {
        if (isActive && dmxController) {
            universe.forEach((value, channel) => {
                dmxController.setChannel(channel, value);
            });
        }
    });

    function handleChannelChange(channel, event) {
        const value = parseInt(event.target.value) || 0;
        if (dmxController) {
            dmxController.setChannel(channel, value);
        }
        universe[channel] = value;
    }
</script>

<div class="universe-container">
    <div class="channels-grid">
        {#each universe as value, channel}
            <div class="channel">
                <label for="ch-{channel}">{channel + 1}</label>
                <input
                    id="ch-{channel}"
                    type="number"
                    min="0"
                    max="255"
                    value={value}
                    onchange={(e) => handleChannelChange(channel, e)}
                />
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
        margin-bottom: 20px;
    }

    .universe-header h2 {
        margin: 0 0 5px 0;
        font-size: 16pt;
        color: #333;
    }

    .universe-header p {
        margin: 0;
        color: #666;
        font-size: 10pt;
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
</style>
