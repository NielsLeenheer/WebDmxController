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

    let stats = $state(null);
    let originalSettings = null;
    // Poll render stats from the manager while the dialog is visible so the
    // user can see how settings changes affect throughput and point mix.
    $effect(() => {
        if (!deviceId || !laserManager) return;
        const tick = () => { stats = laserManager.getDeviceStats(deviceId); };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    });


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
      <div class="settings-column">
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
      <div class="settings-column stats-column">
        {#if stats}
            <div class="stats-panel">
                <div class="stats-grid">
                    <span class="stats-label">FPS</span>
                    <span class="stats-value">{stats.framesPerSecond}</span>
                    <span class="stats-unit">/ {targetFps} target</span>

                    <span class="stats-label">Points/frame</span>
                    <span class="stats-value">{stats.pointsPerFrame}</span>
                    <span class="stats-unit">/ {stats.targetPoints || pointsPerFrame} budget</span>

                    <span class="stats-label stats-sub">Drawing</span>
                    <span class="stats-value stats-sub">{stats.drawingPoints}</span>
                    <span class="stats-unit">pts</span>

                    <span class="stats-label stats-sub">Blanking</span>
                    <span class="stats-value stats-sub">{stats.blankingPoints}</span>
                    <span class="stats-unit">pts</span>

                    <span class="stats-label stats-sub">Corner dwell</span>
                    <span class="stats-value stats-sub">{stats.cornerDwellPoints}</span>
                    <span class="stats-unit">pts</span>

                    <span class="stats-label stats-sub">Anchor dwell</span>
                    <span class="stats-value stats-sub">{stats.anchorDwellPoints}</span>
                    <span class="stats-unit">pts</span>

                    <span class="stats-label">Input</span>
                    <span class="stats-value">{stats.inputPoints}</span>
                    <span class="stats-unit">points</span>

                    <span class="stats-label">Process</span>
                    <span class="stats-value">{(stats.processMs ?? 0).toFixed(1)}</span>
                    <span class="stats-unit">ms/frame</span>

                    <span class="stats-label">Send</span>
                    <span class="stats-value">{(stats.sendMs ?? 0).toFixed(1)}</span>
                    <span class="stats-unit">ms/frame</span>

                    <span class="stats-label">Status poll</span>
                    <span class="stats-value">{(stats.statusMs ?? 0).toFixed(1)}</span>
                    <span class="stats-unit">ms</span>
                </div>
            </div>
        {/if}
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
        flex-direction: row;
        gap: 36px;
        min-width: 1000px;
        align-items: flex-start;
    }

    .settings-column {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-width: 300px;
    }

    .stats-column {
        flex: 0 0 260px;
        min-width: 260px;
    }

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

    .stats-panel {
        padding: 18px;
        background: #f7f7f7;
        border-radius: 10px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: auto auto 1fr;
        row-gap: 6px;
        column-gap: 8px;
        align-items: baseline;
    }

    .stats-label {
        font-size: 9pt;
        color: #555;
    }

    .stats-value {
        font-size: 9pt;
        font-family: var(--font-stack-mono);
        color: #1976d2;
        font-weight: 600;
        text-align: right;
        min-width: 48px;
    }

    .stats-unit {
        font-size: 8pt;
        color: #888;
    }

    .stats-label.stats-sub,
    .stats-value.stats-sub,
    .stats-unit.stats-sub {
        padding-left: 12px;
        color: #777;
        font-weight: 400;
    }
</style>
