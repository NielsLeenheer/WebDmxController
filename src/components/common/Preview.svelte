<script>
    /**
     * Preview Component
     *
     * Renders previews for devices, animations, inputs, and properties
     * Consolidates all preview rendering logic in one place
     *
     * @prop {string} type - Type of preview: 'device', 'animation', 'safety', 'fuel', 'output', 'euler'
     * @prop {string} size - Size: 'small', 'medium', 'large' (default: 'medium')
     * @prop {Object} data - Data for rendering the preview
     */

    let {
        type = 'device',
        size = 'medium',
        data = {},
        class: className = '',
    } = $props();

    // Determine the CSS class based on size
    const sizeClass = $derived(`preview-${size}`);
</script>

<div class="preview {sizeClass} {className}">
    {#if type === 'device'}
        <!-- Device color preview (RGB, RGBW, DIMMER, etc.) -->
        <div class="preview-color" style="background-color: {data.color || '#888'}"></div>

    {:else if type === 'flamethrower'}
        <!-- Flamethrower: safety and fuel -->
        {@const safetyOff = (data.safety ?? 0) < 125}
        {@const fuelPercent = ((data.fuel ?? 0) / 255) * 100}
        <div
            class="preview-flamethrower"
            style="background: {safetyOff ? '#222222' : `linear-gradient(to top, #ff5722 0%, #ff9800 ${fuelPercent/2}%, #ffc107 ${fuelPercent}%, #1a1a1a ${fuelPercent}%, #1a1a1a 100%)`}"
        >
            {#if safetyOff}
                <div class="flamethrower-cross"></div>
            {/if}
        </div>

    {:else if type === 'smoke'}
        <!-- Smoke machine: output -->
        {@const smokePercent = ((data.output ?? 0) / 255) * 100}
        <div class="preview-smoke" style="background: #1a1a1a">
            <div class="smoke-effect" style="opacity: {smokePercent / 100}"></div>
        </div>

    {:else if type === 'safety'}
        <!-- Safety toggle: on/off with checkmark or cross -->
        {@const safetyOn = (data.value ?? 0) >= 125}
        <div class="preview-safety" style="background: {safetyOn ? '#2a5a2a' : '#222222'}">
            {#if safetyOn}
                <div class="safety-checkmark"></div>
            {:else}
                <div class="flamethrower-cross"></div>
            {/if}
        </div>

    {:else if type === 'fuel'}
        <!-- Fuel: just the fire gradient -->
        {@const fuelPercent = ((data.value ?? 0) / 255) * 100}
        <div
            class="preview-fuel"
            style="background: linear-gradient(to top, #ff5722 0%, #ff9800 {fuelPercent/2}%, #ffc107 {fuelPercent}%, #1a1a1a {fuelPercent}%, #1a1a1a 100%)"
        ></div>

    {:else if type === 'output'}
        <!-- Output: smoke effect -->
        {@const smokePercent = ((data.value ?? 0) / 255) * 100}
        <div class="preview-output" style="background: #1a1a1a">
            <div class="smoke-effect" style="opacity: {smokePercent / 100}"></div>
        </div>

    {:else if type === 'animation'}
        <!-- Animation color/gradient preview -->
        <div class="preview-animation" style="background: {data.color || '#888'}"></div>

    {:else if type === 'euler'}
        <!-- Euler angles for Thingy:52 -->
        <div class="preview-euler">
            <div class="euler-axis">
                <span class="euler-label">Roll:</span>
                <span class="euler-value">{(data.roll ?? 0).toFixed(0)}°</span>
            </div>
            <div class="euler-axis">
                <span class="euler-label">Pitch:</span>
                <span class="euler-value">{(data.pitch ?? 0).toFixed(0)}°</span>
            </div>
            <div class="euler-axis">
                <span class="euler-label">Yaw:</span>
                <span class="euler-value">{(data.yaw ?? 0).toFixed(0)}°</span>
            </div>
        </div>
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

    /* Content fills the preview */
    .preview-color,
    .preview-flamethrower,
    .preview-smoke,
    .preview-safety,
    .preview-fuel,
    .preview-output,
    .preview-animation {
        width: 100%;
        height: 100%;
        border-radius: inherit;
    }

    /* Shadow for color previews */
    .preview-color,
    .preview-animation {
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Flamethrower cross */
    .flamethrower-cross {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 70%;
        height: 70%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }

    .flamethrower-cross::before,
    .flamethrower-cross::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 2px;
        background-color: #ff4444;
        top: 50%;
        left: 0;
    }

    .flamethrower-cross::before {
        transform: translateY(-50%) rotate(45deg);
    }

    .flamethrower-cross::after {
        transform: translateY(-50%) rotate(-45deg);
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

    /* Euler angle preview */
    .preview-euler {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        background: #f6f6f6;
        border-radius: inherit;
        font-family: var(--font-stack-mono);
        width: auto;
        height: auto;
    }

    .preview-small .preview-euler {
        padding: 4px 6px;
        gap: 2px;
        font-size: 8pt;
    }

    .preview-medium .preview-euler {
        padding: 6px 8px;
        gap: 3px;
        font-size: 9pt;
    }

    .preview-large .preview-euler {
        padding: 8px 12px;
        gap: 4px;
        font-size: 10pt;
    }

    .euler-axis {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .euler-label {
        color: #666;
        font-weight: 500;
    }

    .euler-value {
        color: #2563eb;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
</style>
