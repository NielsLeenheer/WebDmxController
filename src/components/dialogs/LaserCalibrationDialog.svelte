<script>
    import { Icon } from 'svelte-icon';
    import Dialog from '../common/Dialog.svelte';
    import rotateIcon from '../../assets/icons/glyph/rotate.svg?raw';
    import resizeIcon from '../../assets/icons/glyph/resize.svg?raw';
    import keystoneVIcon from '../../assets/icons/glyph/keystone-vertical.svg?raw';
    import keystoneHIcon from '../../assets/icons/glyph/keystone-horizontal.svg?raw';
    import barrelHIcon from '../../assets/icons/glyph/barrel-horizontal.svg?raw';
    import barrelVIcon from '../../assets/icons/glyph/barrel-vertical.svg?raw';
    import moveHIcon from '../../assets/icons/glyph/move-horizontal.svg?raw';
    import moveVIcon from '../../assets/icons/glyph/move-vertical.svg?raw';

    let {
        laserManager,
        onclose
    } = $props();

    let dialogRef = $state(null);
    let deviceId = $state(null);

    // Calibration parameters
    let calRotate = $state(0);
    let calScale = $state(1.0);
    let calTopBottom = $state(0);
    let calLeftRight = $state(0);
    let pincushionH = $state(0);
    let pincushionV = $state(0);
    let offsetX = $state(0);
    let offsetY = $state(0);
    let invertX = $state(true);
    let invertY = $state(true);
    let swapXY = $state(false);

    // Manual calibration
    let manualCal = $state(false);
    let manualCorners = $state({
        topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 },
        bottomLeft: { x: 0, y: 1 }, bottomRight: { x: 1, y: 1 }
    });
    let draggingCorner = $state(null);

    // Preview corners (with axis inversions and swap applied)
    let previewCorners = $derived.by(() => {
        const raw = manualCal ? manualCorners : computeCorners(calRotate, calScale, calTopBottom, calLeftRight);
        const transform = (p) => {
            let x = p.x, y = p.y;
            if (invertX) x = 1 - x;
            if (invertY) y = 1 - y;
            if (swapXY) [x, y] = [y, x];
            return { x, y };
        };
        return {
            topLeft: transform(raw.topLeft), topRight: transform(raw.topRight),
            bottomLeft: transform(raw.bottomLeft), bottomRight: transform(raw.bottomRight)
        };
    });

    // Preview path with barrel distortion
    let previewPath = $derived.by(() => {
        const c = previewCorners;
        const edges = [
            [c.topLeft, c.topRight], [c.topRight, c.bottomRight],
            [c.bottomRight, c.bottomLeft], [c.bottomLeft, c.topLeft]
        ];
        const steps = 20;
        const points = [];
        for (const [from, to] of edges) {
            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                let x = from.x + (to.x - from.x) * t;
                let y = from.y + (to.y - from.y) * t;
                if (pincushionH !== 0 || pincushionV !== 0) {
                    const cx = x - 0.5, cy = y - 0.5;
                    const r2 = cx * cx + cy * cy;
                    x = 0.5 + cx * (1 + pincushionH * r2 * 0.4);
                    y = 0.5 + cy * (1 + pincushionV * r2 * 0.4);
                }
                points.push(`${x * 100},${y * 100}`);
            }
        }
        return 'M' + points.join(' L') + ' Z';
    });

    function computeCorners(rotateDeg, scale, topBottom, leftRight) {
        const cx = 0.5, cy = 0.5;
        const rad = rotateDeg * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const h = 0.5 * scale;
        const tb = topBottom * 0.3, lr = leftRight * 0.3;
        const topW = h * (1 + tb), botW = h * (1 - tb);
        const leftH = h * (1 + lr), rightH = h * (1 - lr);
        const raw = [
            { x: -topW, y: -leftH }, { x: topW, y: -rightH },
            { x: -botW, y: leftH }, { x: botW, y: rightH }
        ];
        const rotated = raw.map(p => ({
            x: cx + p.x * cos - p.y * sin,
            y: cy + p.x * sin + p.y * cos
        }));
        return { topLeft: rotated[0], topRight: rotated[1], bottomLeft: rotated[2], bottomRight: rotated[3] };
    }

    function startCornerDrag(cornerName, e) {
        if (!manualCal) {
            manualCal = true;
            manualCorners = computeCorners(calRotate, calScale, calTopBottom, calLeftRight);
        }
        draggingCorner = cornerName;
        e.preventDefault();
    }

    function dragCorner(e) {
        if (!draggingCorner) return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const vbX = ((e.clientX - rect.left) / rect.width) * 140 - 20;
        const vbY = ((e.clientY - rect.top) / rect.height) * 140 - 20;
        let x = vbX / 100, y = vbY / 100;
        if (swapXY) [x, y] = [y, x];
        if (invertX) x = 1 - x;
        if (invertY) y = 1 - y;
        manualCorners = { ...manualCorners, [draggingCorner]: { x, y } };
        applyCalibration();
    }

    function stopCornerDrag() {
        draggingCorner = null;
    }

    function resetManualCal() {
        manualCal = false;
        applyCalibration();
    }

    export function show(id) {
        deviceId = id;
        loadFromDevice();
        if (deviceId) laserManager?.startCalibration(deviceId);
        requestAnimationFrame(() => dialogRef?.showModal());
    }

    function handleClose() {
        if (deviceId) laserManager?.stopCalibration(deviceId);
        dialogRef?.close();
        if (onclose) onclose();
    }

    function applySettings() {
        if (!deviceId) return;
        laserManager?.updateDeviceSettings(deviceId, {
            invertX, invertY, swapXY, pincushionH, pincushionV,
            offsetX, offsetY
        });
    }

    function applyCalibration() {
        if (!deviceId) return;
        const corners = manualCal ? manualCorners : computeCorners(calRotate, calScale, calTopBottom, calLeftRight);
        const params = {
            calRotate, calScale, calTopBottom, calLeftRight,
            manualCal, manualCorners: { ...manualCorners }
        };
        laserManager?.updateDeviceCalibration(deviceId, corners, params);
        applySettings();
    }

    function loadFromDevice() {
        const settings = deviceId ? laserManager?.getDeviceSettings(deviceId) : null;
        if (settings) {
            invertX = settings.invertX ?? true;
            invertY = settings.invertY ?? true;
            swapXY = settings.swapXY ?? false;
            pincushionH = settings.pincushionH ?? 0;
            pincushionV = settings.pincushionV ?? 0;
            offsetX = settings.offsetX ?? 0;
            offsetY = settings.offsetY ?? 0;
        }

        // Restore parametric calibration state
        const params = deviceId ? laserManager?.getDeviceCalibrationParams(deviceId) : null;
        if (params) {
            calRotate = params.calRotate ?? 0;
            calScale = params.calScale ?? 1.0;
            calTopBottom = params.calTopBottom ?? 0;
            calLeftRight = params.calLeftRight ?? 0;
            manualCal = params.manualCal ?? false;
            if (params.manualCorners) manualCorners = params.manualCorners;
        }
    }
