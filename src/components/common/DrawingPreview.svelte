<script>
    /**
     * DrawingPreview - Shared canvas component for rendering sampled SVG segments
     * Used by FloatingPreview (Drawing tab) and Preview (Editor tab, large size)
     * Shows the drawing without calibration — raw sampled geometry.
     *
     * @prop {Array} segments - Array of segments to draw (from laserManager.lastSegments or sampleDrawing)
     * @prop {number} width - Canvas width in pixels
     * @prop {number} height - Canvas height in pixels
     * @prop {string} background - Canvas background color
     */

    let {
        segments = [],
        width = 200,
        height = 200,
        background = '#444',
        lineWidth = 1.5
    } = $props();

    let canvasRef = $state(null);

    $effect(() => {
        if (!canvasRef) return;

        const ctx = canvasRef.getContext('2d');
        const w = canvasRef.width;
        const h = canvasRef.height;
        let animId;

        function drawFrame() {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, w, h);

            if (segments && segments.length > 0) {
                const mapX = (x) => (x + 1) / 2 * (w - 8) + 4;
                const mapY = (y) => (y + 1) / 2 * (h - 8) + 4;

                // Blanking lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.lineWidth = 0.5;
                for (let s = 1; s < segments.length; s++) {
                    const prevSeg = segments[s - 1];
                    const currSeg = segments[s];
                    if (prevSeg.length > 0 && currSeg.length > 0) {
                        const from = prevSeg[prevSeg.length - 1];
                        const to = currSeg[0];
                        ctx.beginPath();
                        ctx.moveTo(mapX(from.x), mapY(from.y));
                        ctx.lineTo(mapX(to.x), mapY(to.y));
                        ctx.stroke();
                    }
                }

                // Segments
                for (const segment of segments) {
                    if (segment.length < 2) continue;
                    const pt = segment[0];
                    ctx.strokeStyle = `rgba(${pt.r ?? 0}, ${pt.g ?? 255}, ${pt.b ?? 0}, ${pt.opacity ?? 1})`;
                    ctx.lineWidth = lineWidth;
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(mapX(segment[0].x), mapY(segment[0].y));
                    for (let i = 1; i < segment.length; i++) {
                        ctx.lineTo(mapX(segment[i].x), mapY(segment[i].y));
                    }
                    ctx.stroke();
                }
            }

            animId = requestAnimationFrame(drawFrame);
        }

        drawFrame();
        return () => { if (animId) cancelAnimationFrame(animId); };
    });
</script>

<canvas
    bind:this={canvasRef}
    {width}
    {height}
    class="drawing-preview-canvas"
></canvas>

<style>
    .drawing-preview-canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
