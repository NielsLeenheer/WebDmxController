<script>
    import Dialog from '../common/Dialog.svelte';
    import Button from '../common/Button.svelte';

    let {
        laserManager,
        onclose
    } = $props();

    let dialogRef = $state(null);
    let deviceId = $state(null);

    let pps = $state(30000);
    let targetFps = $state(30);
    let blankingPoints = $state(15);
    let blankingDwell = $state(5);
    let cornerDwell = $state(3);
    let velocityDimming = $state(0.5);

    let pointsPerFrame = $derived(Math.floor(pps / targetFps));

    let originalSettings = null;

    export function show(id) {
        deviceId = id;
        loadFromDevice();
        originalSettings = { pps, targetFps, blankingPoints, blankingDwell, cornerDwell, velocityDimming };
        requestAnimationFrame(() => dialogRef?.showModal());
    }

    function applySettings() {
        if (!deviceId) return;
        laserManager?.updateDeviceSettings(deviceId, {
            pps, targetFps,
            blankingPoints, blankingDwell, cornerDwell,
            velocityDimming
        });
    }

    function handleSave() {
        applySettings();
        dialogRef?.close();
    }

    function handleCancel() {
        if (originalSettings && deviceId) {
            laserManager?.updateDeviceSettings(deviceId, originalSettings);
        }
        dialogRef?.close();
        if (onclose) onclose();
    }

    function loadFromDevice() {
        const settings = deviceId ? laserManager?.getDeviceSettings(deviceId) : null;
        if (settings) {
            pps = settings.pps ?? 30000;
            targetFps = settings.targetFps ?? 30;
            blankingPoints = settings.blankingPoints ?? 15;
            blankingDwell = settings.blankingDwell ?? 5;
            cornerDwell = settings.cornerDwell ?? 3;
            velocityDimming = settings.velocityDimming ?? 0.5;
        }
    }
</script>

<Dialog
    bind:dialogRef
    title="ILDA Settings"
    onclose={handleCancel}
>
    <div class="settings-content">
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { pps = 30000; applySettings(); }}>PPS</span>
            <input type="range" min="7000" max="65535" step="1000" bind:value={pps} oninput={applySettings} />
            <span class="setting-value">{(pps / 1000).toFixed(0)}k</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { targetFps = 30; applySettings(); }}>FPS</span>
            <input type="range" min="5" max="60" step="1" bind:value={targetFps} oninput={applySettings} />
            <span class="setting-value">{targetFps}</span>
        </div>
        <div class="setting-computed">
            <span class="setting-label">Points/frame</span>
            <span class="setting-value computed">{pointsPerFrame}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { blankingPoints = 15; applySettings(); }}>Blanking</span>
            <input type="range" min="5" max="30" step="1" bind:value={blankingPoints} oninput={applySettings} />
            <span class="setting-value">{blankingPoints}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { blankingDwell = 5; applySettings(); }}>Dwell</span>
            <input type="range" min="1" max="30" step="1" bind:value={blankingDwell} oninput={applySettings} />
            <span class="setting-value">{blankingDwell}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { cornerDwell = 3; applySettings(); }}>Corner Dwell</span>
            <input type="range" min="1" max="10" step="1" bind:value={cornerDwell} oninput={applySettings} />
            <span class="setting-value">{cornerDwell}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { velocityDimming = 0.5; applySettings(); }}>Vel. Dimming</span>
            <input type="range" min="0" max="1" step="0.05" bind:value={velocityDimming} oninput={applySettings} />
            <span class="setting-value">{Math.round(velocityDimming * 100)}%</span>
        </div>
    </div>

    {#snippet buttons()}
        <Button onclick={handleCancel} variant="secondary">Cancel</Button>
        <Button onclick={handleSave} variant="primary">Save</Button>
    {/snippet}
</Dialog>

<style>
    .settings-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 340px;
    }

    .setting-slider {
        display: grid;
        grid-template-columns: 80px 1fr 36px;
        gap: 8px;
        align-items: center;
    }

    .setting-computed {
        display: grid;
        grid-template-columns: 80px 1fr 36px;
        gap: 8px;
        align-items: center;
    }

    .setting-label {
        font-size: 9pt;
        color: #333;
    }

    .setting-label.clickable {
        cursor: pointer;
    }

    .setting-label.clickable:hover {
        color: #1976d2;
    }

    .setting-value {
        font-size: 9pt;
        font-family: var(--font-stack-mono);
        color: #666;
        text-align: right;
    }

    .setting-value.computed {
        grid-column: 3;
        color: #1976d2;
        font-weight: 600;
    }

    .setting-slider input[type="range"] {
        width: 100%;
        height: 4px;
        accent-color: #1976d2;
    }
</style>
