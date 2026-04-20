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
    let anchorDwell = $state(3);
    let windowWidth = $state(1.0);
    let windowSpeed = $state(0.0);
    let cornerMode = $state('binary');
    let cornerBias = $state(3);
    let cornerSharpness = $state(1);
    let velocityCap = $state(false);
    let maxStepDac = $state(400);

    let pointsPerFrame = $derived(Math.floor(pps / targetFps));

    let stats = $state(null);
    let visualizationCanvas = $state(null);
    // Visualization view state: zoom = 1 shows the full virtual [-1, 1]
    // field, panX/panY is the virtual coordinate at the canvas center.
    let visZoom = $state(1);
    let visPanX = $state(0);
    let visPanY = $state(0);
    let visPanning = $state(false);
    let visDragStart = { mx: 0, my: 0, panX: 0, panY: 0 };
    let originalSettings = null;

    const VIS_PADDING = 12;
    const VIS_ZOOM_MIN = 0.5;
    const VIS_ZOOM_MAX = 50;

    function visZoomBy(factor) {
        visZoom = Math.max(VIS_ZOOM_MIN, Math.min(VIS_ZOOM_MAX, visZoom * factor));
    }

    function resetVisView() {
        visZoom = 1;
        visPanX = 0;
        visPanY = 0;
    }

    function handleVisMouseDown(e) {
        visPanning = true;
        visDragStart = { mx: e.clientX, my: e.clientY, panX: visPanX, panY: visPanY };
        e.preventDefault();
    }

    function handleVisMouseMove(e) {
        if (!visPanning || !visualizationCanvas) return;
        const w = visualizationCanvas.width;
        const h = visualizationCanvas.height;
        const dx = e.clientX - visDragStart.mx;
        const dy = e.clientY - visDragStart.my;
        // Convert pixel drag to virtual-space pan (inverse of the vx/vy mapping).
        visPanX = visDragStart.panX - (dx * 2) / (visZoom * (w - 2 * VIS_PADDING));
        visPanY = visDragStart.panY - (dy * 2) / (visZoom * (h - 2 * VIS_PADDING));
    }

    function handleVisMouseUp() {
        visPanning = false;
    }

    function handleVisWheel(e) {
        e.preventDefault();
        visZoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }

    // Poll render stats from the manager while the dialog is visible so the
    // user can see how settings changes affect throughput and point mix.
    $effect(() => {
        if (!deviceId || !laserManager) return;
        const tick = () => { stats = laserManager.getDeviceStats(deviceId); };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    });

    // Live frame-plan visualization: thin lines + dots at every point so the
    // user can see exactly where the point budget is being spent. Drawing
    // points are the configured stroke colour; blanking/dwell show as
    // translucent gray. Coordinates are pre-calibration so keystone doesn't
    // warp the shape — this is purely an inspection view.
    $effect(() => {
        if (!visualizationCanvas || !laserManager) return;
        const ctx = visualizationCanvas.getContext('2d');
        const w = visualizationCanvas.width;
        const h = visualizationCanvas.height;
        let animId;

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, w, h);

            // Virtual-to-canvas mapping. visZoom > 1 zooms in; visPanX/Y is
            // the virtual coord at the canvas center.
            const padding = VIS_PADDING;
            const halfW = (w - 2 * padding) / 2;
            const halfH = (h - 2 * padding) / 2;
            const vx = (x) => padding + halfW + (x - visPanX) * visZoom * halfW;
            const vy = (y) => padding + halfH + (y - visPanY) * visZoom * halfH;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.strokeRect(vx(-1), vy(-1), vx(1) - vx(-1), vy(1) - vy(-1));
            // Center crosshair
            ctx.beginPath();
            ctx.moveTo(vx(-1), vy(0)); ctx.lineTo(vx(1), vy(0));
            ctx.moveTo(vx(0), vy(-1)); ctx.lineTo(vx(0), vy(1));
            ctx.stroke();

            const plan = laserManager.getVirtualPlan(deviceId);
            if (plan && plan.length > 1) {
                // Pass 1: thin lines connecting consecutive points.
                //   - Drawing→drawing: colored thin line.
                //   - Any segment involving a blank point: transparent gray.
                for (let i = 1; i < plan.length; i++) {
                    const prev = plan[i - 1];
                    const cur = plan[i];
                    if (prev.blank || cur.blank) {
                        ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
                        ctx.lineWidth = 0.5;
                    } else {
                        ctx.strokeStyle = `rgba(${cur.r}, ${cur.g}, ${cur.b}, 0.9)`;
                        ctx.lineWidth = 0.8;
                    }
                    ctx.beginPath();
                    ctx.moveTo(vx(prev.x), vy(prev.y));
                    ctx.lineTo(vx(cur.x), vy(cur.y));
                    ctx.stroke();
                }

                // Pass 2: dwell halos, grouped by kind so each type gets its
                // own styling.
                //   corner  → filled transparent circle in the laser color
                //   anchor  → blue outline, no fill
                //   bdwell  → gray outline, no fill
                // Other kinds ('draw' samples, 'travel' blanking samples) get
                // no halo — they're not dwell.
                let i = 0;
                while (i < plan.length) {
                    const pt = plan[i];
                    let count = 1;
                    while (i + count < plan.length
                        && plan[i + count].x === pt.x
                        && plan[i + count].y === pt.y
                        && plan[i + count].kind === pt.kind) {
                        count++;
                    }
                    if (count >= 2 && (pt.kind === 'corner' || pt.kind === 'anchor' || pt.kind === 'bdwell')) {
                        const radius = Math.min(14, 1.8 + count * 1.0);
                        ctx.beginPath();
                        ctx.arc(vx(pt.x), vy(pt.y), radius, 0, Math.PI * 2);
                        if (pt.kind === 'corner') {
                            ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, 0.22)`;
                            ctx.fill();
                        } else if (pt.kind === 'anchor') {
                            ctx.strokeStyle = 'rgba(90, 160, 255, 0.75)';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        } else {
                            ctx.strokeStyle = 'rgba(180, 180, 180, 0.55)';
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                    i += count;
                }

                // Pass 3: dots at every sample point.
                for (const pt of plan) {
                    if (pt.blank) {
                        ctx.fillStyle = 'rgba(200, 200, 200, 0.35)';
                        ctx.beginPath();
                        ctx.arc(vx(pt.x), vy(pt.y), 0.8, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = `rgb(${pt.r}, ${pt.g}, ${pt.b})`;
                        ctx.beginPath();
                        ctx.arc(vx(pt.x), vy(pt.y), 1.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => { if (animId) cancelAnimationFrame(animId); };
    });

    export function show(id) {
        deviceId = id;
        loadFromDevice();
        originalSettings = {
            pps, targetFps,
            blankingPoints, blankingDwell, cornerDwell, anchorDwell,
            windowWidth, windowSpeed,
            cornerMode, cornerBias, cornerSharpness,
            velocityCap, maxStepDac
        };
        requestAnimationFrame(() => dialogRef?.showModal());
    }

    function applySettings() {
        if (!deviceId) return;
        laserManager?.updateDeviceSettings(deviceId, {
            pps, targetFps,
            blankingPoints, blankingDwell, cornerDwell, anchorDwell,
            windowWidth, windowSpeed,
            cornerMode, cornerBias, cornerSharpness,
            velocityCap, maxStepDac
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
            anchorDwell = settings.anchorDwell ?? 3;
            windowWidth = settings.windowWidth ?? 1.0;
            windowSpeed = settings.windowSpeed ?? 0.0;
            cornerMode = settings.cornerMode ?? 'binary';
            cornerBias = settings.cornerBias ?? 3;
            cornerSharpness = settings.cornerSharpness ?? 1;
            velocityCap = settings.velocityCap ?? false;
            maxStepDac = settings.maxStepDac ?? 400;
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
        <div class="setting-slider group-start">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { windowWidth = 1.0; applySettings(); }}>Window</span>
            <input type="range" min="0.01" max="1" step="0.01" bind:value={windowWidth} oninput={applySettings} />
            <span class="setting-value">{Math.round(windowWidth * 100)}%</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { windowSpeed = 0.0; applySettings(); }}>Scan Speed</span>
            <input type="range" min="0" max="1" step="0.01" bind:value={windowSpeed} oninput={applySettings} />
            <span class="setting-value">{Math.round(windowSpeed * 100)}%</span>
        </div>
        <div class="setting-slider group-start">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { blankingPoints = 15; applySettings(); }}>Blanking</span>
            <input type="range" min="0" max="30" step="1" bind:value={blankingPoints} oninput={applySettings} />
            <span class="setting-value">{blankingPoints}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { blankingDwell = 5; applySettings(); }}>Dwell Off</span>
            <input type="range" min="0" max="30" step="1" bind:value={blankingDwell} oninput={applySettings} />
            <span class="setting-value">{blankingDwell}</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { anchorDwell = 3; applySettings(); }}>Dwell On</span>
            <input type="range" min="0" max="15" step="1" bind:value={anchorDwell} oninput={applySettings} />
            <span class="setting-value">{anchorDwell}</span>
        </div>

        <div class="setting-slider group-start">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { cornerDwell = 3; applySettings(); }}>Corner Dwell</span>
            <input type="range" min="0" max="10" step="1" bind:value={cornerDwell} oninput={applySettings} />
            <span class="setting-value">{cornerDwell}</span>
        </div>
        <div class="setting-row">
            <span class="setting-label">Corner Mode</span>
            <select bind:value={cornerMode} onchange={applySettings}>
                <option value="off">Off</option>
                <option value="binary">Binary (angle &gt; 45°)</option>
                <option value="weighted">Weighted (by angle)</option>
            </select>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { cornerBias = 3; applySettings(); }}>Corner Bias</span>
            <input type="range" min="0" max="50" step="0.5" bind:value={cornerBias} oninput={applySettings} />
            <span class="setting-value">{cornerBias.toFixed(1)}×</span>
        </div>
        <div class="setting-slider">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { cornerSharpness = 1; applySettings(); }}>Sharpness</span>
            <input type="range" min="1" max="4" step="0.25" bind:value={cornerSharpness} oninput={applySettings} />
            <span class="setting-value">p={cornerSharpness.toFixed(2)}</span>
        </div>

        <div class="setting-row group-start">
            <label class="setting-check">
                <input type="checkbox" bind:checked={velocityCap} onchange={applySettings} />
                <span>Velocity Cap</span>
            </label>
        </div>
        <div class="setting-slider" class:setting-disabled={!velocityCap}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="setting-label clickable" onclick={() => { maxStepDac = 400; applySettings(); }}>Max Step</span>
            <input type="range" min="50" max="1000" step="10" bind:value={maxStepDac} oninput={applySettings} disabled={!velocityCap} />
            <span class="setting-value">{maxStepDac}</span>
        </div>
      </div>

      <div class="settings-column visualization-column">
        <div class="visualization-wrapper">
            <canvas
                bind:this={visualizationCanvas}
                width="380"
                height="380"
                class="visualization-canvas"
                class:panning={visPanning}
                onmousedown={handleVisMouseDown}
                onmousemove={handleVisMouseMove}
                onmouseup={handleVisMouseUp}
                onmouseleave={handleVisMouseUp}
                onwheel={handleVisWheel}
            ></canvas>
            <div class="visualization-controls">
                <button type="button" onclick={() => visZoomBy(1.5)} title="Zoom in">+</button>
                <button type="button" onclick={() => visZoomBy(1 / 1.5)} title="Zoom out">−</button>
                <button type="button" class="reset" onclick={resetVisView} title="Reset view">⌂</button>
            </div>
        </div>
      </div>

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

    .visualization-column {
        flex: 0 0 380px;
        min-width: 380px;
        align-items: center;
    }

    .visualization-wrapper {
        position: relative;
        width: 380px;
        height: 380px;
    }

    .visualization-canvas {
        width: 380px;
        height: 380px;
        border-radius: 6px;
        background: #1a1a1a;
        display: block;
        cursor: grab;
    }

    .visualization-canvas.panning {
        cursor: grabbing;
    }

    .visualization-controls {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .visualization-controls button {
        width: 26px;
        height: 26px;
        border: none;
        border-radius: 4px;
        background: rgba(40, 40, 40, 0.85);
        color: #ddd;
        font-size: 14pt;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    .visualization-controls button:hover {
        background: rgba(60, 60, 60, 0.95);
        color: #fff;
    }

    .visualization-controls button.reset {
        font-size: 10pt;
    }

    .setting-slider {
        display: grid;
        grid-template-columns: 80px 1fr 36px;
        gap: 8px;
        align-items: center;
    }

    .setting-slider.group-start,
    .setting-row.group-start {
        margin-top: 20px;
    }

    .setting-row {
        display: grid;
        grid-template-columns: 80px 1fr;
        gap: 8px;
        align-items: center;
    }

    .setting-row select {
        font-size: 9pt;
        padding: 2px 4px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 3px;
    }

    .setting-check {
        display: flex;
        align-items: center;
        gap: 6px;
        grid-column: 1 / -1;
        font-size: 9pt;
        color: #333;
        cursor: pointer;
    }

    .setting-check input[type="checkbox"] {
        margin: 0;
    }

    .setting-disabled {
        opacity: 0.45;
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
