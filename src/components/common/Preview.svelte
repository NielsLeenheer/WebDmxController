<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { getDeviceColor } from '../../lib/outputs/devices.js';
    import { getControlsForRendering } from '../../lib/animations/utils.js';
    import { paletteColorToHex } from '../../lib/inputs/colors.js';

    /**
     * Preview Component
     *
     * Renders previews for devices, animations, and inputs with stacked controls
     *
     * @prop {string} type - Type of preview: 'device', 'controls', 'animation', 'input'
     * @prop {string} size - Size: 'small', 'medium', 'large' (default: 'medium')
     * @prop {Array<string>} controls - Array of control types to stack (for type='controls')
     * @prop {Object} data - Data for rendering (device object, animation object, input object, or control values)
     * @prop {Object} euler - Euler angles for 3D rotation: { roll, pitch, yaw } (optional)
     */

    let {
        type = 'controls',
        size = 'medium',
        controls = [],
        data = {},
        euler = null,
        class: className = '',
    } = $props();

    // Generate animation preview gradient
    function generateAnimationPreview(animation) {
        if (!animation) return '#888';

        // Check if animation has color-related controls
        const hasColor = animation.controls && (
            animation.controls.includes('Color') ||
            animation.controls.includes('Amber') ||
            animation.controls.includes('White')
        );

        if (!hasColor || !animation.keyframes || animation.keyframes.length === 0) {
            return '#888';
        }

        // Extract colors from each keyframe (NEW: control values)
        const colors = animation.keyframes.map(keyframe => {
            const values = keyframe.values || {};

            // Get Color control value
            let r = 0, g = 0, b = 0;
            const colorValue = values.Color;
            if (colorValue && typeof colorValue === 'object') {
                r = colorValue.r || 0;
                g = colorValue.g || 0;
                b = colorValue.b || 0;
            }

            // Add Amber if present
            const amber = values.Amber;
            if (amber !== undefined) {
                // Amber is #FFBF00 - adds to red and green
                r = Math.min(255, r + (255 * amber / 255));
                g = Math.min(255, g + (191 * amber / 255));
            }

            // Add White if present
            const white = values.White;
            if (white !== undefined) {
                // White adds equally to all channels
                r = Math.min(255, r + white);
                g = Math.min(255, g + white);
                b = Math.min(255, b + white);
            }

            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        });

        // Create stepped gradient with equal steps
        const numSteps = colors.length;
        const stepSize = 100 / numSteps;

        const gradientStops = colors.map((color, index) => {
            const start = index * stepSize;
            const end = (index + 1) * stepSize;
            return `${color} ${start}% ${end}%`;
        }).join(', ');

        return `linear-gradient(90deg, ${gradientStops})`;
    }

    // Extract controls and data from device object if type is 'device'
    const effectiveControls = $derived(() => {
        if (type === 'device' && data) {
            const device = data;
            // Extract controls based on device type
            const deviceType = DEVICE_TYPES[device.type];
            if (!deviceType) return [];

            // Dynamically build controls array based on device controls
            const controlsList = [];

            for (const control of deviceType.controls) {
                const controlTypeId = control.type.type;

                if (controlTypeId === 'rgb') {
                    controlsList.push('color');
                } else if (controlTypeId === 'xypad' || controlTypeId === 'xypad16') {
                    controlsList.push('pantilt');
                } else if (controlTypeId === 'slider' || controlTypeId === 'toggle') {
                    // Add slider/toggle controls by their lowercase name
                    const controlKey = control.name.toLowerCase();
                    controlsList.push(controlKey);
                }
            }

            return controlsList;
        }
        return controls;
    });

    const effectiveData = $derived(() => {
        if (type === 'device' && data) {
            const device = data;
            const deviceType = DEVICE_TYPES[device.type];
            if (!deviceType) return {};

            // Get control values (NEW: object instead of array)
            const controlValues = device.defaultValues || device.currentValues || {};
            const result = {};

            // Dynamically extract data based on device controls
            for (const control of deviceType.controls) {
                const controlTypeId = control.type.type;
                const value = controlValues[control.name];

                if (controlTypeId === 'rgb') {
                    // RGB control - get color
                    result.color = getDeviceColor(device.type, controlValues);
                } else if (controlTypeId === 'xypad' || controlTypeId === 'xypad16') {
                    // Pan/Tilt control
                    const panTilt = value || { x: 128, y: 128 };
                    result.pan = panTilt.x ?? 128;
                    result.tilt = panTilt.y ?? 128;
                } else if (controlTypeId === 'slider' || controlTypeId === 'toggle') {
                    // Slider/toggle controls - add by lowercase name
                    const controlKey = control.name.toLowerCase();
                    result[controlKey] = value ?? (controlTypeId === 'toggle' ? control.type.offValue : 0);
                }
            }

            return result;
        }
        return data;
    });

    // Determine the CSS class based on size
    const sizeClass = $derived(`preview-${size}`);

    // Reorder controls for proper visual stacking
    // Flamethrower: fuel layer must render before safety layer so safety appears on top
    const orderedControls = $derived.by(() => {
        const ctls = effectiveControls();
        const safetyIndex = ctls.indexOf('safety');
        const fuelIndex = ctls.indexOf('fuel');

        // If both safety and fuel exist, and safety comes first, swap them
        if (safetyIndex !== -1 && fuelIndex !== -1 && safetyIndex < fuelIndex) {
            const reordered = [...ctls];
            reordered[safetyIndex] = 'fuel';
            reordered[fuelIndex] = 'safety';
            return reordered;
        }

        return ctls;
    });

    // Calculate 3D transform from Euler angles
    const transform3D = $derived(() => {
        if (!euler) return '';
        
        // Transform pitch and roll from device coordinates to screen coordinates
        // based on yaw rotation
        const yawRad = (euler.yaw * Math.PI) / 180;
        
        // Rotate pitch/roll vector by yaw to get screen-space rotations
        const screenPitch = euler.pitch * Math.cos(yawRad) + euler.roll * Math.sin(yawRad);
        const screenRoll = -euler.pitch * Math.sin(yawRad) + euler.roll * Math.cos(yawRad);
        
        // Apply rotations: X (pitch), Y (roll), Z (yaw)
        // Negate for more intuitive rotation
        return `rotateX(${-screenPitch}deg) rotateY(${-screenRoll}deg) rotateZ(${euler.yaw}deg)`;
    });

    // Calculate dynamic box shadow based on orientation to keep shadow from bottom
    const dynamicShadow = $derived(() => {
        if (!euler) return '';
        
        // Convert angles to radians
        const pitchRad = (euler.pitch * Math.PI) / 180;
        const rollRad = (euler.roll * Math.PI) / 180;
        const yawRad = (euler.yaw * Math.PI) / 180;
        
        // Calculate shadow offset and size based on device orientation
        // Shadow should appear to come from below and grow when tilted (showing thickness)
        // Base shadow offset - grows with tilt to show device thickness
        const tiltAmount = Math.abs(Math.sin(pitchRad)) + Math.abs(Math.sin(rollRad));
        const shadowSize = 3 + (tiltAmount * 5); // Grow from 3px to 8px based on tilt
        
        // Shadow direction based on which physical edge is lifted:
        // Pitch: positive pitch = front/top up = shadow appears on top (negative Y in CSS)
        // Roll: positive roll = left side up = shadow appears on left (negative X in CSS)
        // Note: Transform uses -pitch and -roll, so shadow needs positive values
        const shadowX = Math.sin(rollRad) * shadowSize;
        const shadowY = Math.sin(pitchRad) * shadowSize;
        
        return `inset ${shadowX}px ${shadowY}px 0px 0px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`;
    });
