<script>
    /**
     * Preview Component
     *
     * Renders previews for devices, animations, and inputs with stacked controls
     *
     * @prop {string} type - Type of preview: 'device', 'animation', 'input'
     * @prop {string} size - Size: 'small', 'medium', 'large' (default: 'medium')
     * @prop {Array<string>} controls - Array of control types to stack (for type='device')
     * @prop {Object} data - Data for rendering the preview
     */

    let {
        type = 'device',
        size = 'medium',
        controls = [],
        data = {},
        class: className = '',
    } = $props();

    // Determine the CSS class based on size
    const sizeClass = $derived(`preview-${size}`);
</script>

<div class="preview {sizeClass} {className}">
    <!-- Dark gray background (always present for devices) -->
    <div class="preview-base"></div>

    {#if type === 'device'}
        <!-- Stack device controls in order -->
        {#each controls as control}
            {#if control === 'color'}
                <div class="control-layer control-color" style="background-color: {data.color || '#888'}"></div>

            {:else if control === 'amber'}
                {@const amberOpacity = ((data.amber ?? 0) / 255)}
                <div class="control-layer control-amber" style="background-color: rgba(255, 191, 0, {amberOpacity})"></div>

            {:else if control === 'white'}
                {@const whiteOpacity = ((data.white ?? 0) / 255)}
                <div class="control-layer control-white" style="background-color: rgba(255, 255, 255, {whiteOpacity})"></div>

            {:else if control === 'fuel'}
                {@const fuelPercent = ((data.fuel ?? 0) / 255) * 100}
                <div
                    class="control-layer control-fuel"
                    style="background: linear-gradient(to top, #ff5722 0%, #ff9800 {fuelPercent/2}%, #ffc107 {fuelPercent}%, #1a1a1a {fuelPercent}%, #1a1a1a 100%)"
                ></div>

            {:else if control === 'safety'}
                {@const safetyOn = (data.safety ?? 0) >= 125}
                <div class="control-layer control-safety" style="background: {safetyOn ? 'transparent' : '#222222'}">
                    {#if safetyOn}
                        <div class="safety-checkmark"></div>
                    {:else}
                        <div class="safety-cross"></div>
                    {/if}
                </div>

            {:else if control === 'output'}
                {@const outputPercent = ((data.output ?? 0) / 255) * 100}
                <div class="control-layer control-output">
                    <div class="smoke-effect" style="opacity: {outputPercent / 100}"></div>
                </div>

            {:else if control === 'pantilt'}
                {@const dotX = ((data.pan ?? 0) / 255) * 100}
                {@const dotY = (1 - (data.tilt ?? 0) / 255) * 100}
                <div class="control-layer control-pantilt">
                    <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
                </div>
            {/if}
        {/each}

    {:else if type === 'animation'}
        <!-- Animation color/gradient preview -->
        <div class="preview-animation" style="background: {data.color || '#888'}"></div>

    {:else if type === 'input'}
        <!-- Input color preview -->
        <div class="preview-input" style="background: {data.color || '#888'}"></div>
    {/if}
</div>

<style>
    /* Base preview container */
    .preview {
        border-radius: 4px;
        overflow: hidden;
        position: relative;
    }

    /* Size variants */
    .preview-small {
        width: 20px;
        height: 20px;
        border-radius: 3px;
    }

    .preview-medium {
        width: 32px;
        height: 32px;
        border-radius: 4px;
    }

    .preview-large {
        width: 64px;
        height: 64px;
        border-radius: 6px;
    }

    /* Dark gray background base */
    .preview-base {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a1a;
        border-radius: inherit;
    }

    /* Control layers stack on top of base */
    .control-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
    }

    /* Color layer has shadow */
    .control-color {
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Animation and input previews */
    .preview-animation,
    .preview-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Safety checkmark */
    .safety-checkmark {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 70%;
        height: 70%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    .safety-checkmark::before {
        content: '';
        position: absolute;
        width: 40%;
        height: 2px;
        background-color: #4ade80;
        bottom: 50%;
        left: 15%;
        transform: rotate(-45deg);
        transform-origin: left bottom;
    }

    .safety-checkmark::after {
        content: '';
        position: absolute;
        width: 80%;
        height: 2px;
        background-color: #4ade80;
        bottom: 50%;
        left: 15%;
        transform: rotate(45deg);
        transform-origin: left bottom;
    }

    /* Safety cross (diagonal X) */
    .safety-cross {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 70%;
        height: 70%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    .safety-cross::before,
    .safety-cross::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 2px;
        background-color: #ff4444;
        top: 50%;
        left: 0;
    }

    .safety-cross::before {
        transform: translateY(-50%) rotate(45deg);
    }

    .safety-cross::after {
        transform: translateY(-50%) rotate(-45deg);
    }

    /* Smoke effect */
    .smoke-effect {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background:
            radial-gradient(circle at 12% 18%, rgba(180, 180, 180, 0.6) 0%, rgba(180, 180, 180, 0.6) 42%, transparent 43%),
            radial-gradient(circle at 72% 12%, rgba(160, 160, 160, 0.5) 0%, rgba(160, 160, 160, 0.5) 28%, transparent 29%),
            radial-gradient(circle at 88% 58%, rgba(170, 170, 170, 0.55) 0%, rgba(170, 170, 170, 0.55) 35%, transparent 36%),
            radial-gradient(circle at 24% 88%, rgba(175, 175, 175, 0.6) 0%, rgba(175, 175, 175, 0.6) 38%, transparent 39%),
            radial-gradient(circle at 42% 48%, rgba(165, 165, 165, 0.5) 0%, rgba(165, 165, 165, 0.5) 32%, transparent 33%),
            radial-gradient(circle at 58% 78%, rgba(170, 170, 170, 0.55) 0%, rgba(170, 170, 170, 0.55) 30%, transparent 31%),
            radial-gradient(circle at 78% 38%, rgba(180, 180, 180, 0.5) 0%, rgba(180, 180, 180, 0.5) 26%, transparent 27%),
            radial-gradient(circle at 32% 28%, rgba(175, 175, 175, 0.55) 0%, rgba(175, 175, 175, 0.55) 33%, transparent 34%),
            radial-gradient(circle at 62% 22%, rgba(170, 170, 170, 0.5) 0%, rgba(170, 170, 170, 0.5) 29%, transparent 30%),
            radial-gradient(circle at 48% 68%, rgba(165, 165, 165, 0.6) 0%, rgba(165, 165, 165, 0.6) 36%, transparent 37%);
        border-radius: inherit;
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        transition: opacity 0.2s ease-out;
    }

    /* Pan/Tilt indicator */
    .pan-tilt-indicator {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #888;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 10;
    }
</style>
