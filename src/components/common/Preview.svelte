<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
    import { getDeviceColor } from '../../lib/outputs/devices.js';
    import { getControlsForRendering, getKeyframeColor } from '../../lib/animations/utils.js';
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
        stateValue = '',  // For input state values (e.g., "50%" for knob/slider)
        class: className = '',
    } = $props();

    // Extract displayable character from keyboard key control ID
    function extractKeyChar(controlId) {
        if (!controlId || !controlId.startsWith('key-')) return null;
        
        const keyCode = controlId.replace('key-', '');
        
        // Handle digit keys (Digit0-Digit9)
        if (keyCode.startsWith('Digit')) {
            return keyCode.replace('Digit', '');
        }
        
        // Handle letter keys (KeyA-KeyZ)
        if (keyCode.startsWith('Key') && keyCode.length === 4) {
            return keyCode.replace('Key', '');
        }
        
        // Handle special keys with displayable characters
        const specialKeys = {
            'Space': '␣',
            'Minus': '-',
            'Equal': '=',
            'BracketLeft': '[',
            'BracketRight': ']',
            'Backslash': '\\',
            'Semicolon': ';',
            'Quote': "'",
            'Comma': ',',
            'Period': '.',
            'Slash': '/',
            'Backquote': '`'
        };
        
        if (specialKeys[keyCode]) {
            return specialKeys[keyCode];
        }
        
        return null;
    }

    // Extract pan/tilt positions from animation keyframes
    function extractPanTiltKeyframes(animation) {
        if (!animation || !animation.keyframes || animation.keyframes.length === 0) {
            return [];
        }

        // Check if animation has pan/tilt controls
        const hasPanTilt = animation.controls && animation.controls.includes('Pan/Tilt');
        if (!hasPanTilt) return [];

        // Extract pan/tilt values from each keyframe
        return animation.keyframes
            .map(keyframe => {
                const values = keyframe.values || {};
                const panTilt = values['Pan/Tilt'];
                
                if (panTilt && typeof panTilt === 'object') {
                    // Convert 0-255 to percentage, accounting for dot size (10px on 32px = ~31%)
                    // Constrain to 15% - 85% to keep dot edges within bounds
                    const rawX = (panTilt.x ?? 128) / 255;
                    const rawY = (panTilt.y ?? 128) / 255;
                    return {
                        x: 15 + (rawX * 70),
                        y: 15 + ((1 - rawY) * 70)
                    };
                }
                return null;
            })
            .filter(pos => pos !== null);
    }

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

        // Extract colors from each keyframe using getKeyframeColor
        const colors = animation.keyframes.map(keyframe => getKeyframeColor(keyframe));

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

    // Helper to check if a control is present
    const hasControl = $derived.by(() => {
        const ctls = effectiveControls();
        return (controlName) => ctls.includes(controlName);
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
    <!-- Dark gray background (for devices/controls, and buttons/pads - not for knobs/sliders) -->
    {#if type !== 'input' || (type === 'input' && (data.type === 'button' || data.type === 'pad' || !data.type))}
        <div class="preview-base"></div>
    {/if}

    {#if type === 'device' || type === 'controls'}
        <!-- Fixed layer order from bottom to top -->
        
        <!-- Base color layer -->
        {#if hasControl('color')}
            <div 
                class="control-layer control-color" 
                style="background-color: {effectiveData().color || '#888'}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
            ></div>
        {/if}

        <!-- Amber layer -->
        {#if hasControl('amber')}
            {@const amberOpacity = ((effectiveData().amber ?? 0) / 255) * 0.5}
            <div class="control-layer control-amber" style="background-color: rgba(255, 191, 0, {amberOpacity})"></div>
        {/if}

        <!-- White layer -->
        {#if hasControl('white')}
            {@const whiteOpacity = ((effectiveData().white ?? 0) / 255) * 0.5}
            <div class="control-layer control-white" style="background-color: rgba(255, 255, 255, {whiteOpacity})"></div>
        {/if}

        <!-- Intensity layer (deprecated) -->
        {#if hasControl('intensity')}
            {@const intensityOpacity = ((effectiveData().intensity ?? 0) / 255)}
            <div class="control-layer control-intensity" style="background-color: rgba(0, 0, 0, {1 - intensityOpacity})"></div>
        {/if}

        <!-- Dimmer layer (on top of all color layers) -->
        {#if hasControl('dimmer')}
            {@const dimmerValue = effectiveData().dimmer ?? 0}
            {@const blackOpacity = dimmerValue / 255}
            <div class="control-layer control-dimmer" style="background-color: rgba(0, 0, 0, {blackOpacity})"></div>
        {/if}

        <!-- Strobe layer (on top of all color layers) -->
        {#if hasControl('strobe')}
            {@const strobeValue = effectiveData().strobe ?? 0}
            {@const strobeSpeed = strobeValue > 0 ? Math.max(0.1, (255 - strobeValue) / 255 * 2) : 0}
            <div class="control-layer control-strobe" class:strobe-active={strobeValue > 0} style="--strobe-duration: {strobeSpeed}s"></div>
        {/if}

        <!-- Smoke layer -->
        {#if hasControl('smoke')}
            {@const smokePercent = ((effectiveData().smoke ?? 0) / 255) * 100}
            <div class="control-layer control-smoke">
                <div class="smoke-effect" style="opacity: {smokePercent / 100}"></div>
            </div>
        {/if}

        <!-- Flame layer -->
        {#if hasControl('flame')}
            {@const flamePercent = ((effectiveData().flame ?? 0) / 255) * 100}
            <div
                class="control-layer control-flame"
                style="background: linear-gradient(to top, #ff5722 0%, #ff9800 {flamePercent/2}%, #ffc107 {flamePercent}%, #1a1a1a {flamePercent}%, #1a1a1a 100%)"
            ></div>
        {/if}

        <!-- Safety layer (on top of flame) -->
        {#if hasControl('safety')}
            {@const safetyOn = (effectiveData().safety ?? 0) >= 125}
            <div class="control-layer control-safety" style="background: {safetyOn ? 'transparent' : '#222222'}">
                {#if safetyOn}
                    <div class="safety-checkmark"></div>
                {:else}
                    <div class="safety-cross"></div>
                {/if}
            </div>
        {/if}

        <!-- Pan/Tilt layer -->
        {#if hasControl('pantilt')}
            {@const rawX = (effectiveData().pan ?? 0) / 255}
            {@const rawY = (effectiveData().tilt ?? 0) / 255}
            {@const dotX = 15 + (rawX * 70)}
            {@const dotY = 15 + ((1 - rawY) * 70)}
            <div class="control-layer control-pantilt">
                <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
            </div>
        {/if}

    {:else if type === 'animation'}
        <!-- Animation preview with gradient -->
        {@const animationPreview = generateAnimationPreview(data)}
        {@const panTiltPositions = extractPanTiltKeyframes(data)}
        <div 
            class="preview-animation" 
            style="background: {animationPreview}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
        >
            <!-- Show pan/tilt keyframe positions -->
            {#each panTiltPositions as position}
                <div class="pan-tilt-keyframe" style="left: {position.x}%; top: {position.y}%"></div>
            {/each}
        </div>

    {:else if type === 'input'}
        <!-- Input preview based on type -->
        {@const inputType = data.type || 'button'}
        {@const inputColor = (data.color && data.colorSupport && data.colorSupport !== 'none') ? paletteColorToHex(data.color) : '#888'}
        {@const orientation = data.orientation || 'vertical'}
        {@const value = stateValue ? parseFloat(stateValue) : 0}
        {@const knobAngle = -135 + (value * 2.7)} <!-- 7 o'clock to 5 o'clock = -135deg to +135deg = 270 degrees total -->
        {@const sliderPosition = value * 0.7} <!-- Adjust for 30% handle size: 0% -> 0%, 100% -> 70% -->
        {@const keyChar = data.inputControlId?.startsWith('key-') ? extractKeyChar(data.inputControlId) : null}
        
        {#if inputType === 'button' || inputType === 'pad'}
            <!-- Button/Pad: colored or gray square -->
            <div 
                class="preview-input button-preview" 
                style="background: {inputColor}; {euler ? `box-shadow: ${dynamicShadow()};` : ''}"
            >
                <!-- Show keyboard key character if available -->
                {#if keyChar}
                    <div class="key-char">{keyChar}</div>
                {/if}
            </div>
            
            <!-- Orientation indicator dot for Thingy:52 (represents the hole) -->
            {#if euler}
                <div class="orientation-indicator"></div>
            {/if}
            
        {:else if inputType === 'knob'}
            <!-- Knob: circle with rotating dot -->
            <div class="preview-input knob-preview" style="background: {inputColor};">
                <div class="knob-dot" style="transform: rotate({knobAngle}deg) translateY(100%);"></div>
            </div>
            
        {:else if inputType === 'slider'}
            <!-- Slider: track with handle -->
            {#if orientation === 'horizontal'}
                <div class="preview-input slider-preview horizontal">
                    <div class="slider-track"></div>
                    <div class="slider-handle" style="background: {inputColor}; left: {sliderPosition}%;"></div>
                </div>
            {:else}
                <div class="preview-input slider-preview vertical">
                    <div class="slider-track"></div>
                    <div class="slider-handle" style="background: {inputColor}; bottom: {sliderPosition}%;"></div>
                </div>
            {/if}
        {/if}
    {/if}

    <!-- Top inset shadow layer (hidden for knobs, sliders, and Thingy with euler angles) -->
    {#if type === 'input'}
        {@const inputType = data.type || 'button'}
        {#if inputType !== 'knob' && inputType !== 'slider' && !euler}
            <div class="preview-inset-shadow"></div>
        {/if}
    {:else if !euler}
        <div class="preview-inset-shadow"></div>
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

    /* Color layer has outer shadow only */
    .control-color {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
    }

    /* Top inset shadow layer */
    .preview-inset-shadow {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2);
        z-index: 100;
    }

    /* Button preview - square */
    .button-preview {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Keyboard key character */
    .key-char {
        font-size: 18px;
        font-weight: 600;
        color: rgba(255,255,255,0.5);
        user-select: none;
        margin-top: -3px;
    }

    /* Knob preview - circle with rotating dot */
    .knob-preview {
        border-radius: 50%;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .knob-dot {
        position: absolute;
        width: 20%;
        height: 20%;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        transform-origin: center center;
    }

    /* Slider preview - track with handle */
    .slider-preview {
        position: relative;
    }

    .slider-preview.horizontal {
        padding: 6px 0;
    }

    .slider-preview.vertical {
        padding: 0 6px;
    }

    .slider-track {
        position: absolute;
        background: #c0c0c0;
        border-radius: 2px;
    }

    .slider-preview.horizontal .slider-track {
        left: 0;
        right: 0;
        top: 50%;
        height: 3px;
        transform: translateY(-50%);
    }

    .slider-preview.vertical .slider-track {
        top: 0;
        bottom: 0;
        left: 50%;
        width: 3px;
        transform: translateX(-50%);
    }

    .slider-handle {
        position: absolute;
        border-radius: 6px;
        box-shadow: inset 0 -3px 0px 0px rgba(0, 0, 0, 0.2);
        transition: left 0.1s, bottom 0.1s;
    }

    .slider-preview.horizontal .slider-handle {
        width: 30%;
        height: 100%;
        top: 0;
    }

    .slider-preview.vertical .slider-handle {
        width: 100%;
        height: 30%;
        left: 0;
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

    /* Dimmer layer (black overlay) */
    .control-dimmer {
        pointer-events: none;
    }

    /* Strobe layer (black overlay with animation) */
    .control-strobe {
        background-color: #000;
        opacity: 0;
        pointer-events: none;
    }

    .control-strobe.strobe-active {
        animation: strobe var(--strobe-duration, 1s) linear infinite;
    }

    @keyframes strobe {
        0%, 45% {
            opacity: 0;
        }
        50%, 95% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    /* Pan/Tilt indicator */
    .pan-tilt-indicator {
        position: absolute;
        width: 10px;
        height: 10px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 10;
    }

    /* Smaller dots for small and medium previews */
    .preview-small .pan-tilt-indicator,
    .preview-medium .pan-tilt-indicator {
        width: 6px;
        height: 6px;
    }

    /* Pan/Tilt keyframe positions for animation preview */
    .pan-tilt-keyframe {
        position: absolute;
        width: 10px;
        height: 10px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 10;
    }

    /* Smaller dots for small and medium previews */
    .preview-small .pan-tilt-keyframe,
    .preview-medium .pan-tilt-keyframe {
        width: 6px;
        height: 6px;
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
