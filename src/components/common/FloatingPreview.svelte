<script>
    import DrawingPreview from './DrawingPreview.svelte';

    let {
        laserManager,
        selectedDrawingId = null
    } = $props();

    let panelRef = $state(null);
    let segments = $state([]);

    // Drag state
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panelX = $state(null);
    let panelY = $state(null);

    function startDrag(e) {
        dragging = true;
        const rect = panelRef.getBoundingClientRect();
        dragStartX = e.clientX - rect.left;
        dragStartY = e.clientY - rect.top;

        if (panelY === null) {
            panelY = rect.top;
        }

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', stopDrag);
    }

    function onDrag(e) {
        if (!dragging) return;
        panelX = e.clientX - dragStartX;
        panelY = e.clientY - dragStartY;
    }

    function stopDrag() {
        dragging = false;
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', stopDrag);
    }

    // Continuously sample segments
    $effect(() => {
        if (!laserManager) return;
        let animId;

        function update() {
            segments = selectedDrawingId
                ? laserManager.sampleDrawing(selectedDrawingId)
                : laserManager.lastSegments;
            animId = requestAnimationFrame(update);
        }

        update();
        return () => { if (animId) cancelAnimationFrame(animId); };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="floating-preview"
    bind:this={panelRef}
    style="left: {panelX}px; {panelY !== null ? `top: ${panelY}px; bottom: auto;` : ''}"
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="preview-header" onmousedown={startDrag}>
        <span class="preview-title">Preview</span>
    </div>
    <DrawingPreview {segments} width={200} height={200} background="#1a1a1a" />
</div>

<style>
    .floating-preview {
        position: fixed;
        bottom: 40px;
        left: 40px;
        z-index: 50;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        background: #1a1a1a;
        user-select: none;
    }

    .preview-header {
        padding: 6px 10px;
        background: #2a2a2a;
        cursor: move;
        display: flex;
        align-items: center;
    }

    .preview-title {
        font-size: 8pt;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
</style>
