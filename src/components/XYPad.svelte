<script>
    let {
        panValue = $bindable(127),
        tiltValue = $bindable(127),
        onUpdate = null
    } = $props();

    let padElement = $state(null);
    let isDragging = $state(false);

    function updateValues(clientX, clientY) {
        if (!padElement) return;

        const rect = padElement.getBoundingClientRect();

        // Calculate position relative to pad (0-1)
        let x = (clientX - rect.left) / rect.width;
        let y = (clientY - rect.top) / rect.height;

        // Clamp to bounds
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        // Convert to DMX values (0-255)
        // X = Pan (0 = left, 255 = right)
        // Y = Tilt (0 = top/up, 255 = bottom/down) - inverted screen coords
        panValue = Math.round(x * 255);
        tiltValue = Math.round((1 - y) * 255); // Invert Y axis

        if (onUpdate) {
            onUpdate(panValue, tiltValue);
        }
    }

    function handleMouseDown(e) {
        isDragging = true;
        updateValues(e.clientX, e.clientY);

        // Prevent text selection while dragging
        e.preventDefault();
    }

    function handleMouseMove(e) {
        if (isDragging) {
            updateValues(e.clientX, e.clientY);
        }
    }

    function handleMouseUp() {
        isDragging = false;
    }

    // Handle mouse up anywhere in window
    $effect(() => {
        const handleGlobalMouseUp = () => {
            isDragging = false;
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    });

    // Calculate dot position for display
    let dotX = $derived((panValue / 255) * 100);
    let dotY = $derived((1 - tiltValue / 255) * 100); // Invert for display
</script>

<div class="xy-pad-container">
    <div
        class="xy-pad"
        bind:this={padElement}
        onmousedown={handleMouseDown}
        onmousemove={handleMouseMove}
        role="slider"
        aria-label="Pan and Tilt Control"
        tabindex="0"
    >
        <!-- Grid lines -->
        <div class="grid-line vertical" style="left: 25%"></div>
        <div class="grid-line vertical" style="left: 50%"></div>
        <div class="grid-line vertical" style="left: 75%"></div>
        <div class="grid-line horizontal" style="top: 25%"></div>
        <div class="grid-line horizontal" style="top: 50%"></div>
        <div class="grid-line horizontal" style="top: 75%"></div>

        <!-- Crosshair dot -->
        <div
            class="crosshair"
            style="left: {dotX}%; top: {dotY}%"
            class:active={isDragging}
        ></div>
    </div>

    <div class="xy-pad-labels">
        <span>Pan: {panValue}</span>
        <span>Tilt: {tiltValue}</span>
    </div>
</div>

<style>
    .xy-pad-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .xy-pad {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
        border: 2px solid #ccc;
        border-radius: 8px;
        cursor: crosshair;
        user-select: none;
        touch-action: none;
    }

    .xy-pad:hover {
        border-color: #999;
    }

    .xy-pad:active {
        border-color: #2196F3;
    }

    .grid-line {
        position: absolute;
        background: rgba(0, 0, 0, 0.1);
        pointer-events: none;
    }

    .grid-line.vertical {
        width: 1px;
        height: 100%;
        top: 0;
    }

    .grid-line.horizontal {
        height: 1px;
        width: 100%;
        left: 0;
    }

    .crosshair {
        position: absolute;
        width: 16px;
        height: 16px;
        background: #2196F3;
        border: 2px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.1s ease;
    }

    .crosshair.active {
        transform: translate(-50%, -50%) scale(1.2);
        background: #1976D2;
    }

    .xy-pad-labels {
        display: flex;
        justify-content: space-between;
        font-size: 9pt;
        font-family: var(--font-stack-mono);
        color: #666;
    }
</style>