</script>

<Dialog
    bind:dialogRef
    title="Calibration"
    onclose={handleClose}
>
    <div class="calibration-content">
        <!-- SVG Preview with draggable corners -->
        <div class="cal-preview-section">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <svg class="cal-preview" viewBox="-20 -20 140 140"
                onmousemove={dragCorner} onmouseup={stopCornerDrag} onmouseleave={stopCornerDrag}>
                <rect x="0" y="0" width="100" height="100" fill="none" stroke="#ccc" stroke-width="0.5" stroke-dasharray="3,3" />
                <path d={previewPath} fill="none" stroke="#1976d2" stroke-width="1" />
                {#each [['topLeft', previewCorners.topLeft], ['topRight', previewCorners.topRight], ['bottomLeft', previewCorners.bottomLeft], ['bottomRight', previewCorners.bottomRight]] as [name, c]}
                    <circle
                        cx={c.x * 100} cy={c.y * 100} r="3.4"
                        fill={draggingCorner === name ? '#333' : '#1976d2'}
                        class="corner-dot"
                        onmousedown={(e) => startCornerDrag(name, e)}
                    />
                {/each}
            </svg>
            {#if manualCal}
                <button class="reset-cal-btn" onclick={resetManualCal}>Reset</button>
            {/if}
        </div>

        <!-- Keystone sliders (2x2 grid, disabled in manual mode) -->
        <div class="calibration-grid" class:disabled={manualCal}>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { calRotate = 0; applyCalibration(); }} title="Rotate"><Icon data={rotateIcon} /></span>
                <input type="range" min="-45" max="45" step="0.5" bind:value={calRotate} oninput={applyCalibration} disabled={manualCal} />
                <span class="cal-value">{Math.round(calRotate)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { calScale = 1.0; applyCalibration(); }} title="Scale"><Icon data={resizeIcon} /></span>
                <input type="range" min="0.3" max="1.5" step="0.01" bind:value={calScale} oninput={applyCalibration} disabled={manualCal} />
                <span class="cal-value">{Math.round(calScale * 10)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { calTopBottom = 0; applyCalibration(); }} title="Vertical keystone"><Icon data={keystoneVIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={calTopBottom} oninput={applyCalibration} disabled={manualCal} />
                <span class="cal-value">{Math.round(calTopBottom * 10)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { calLeftRight = 0; applyCalibration(); }} title="Horizontal keystone"><Icon data={keystoneHIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={calLeftRight} oninput={applyCalibration} disabled={manualCal} />
                <span class="cal-value">{Math.round(calLeftRight * 10)}</span>
            </div>
        </div>

        <!-- Barrel/offset sliders (always enabled) -->
        <div class="calibration-grid">
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { pincushionH = 0; applySettings(); }} title="Horizontal barrel"><Icon data={barrelHIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={pincushionH} oninput={applySettings} />
                <span class="cal-value">{Math.round(pincushionH * 10)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { pincushionV = 0; applySettings(); }} title="Vertical barrel"><Icon data={barrelVIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={pincushionV} oninput={applySettings} />
                <span class="cal-value">{Math.round(pincushionV * 10)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { offsetX = 0; applySettings(); }} title="Horizontal position"><Icon data={moveHIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={offsetX} oninput={applySettings} />
                <span class="cal-value">{Math.round(offsetX * 10)}</span>
            </div>
            <div class="cal-slider">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="cal-icon clickable" onclick={() => { offsetY = 0; applySettings(); }} title="Vertical position"><Icon data={moveVIcon} /></span>
                <input type="range" min="-1" max="1" step="0.01" bind:value={offsetY} oninput={applySettings} />
                <span class="cal-value">{Math.round(offsetY * 10)}</span>
            </div>
        </div>

        <!-- Flip controls -->
        <div class="flip-row">
            <label class="flip-checkbox"><input type="checkbox" bind:checked={invertX} onchange={applySettings} /> X</label>
            <label class="flip-checkbox"><input type="checkbox" bind:checked={invertY} onchange={applySettings} /> Y</label>
            <label class="flip-checkbox"><input type="checkbox" bind:checked={swapXY} onchange={applySettings} /> Swap</label>
        </div>

    </div>

    {#snippet buttons()}
        <button onclick={handleClose}>Close</button>
    {/snippet}
</Dialog>

<style>
    .calibration-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 340px;
    }

    /* Preview */
    .cal-preview-section {
        position: relative;
    }

    .cal-preview {
        width: 100%;
        aspect-ratio: 1;
        background: #f5f5f5;
        border-radius: 4px;
    }

    .cal-preview .corner-dot {
        cursor: grab;
    }

    .cal-preview .corner-dot:active {
        cursor: grabbing;
    }

    .reset-cal-btn {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: transparent;
        border: 1px solid #ccc;
        color: #999;
        font-size: 9pt;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 10px;
        border-radius: 4px;
    }

    .reset-cal-btn:hover {
        border-color: #1976d2;
        color: #1976d2;
    }

    /* Calibration 2x2 grids */
    .calibration-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 16px;
        transition: opacity 0.2s;
    }

    .calibration-grid.disabled {
        opacity: 0.35;
        pointer-events: none;
    }

    .cal-slider {
        display: grid;
        grid-template-columns: 36px 1fr 24px;
        gap: 4px;
        align-items: center;
    }

    .cal-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
    }

    .cal-icon :global(svg) {
        width: 20px;
        height: 20px;
        fill: currentColor;
    }

    .cal-icon.clickable {
        cursor: pointer;
    }

    .cal-icon.clickable:hover {
        color: #1976d2;
    }

    .cal-value {
        font-size: 8pt;
        font-family: var(--font-stack-mono);
        color: #666;
        text-align: right;
    }

    .cal-slider input[type="range"] {
        width: 100%;
        height: 4px;
        accent-color: #1976d2;
    }

    /* Flip controls */
    .flip-row {
        display: flex;
        gap: 16px;
    }

    .flip-checkbox {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 9pt;
        color: #333;
        cursor: pointer;
    }

    .flip-checkbox input {
        accent-color: #1976d2;
    }


</style>
