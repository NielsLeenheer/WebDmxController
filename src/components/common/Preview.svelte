<script>
    import { DEVICE_TYPES } from '../../lib/outputs/devices.js';
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

    // Extract displayable symbol from gamepad button control ID based on brand
    function extractGamepadSymbol(controlId, gamepadBrand) {
        if (!controlId || !controlId.startsWith('button-')) return null;
        
        const buttonIndex = parseInt(controlId.replace('button-', ''), 10);
        
        // Face button symbols by brand (indices 0-3)
        // Standard gamepad mapping: 0=bottom, 1=right, 2=left, 3=top
        const faceButtonSymbols = {
            // Sony: Cross (bottom), Circle (right), Square (left), Triangle (top)
            sony: {
                0: '✕',      // Cross
                1: '○',      // Circle  
                2: '□',      // Square
                3: '△',      // Triangle
            },
            // Nintendo: B (bottom), A (right), Y (left), X (top)
            nintendo: {
                0: 'B',
                1: 'A',
                2: 'Y',
                3: 'X',
            },
            // Xbox/Default: A (bottom), B (right), X (left), Y (top)
            xbox: {
                0: 'A',
                1: 'B',
                2: 'X',
                3: 'Y',
            },
        };
        
        // Common button symbols (non-face buttons)
        const commonButtonSymbols = {
            4: 'L1',
            5: 'R1',
            6: 'L2',
            7: 'R2',
            8: '⊏',      // Select/Share
            9: '⊐',      // Start/Options
            10: 'L3',
            11: 'R3',
            12: '▲',     // D-Up
            13: '▼',     // D-Down
            14: '◀',     // D-Left
            15: '▶',     // D-Right
            16: '⌂',     // Home
        };
        
        // Face buttons (0-3) use brand-specific symbols
        if (buttonIndex >= 0 && buttonIndex <= 3) {
            const brand = gamepadBrand || 'xbox';
            return faceButtonSymbols[brand]?.[buttonIndex] || faceButtonSymbols.xbox[buttonIndex];
        }
        
        // Other buttons use common symbols
        return commonButtonSymbols[buttonIndex] ?? null;
    }

    // Extract pan/tilt positions from animation keyframes
    function extractPanTiltKeyframes(animation) {
        if (!animation || !animation.keyframes || animation.keyframes.length === 0) {
            return [];
        }

        // Check if animation has pan/tilt controls (using device control id)
        const hasPanTilt = animation.controls && animation.controls.includes('pantilt');
        if (!hasPanTilt) return [];

        // Extract pan/tilt values from each keyframe
        return animation.keyframes
            .map(keyframe => {
                const values = keyframe.values || {};
                const panTilt = values['pantilt'];
                
                if (panTilt && typeof panTilt === 'object') {
                    // Convert 0-255 to percentage, accounting for dot size (10px on 32px = ~31%)
                    // Constrain to 15% - 85% to keep dot edges within bounds
                    const rawX = (panTilt.pan ?? 128) / 255;
                    const rawY = (panTilt.tilt ?? 128) / 255;
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

        // Check if animation has color-related controls (using device control ids)
        const hasColor = animation.controls && (
            animation.controls.includes('color') ||
            animation.controls.includes('amber') ||
            animation.controls.includes('white')
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
                // Use the control definition's id (e.g., 'pantilt', 'color', 'dimmer')
                controlsList.push(control.id);
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
                // Use the control definition's id as the key
                const value = controlValues[control.id];
                result[control.id] = value;
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
        // Negate pitch for correct tilt direction, add 8 degrees to show bottom edge at rest
        return `rotateX(${-screenPitch + 20}deg) rotateY(${screenRoll}deg) rotateZ(${euler.yaw}deg)`;
    });

    // Check if we need 3D overflow (for euler or axis inputs)
    const needs3DOverflow = $derived(() => {
        return euler !== null || (type === 'input' && data.type === 'axis');
    });
</script>

<div class="preview {sizeClass} {className}" class:with-3d={needs3DOverflow()} style="{euler ? `transform: ${transform3D()};` : ''}">
    
    {#if type === 'device' || type === 'controls'}
        <div class="preview-base"></div>
        
        <!-- Base color layer -->
        {#if hasControl('color')}
            {@const colorValue = effectiveData().color}
            {@const color = colorValue ? `rgb(${colorValue.red ?? 0}, ${colorValue.green ?? 0}, ${colorValue.blue ?? 0})` : 'transparent'}
            <div 
                class="control-layer control-color" 
                style="background-color: {color}"
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
            {@const pantiltValue = effectiveData().pantilt ?? { pan: 0, tilt: 0 }}
            {@const rawX = (pantiltValue.pan ?? 0) / 255}
            {@const rawY = (pantiltValue.tilt ?? 0) / 255}
            {@const dotX = 15 + (rawX * 70)}
            {@const dotY = 15 + ((1 - rawY) * 70)}
            <div class="control-layer control-pantilt">
                <div class="pan-tilt-indicator" style="left: {dotX}%; top: {dotY}%"></div>
            </div>
        {/if}

        <div class="preview-inset-shadow"></div>

    {:else if type === 'animation'}
        <div class="preview-base"></div>

        <!-- Animation preview with gradient -->
        {@const animationPreview = generateAnimationPreview(data)}
        {@const panTiltPositions = extractPanTiltKeyframes(data)}
        <div 
            class="preview-animation" 
            style="background: {animationPreview};"
        >
            <!-- Show pan/tilt keyframe positions -->
            {#each panTiltPositions as position}
                <div class="pan-tilt-keyframe" style="left: {position.x}%; top: {position.y}%"></div>
            {/each}
        </div>

        <div class="preview-inset-shadow"></div>

    {:else if type === 'input'}
        <!-- Input preview based on type -->
        {@const inputType = data.type || 'button'}
        {@const inputColor = (data.color && data.colorSupport && data.colorSupport !== 'none') ? paletteColorToHex(data.color) : '#888'}
        {@const orientation = data.orientation || 'vertical'}
        {@const defaultValue = inputType === 'axis' ? 50 : 0}
        {@const value = stateValue ? parseFloat(stateValue) : defaultValue}
        {@const knobAngle = 30 + (value * 2.7)} <!-- 7 o'clock to 5 o'clock = 30deg to 300deg = 270 degrees total (0deg = 6 o'clock, clockwise) -->
        {@const sliderPosition = value * 0.7} <!-- Adjust for 30% handle size: 0% -> 0%, 100% -> 70% -->
        {@const axisTilt = (value - 50) * 1.1} <!-- 0% = -55deg, 50% = 0deg (flat), 100% = +55deg -->
        {@const axisDotOffset = (value - 50) * 0.6} <!-- Dot moves from -30% to +30% based on value -->
        {@const keyChar = data.controlId?.startsWith('key-') ? extractKeyChar(data.controlId) : null}
        {@const isGamepad = data.deviceId?.startsWith('gamepad-')}
        {@const gamepadSymbol = isGamepad && data.controlId?.startsWith('button-') ? extractGamepadSymbol(data.controlId, data.deviceBrand) : null}
        {@const gamepadButtonClass = isGamepad && data.controlId?.startsWith('button-') ? `gamepad-${data.controlId}` : ''}
        {@const inputNameClass = data.name ? `input-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : ''}
        
        
        {#if inputType === 'thingy'}
            <!-- Thingy:52 input preview -->
            {#if euler}
                <!-- 3D layered -->
                {@const inputColor = (data.color && data.colorSupport && data.colorSupport !== 'none') ? paletteColorToHex(data.color) : '#888'}
                
                <!-- Multiple layers with translateZ for depth -->
                {#each Array(12) as _, i}
                    {@const zOffset = i * 1}
                    {@const brightness = i === 11 ? 1 : (0.5 + ((i / 10) * 0.2))}
                    <div class="layer-3d" style="transform: translateZ({zOffset}px); background: {inputColor}; filter: brightness({brightness});">
                        {#if i === 11}
                            <!-- Top layer - add orientation indicator -->
                            <div class="orientation-indicator"></div>
                        {/if}
                    </div>
                {/each}
            {:else}
                <div class="preview-base"></div>

                <!-- Flat -->
                <div class="preview-input button-preview thingy-input" style="background: {inputColor};">
                    <div class="orientation-indicator"></div>
                </div>

                <div class="preview-inset-shadow"></div>
            {/if}

        {:else if inputType === 'button' || inputType === 'pad'}
            <div class="preview-base"></div>
    
            <!-- Button/Pad: square with character or gamepad symbol -->
            {#if isGamepad}
                <div class="preview-input button-preview {inputType}-input {inputNameClass} {gamepadButtonClass}" style="background: #555;">
                    {#if gamepadSymbol}
                        <div class="gamepad-symbol" class:small-text={gamepadSymbol.length > 1}>{gamepadSymbol}</div>
                    {/if}
                </div>
            {:else}
                <div class="preview-input button-preview {inputType}-input {inputNameClass}" style="background: {inputColor};">
                    {#if keyChar}
                        <div class="key-char">{keyChar}</div>
                    {/if}
                </div>
            {/if}

            <div class="preview-inset-shadow"></div>

            
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
            
        {:else if inputType === 'axis'}
            <!-- Axis: 3D tilting disc on a stick -->
            {@const axisTransform = orientation === 'horizontal' ? `rotateY(${axisTilt}deg)` : `rotateX(${-axisTilt}deg)`}
            <div class="preview-input axis-wrapper" style="transform: {axisTransform};">
                <!-- 8 small depth layers (the stick) from -25px to -11px at 2px intervals -->
                {#each Array(8) as _, i}
                    {@const zOffset = -25 + (i * 2)}
                    {@const brightness = 0.3 + ((i / 7) * 0.4)}
                    <div 
                        class="axis-stick-layer" 
                        style="transform: translateZ({zOffset}px); background: #555; filter: brightness({brightness});"
                    ></div>
                {/each}
                <!-- Top layer: the disc -->
                <div 
                    class="axis-disc-layer" 
                    style="transform: translateZ(0px); background: #666;"
                ></div>

                <!-- Circle for indent in the disc -->
                <div 
                    class="axis-disc-indent" 
                    style="transform: translateZ(1px);"
                ></div>
            </div>
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

        --shadow-size: 3px;
        --adjust-symbol-y: 0px;
        --adjust-symbol-x: 0px;
    }

    /* Enable 3D perspective for rotating previews */
    .preview.with-3d {
        perspective: 200px;
        overflow: visible;
    }

    /* Individual 3D layers */
    .layer-3d {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        border-radius: inherit;
        corner-shape: inherit;
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
        corner-shape: inherit;
    }

    /* Control layers stack on top of base */
    .control-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        corner-shape: inherit;
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
        corner-shape: inherit;
    }

    /* Top inset shadow layer */
    .preview-inset-shadow {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        corner-shape: inherit;
        pointer-events: none;
        box-shadow: inset 0 calc(var(--shadow-size) * -1) 0px 0px rgba(0, 0, 0, 0.2);
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

    /* Custom gamepad button shapes */

    .input-preview:has(.input-l1),
    .input-preview:has(.input-r1) {
        border-top-left-radius: 30%;
        border-top-right-radius: 30%;
    }

    .input-preview:has(.input-l2),
    .input-preview:has(.input-r2) {
        border-bottom-left-radius: 40% 80%;
        border-bottom-right-radius: 40% 80%;
    }

    .input-preview:has(.input-d-up),
    .input-preview:has(.input-d-down),
    .input-preview:has(.input-d-left),
    .input-preview:has(.input-d-right) {
        --corner-radius: 25%;
    }

    .input-preview:has(.input-d-up) {
        corner-bottom-left-shape: bevel;
        corner-bottom-right-shape: bevel;
        border-bottom-left-radius: var(--corner-radius);
        border-bottom-right-radius: var(--corner-radius);
        --adjust-symbol-y: -3px;
    }

    .input-preview:has(.input-d-down) {
        corner-top-left-shape: bevel;
        corner-top-right-shape: bevel;
        border-top-left-radius: var(--corner-radius);
        border-top-right-radius: var(--corner-radius);
        --adjust-symbol-y: 3px;
    }

    .input-preview:has(.input-d-left) {
        corner-top-right-shape: bevel;
        corner-bottom-right-shape: bevel;
        border-top-right-radius: var(--corner-radius);
        border-bottom-right-radius: var(--corner-radius);
        --adjust-symbol-x: -3px;
    }

    .input-preview:has(.input-d-right) {
        corner-top-left-shape: bevel;
        corner-bottom-left-shape: bevel;
        border-top-left-radius: var(--corner-radius);
        border-bottom-left-radius: var(--corner-radius);
        --adjust-symbol-x: 3px;
    }

    .input-preview:has(.input-cross),
    .input-preview:has(.input-circle),
    .input-preview:has(.input-square),
    .input-preview:has(.input-triangle) {
        border-radius: 50%;
        --adjust-symbol-y: 2px;
    }

    /* Gamepad button symbol */
    .gamepad-symbol {
        font-size: 15px;
        font-weight: 600;
        color: rgba(255,255,255,0.8);
        user-select: none;
        margin-top: calc(var(--adjust-symbol-y, 0px) + -3px);
        margin-left: var(--adjust-symbol-x, 0px);
    }

    .gamepad-symbol.small-text {
        font-size: 12px;
        font-weight: 700;
    }

    .input-cross .gamepad-symbol { color: rgb(177, 177, 250); }
    .input-circle .gamepad-symbol { color: rgb(245, 186, 150); }
    .input-square .gamepad-symbol { color: rgb(215, 157, 215); }
    .input-triangle .gamepad-symbol { color: rgb(134, 213, 203); }


    /* Knob preview - circle with rotating dot */
    .knob-preview {
        border-radius: 50%;
        box-shadow: inset 0 calc(var(--shadow-size) * -1) 0px 0px rgba(0, 0, 0, 0.2);
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

    /* Axis preview - wrapper provides perspective and holds the transform */
    .axis-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        perspective: 80px;
        transform-style: preserve-3d;
        transform-origin: center center -20px;
    }

    /* Axis stick layers (small, behind the disc) */
    .axis-stick-layer {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 15%;
        height: 15%;
        margin-left: -7.5%;
        margin-top: -7.5%;
        border-radius: 50%;
        transform-style: preserve-3d;
    }

    /* Axis disc layer (full size, on top) */
    .axis-disc-layer {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        margin-left: -50%;
        margin-top: -50%;
        border-radius: 50%;
        transform-style: preserve-3d;
        box-shadow: inset 0 calc(var(--shadow-size) * -1) 0px 0px rgba(0, 0, 0, 0.2);
    }

    .axis-disc-indent {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 60%;
        height: 60%;
        margin-left: -30%;
        margin-top: -30%;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.1);
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
        box-shadow: inset 0 calc(var(--shadow-size) * -1) 0px 0px rgba(0, 0, 0, 0.2);
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
        transform: translate(-60%, -55%) rotate(-90deg);
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
        corner-shape: inherit;
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
