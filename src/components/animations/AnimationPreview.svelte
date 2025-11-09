<script>
    import { getDeviceColor } from '../../lib/colorUtils.js';

    let {
        animation,
        animationVersion = 0
    } = $props();

    let previewElement = $state(null);
    let isPlaying = $state(false);

    // Generate preview-specific CSS with background-color for visualization
    function generatePreviewCSS(animation) {
        if (!animation || animation.keyframes.length === 0) {
            return '';
        }

        const keyframeRules = animation.keyframes
            .map(kf => {
                const color = getDeviceColor(animation.deviceType, kf.values);
                const percent = Math.round(kf.time * 100);

                // For moving heads, also include transform
                if (animation.deviceType === 'MOVING_HEAD') {
                    const pan = kf.values[0] || 0;
                    const tilt = kf.values[1] || 0;
                    const panPercent = ((pan / 255) * 100) - 50;
                    const tiltPercent = ((tilt / 255) * 100) - 50;
                    return `${percent}% { background-color: ${color}; transform: translate(${panPercent}%, ${tiltPercent}%); }`;
                }

                return `${percent}% { background-color: ${color}; }`;
            })
            .join('\n  ');

        const animationName = `preview-${animation.name}`;
        return `@keyframes ${animationName} {\n  ${keyframeRules}\n}`;
    }

    let previewCSS = $derived.by(() => {
        animationVersion; // Make reactive
        return animation ? generatePreviewCSS(animation) : '';
    });

    function playAnimation() {
        if (!animation || !previewElement) return;

        // Restart animation
        previewElement.style.animation = 'none';
        isPlaying = false;

        setTimeout(() => {
            previewElement.style.animation = `preview-${animation.name} 3s linear infinite`;
            isPlaying = true;
        }, 10);
    }

    function stopAnimation() {
        if (!previewElement) return;
        previewElement.style.animation = 'none';
        isPlaying = false;
    }
</script>

<div class="animation-preview">
    <div class="preview-container">
        <div class="preview-box" bind:this={previewElement}></div>
    </div>

    <div class="preview-controls">
        <button class="preview-button" onclick={playAnimation} disabled={!animation}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
            Play
        </button>
        <button class="preview-button" onclick={stopAnimation} disabled={!animation || !isPlaying}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
            </svg>
            Stop
        </button>
    </div>
</div>

<!-- Inject preview animation CSS -->
{#if animation}
    <style>
        {@html previewCSS}
    </style>
{/if}

<style>
    .animation-preview {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .preview-container {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 150px;
    }

    .preview-box {
        width: 80px;
        height: 80px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .preview-controls {
        display: flex;
        gap: 8px;
        justify-content: center;
    }

    .preview-button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: #2196f3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10pt;
        transition: background 0.2s;
    }

    .preview-button:hover:not(:disabled) {
        background: #1976d2;
    }

    .preview-button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .preview-button svg {
        flex-shrink: 0;
    }
</style>