</script>

<div class="preview {sizeClass} {className}" class:with-3d={euler !== null} style="transform: {transform3D()}">
    <!-- Dark gray background (always present for devices) -->
    <div class="preview-base"></div>

    {#if type === 'device' || type === 'controls'}
        <!-- Stack device controls in order -->
        {#each orderedControls as control}
            {#if control === 'color'}
                <div 
                    class="control-layer control-color" 
                    style="background-color: {effectiveData().color || '#888'}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
                ></div>

            {:else if control === 'amber'}
                {@const amberOpacity = ((effectiveData().amber ?? 0) / 255)}
                <div class="control-layer control-amber" style="background-color: rgba(255, 191, 0, {amberOpacity})"></div>

            {:else if control === 'white'}
                {@const whiteOpacity = ((effectiveData().white ?? 0) / 255)}
                <div class="control-layer control-white" style="background-color: rgba(255, 255, 255, {whiteOpacity})"></div>

            {:else if control === 'intensity'}
                {@const intensityOpacity = ((effectiveData().intensity ?? 0) / 255)}
                <div class="control-layer control-intensity" style="background-color: rgba(0, 0, 0, {1 - intensityOpacity})"></div>

            {:else if control === 'fuel'}
                {@const fuelPercent = ((effectiveData().fuel ?? 0) / 255) * 100}
                <div
                    class="control-layer control-fuel"
                    style="background: linear-gradient(to top, #ff5722 0%, #ff9800 {fuelPercent/2}%, #ffc107 {fuelPercent}%, #1a1a1a {fuelPercent}%, #1a1a1a 100%)"
                ></div>

            {:else if control === 'safety'}
                {@const safetyOn = (effectiveData().safety ?? 0) >= 125}
                <div class="control-layer control-safety" style="background: {safetyOn ? 'transparent' : '#222222'}">
                    {#if safetyOn}
                        <div class="safety-checkmark"></div>
                    {:else}
                        <div class="safety-cross"></div>
                    {/if}
                </div>

            {:else if control === 'output'}
                {@const outputPercent = ((effectiveData().output ?? 0) / 255) * 100}
                <div class="control-layer control-output">
                    <div class="smoke-effect" style="opacity: {outputPercent / 100}"></div>
                </div>

            {:else if control === 'pantilt'}
                {@const dotX = ((effectiveData().pan ?? 0) / 255) * 100}
                {@const dotY = (1 - (effectiveData().tilt ?? 0) / 255) * 100}
                <div class="control-layer control-pantilt">
                    <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
                </div>
            {/if}
        {/each}

    {:else if type === 'animation'}
        <!-- Animation preview with gradient -->
        {@const animationPreview = generateAnimationPreview(data)}
        <div 
            class="preview-animation" 
            style="background: {animationPreview}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
        ></div>

    {:else if type === 'input'}
        <!-- Input color preview -->
        {@const inputColor = data.color ? paletteColorToHex(data.color) : '#888'}
        <div 
            class="preview-input" 
            style="background: {inputColor}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
        ></div>
        
        <!-- Orientation indicator dot for Thingy:52 (represents the hole) -->
        {#if euler}
            <div class="orientation-indicator"></div>
        {/if}
    {/if}
</div>

<style>
    /* Base preview container */
    .preview {
        border-radius: 4px;
        overflow: hidden;
        position: relative;
        transform-style: preserve-3d;
    }

    /* Enable 3D perspective for rotating previews */
    .preview.with-3d {
        perspective: 200px;
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
        transform: translate(-50%, -50%) rotate(-90deg);
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

    /* Orientation indicator (Thingy:52 hole marker) */
    .orientation-indicator {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 6px;
        height: 6px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 50%;
        pointer-events: none;
        z-index: 10;
    }
</style>
