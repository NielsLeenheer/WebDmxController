<script>
    import XYPad from './XYPad.svelte';
    import ToggleSwitch from '../common/ToggleSwitch.svelte';

    let {
        controls, // Array of control definitions
        values = $bindable({}), // Control values object (e.g., { "Color": { r, g, b }, "Dimmer": 255 })
        onChange = null, // Callback: (controlName, value) => void
        disabledControls = [], // Array of control names that should be disabled
        enabledControls = $bindable(null), // Optional: array of enabled control names, null = show all without checkboxes
        showCheckboxes = false // Whether to show enable/disable checkboxes
    } = $props();

    // Initialize enabledControls if showCheckboxes is true and enabledControls is null
    $effect(() => {
        if (showCheckboxes && enabledControls === null) {
            enabledControls = controls.map(c => c.name);
        }
    });

    function isControlEnabled(control) {
        if (!showCheckboxes || enabledControls === null) return true;
        return enabledControls.includes(control.name);
    }

    function toggleControlEnabled(control) {
        if (!showCheckboxes || enabledControls === null) return;

        if (enabledControls.includes(control.name)) {
            enabledControls = enabledControls.filter(name => name !== control.name);
        } else {
            enabledControls = [...enabledControls, control.name];
        }
    }

    function handleControlChange(controlName, value) {
        if (onChange) {
            onChange(controlName, value);
        } else {
            // If no onChange handler, mutate directly (for $bindable use case)
            if (typeof value === 'object' && value !== null) {
                values[controlName] = { ...value };
            } else {
                values[controlName] = value;
            }
        }
    }

    function handleRGBComponentChange(controlName, component, value) {
        const currentValue = values[controlName] || { r: 0, g: 0, b: 0 };
        const newValue = { ...currentValue, [component]: value };
        handleControlChange(controlName, newValue);
    }

    function handleXYPadChange(controlName, xValue, yValue) {
        handleControlChange(controlName, { x: xValue, y: yValue });
    }

    function handleToggleChange(controlName, control) {
        // Toggle between off and on values
        const currentValue = values[controlName];
        const newValue = currentValue === control.onValue ? control.offValue : control.onValue;
        handleControlChange(controlName, newValue);
    }

    function handleTextInputChange(controlName, inputValue, e, component = null) {
        const numValue = parseInt(inputValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
            if (component) {
                // RGB component change
                handleRGBComponentChange(controlName, component, numValue);
            } else {
                // Scalar value change
                handleControlChange(controlName, numValue);
            }
        } else if (inputValue === '') {
            // Allow empty for easier editing
            e.target.value = '';
        } else {
            // Invalid value, revert to current value
            if (component) {
                e.target.value = values[controlName]?.[component] ?? 0;
            } else {
                e.target.value = values[controlName] ?? 0;
            }
        }
    }

    function handleTextInput(e) {
        // Only allow digits
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }

    function isControlDisabled(controlName) {
        return disabledControls.includes(controlName);
    }

    // Generate gradient background for slider based on control name
    function getSliderGradient(controlName) {
        switch (controlName) {
            case 'Red':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,0,0) 100%)';
            case 'Green':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,255,0) 100%)';
            case 'Blue':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,0,255) 100%)';
            case 'Amber':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,191,0) 100%)';
            case 'White':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
            case 'Dimmer':
            case 'Intensity':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(255,255,255) 100%)';
            case 'Output':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(200,200,200) 100%)';
            case 'Fuel':
                return 'linear-gradient(to right, rgb(0,0,0) 0%, #ff5722 50%, #ff9800 75%, #ffc107 100%)';
            default:
                return 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(128,128,128) 100%)';
        }
    }

    // Get thumb color based on control name and current value
    function getThumbColor(controlName, value) {
        switch (controlName) {
            case 'Red':
                return `rgb(${value}, 0, 0)`;
            case 'Green':
                return `rgb(0, ${value}, 0)`;
            case 'Blue':
                return `rgb(0, 0, ${value})`;
            case 'Amber':
                return `rgb(${value}, ${Math.round(value * 0.749)}, 0)`;
            case 'White':
                return `rgb(${value}, ${value}, ${value})`;
            case 'Dimmer':
            case 'Intensity':
                return `rgb(${value}, ${value}, ${value})`;
            case 'Output':
                return `rgb(${Math.round(value * 0.784)}, ${Math.round(value * 0.784)}, ${Math.round(value * 0.784)})`;
            case 'Fuel':
                // Interpolate through flame gradient: black -> #ff5722 -> #ff9800 -> #ffc107
                if (value <= 127) {
                    // 0-127: black (0,0,0) to red-orange (255,87,34)
                    const t = value / 127;
                    return `rgb(${Math.round(255 * t)}, ${Math.round(87 * t)}, ${Math.round(34 * t)})`;
                } else if (value <= 191) {
                    // 128-191: red-orange (255,87,34) to orange (255,152,0)
                    const t = (value - 127) / 64;
                    return `rgb(255, ${Math.round(87 + (152 - 87) * t)}, ${Math.round(34 - 34 * t)})`;
                } else {
                    // 192-255: orange (255,152,0) to yellow-orange (255,193,7)
                    const t = (value - 191) / 64;
                    return `rgb(255, ${Math.round(152 + (193 - 152) * t)}, ${Math.round(7 * t)})`;
                }
            default:
                return `rgb(${Math.round(value * 0.5)}, ${Math.round(value * 0.5)}, ${Math.round(value * 0.5)})`;
        }
    }
</script>

<div class="controls">
    {#each controls as control}
        {#if control.type.type === 'xypad' || control.type.type === 'xypad16'}
            {@const controlValue = values[control.name] || { x: 128, y: 128 }}
            {@const controlDisabled = isControlDisabled(control.name) || !isControlEnabled(control)}
            <div class="control-xypad">
                <div class="control-header">
                    {#if showCheckboxes}
                        <input
                            type="checkbox"
                            checked={isControlEnabled(control)}
                            onchange={() => toggleControlEnabled(control)}
                            class="control-checkbox"
                        />
                    {/if}
                    <label>{control.name}</label>
                </div>
                <div class="xypad-wrapper" class:disabled={controlDisabled}>
                    <XYPad
                        panValue={controlValue.x}
                        tiltValue={controlValue.y}
                        onUpdate={(x, y) => !controlDisabled && handleXYPadChange(control.name, x, y)}
                    />
                </div>
                <div class="xypad-inputs">
                    <input
                        type="text"
                        value={controlValue.x}
                        oninput={handleTextInput}
                        onchange={(e) => !controlDisabled && handleXYPadChange(control.name, parseInt(e.target.value) || 0, controlValue.y)}
                        class="value-input"
                        title="X"
                        disabled={controlDisabled}
                        maxlength="3"
                    />
                    <input
                        type="text"
                        value={controlValue.y}
                        oninput={handleTextInput}
                        onchange={(e) => !controlDisabled && handleXYPadChange(control.name, controlValue.x, parseInt(e.target.value) || 0)}
                        class="value-input"
                        title="Y"
                        disabled={controlDisabled}
                        maxlength="3"
                    />
                </div>
            </div>
        {:else if control.type.type === 'rgb' || control.type.type === 'rgba'}
            {@const colorValue = values[control.name] || { r: 0, g: 0, b: 0 }}
            {@const controlDisabled = isControlDisabled(control.name) || !isControlEnabled(control)}
            <!-- Red -->
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={controlDisabled}>Red</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={colorValue.r}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.name, 'r', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Red')}; --thumb-color: {getThumbColor('Red', colorValue.r)}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.r} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.name, e.target.value, e, 'r')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
            <!-- Green -->
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Green</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={colorValue.g}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.name, 'g', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Green')}; --thumb-color: {getThumbColor('Green', colorValue.g)}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.g} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.name, e.target.value, e, 'g')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
            <!-- Blue -->
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Blue</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={colorValue.b}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.name, 'b', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Blue')}; --thumb-color: {getThumbColor('Blue', colorValue.b)}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.b} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.name, e.target.value, e, 'b')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
        {:else if control.type.type === 'toggle'}
            {@const controlValue = values[control.name] ?? control.offValue}
            {@const controlDisabled = isControlDisabled(control.name) || !isControlEnabled(control)}
            {@const isOn = controlValue === control.onValue}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={controlDisabled}>{control.name}</label>
                <div class="toggle-wrapper">
                    <ToggleSwitch
                        checked={isOn}
                        disabled={controlDisabled}
                        onchange={() => handleToggleChange(control.name, control)}
                        label="{control.name}"
                    />
                </div>
                <input
                    type="text"
                    value={controlValue}
                    oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.name, e.target.value, e)}
                    class="value-input"
                    disabled={controlDisabled}
                    maxlength="3"
                />
            </div>
        {:else if control.type.type === 'slider'}
            {@const controlValue = values[control.name] ?? 0}
            {@const controlDisabled = isControlDisabled(control.name) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={controlDisabled}>{control.name}</label>
                <div class="slider-wrapper">
                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={controlValue}
                        oninput={(e) => !controlDisabled && handleControlChange(control.name, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control.name)}; --thumb-color: {getThumbColor(control.name, controlValue)}"
                        disabled={controlDisabled}
                        class="color-slider"
                    />
                </div>
                <input
                    type="text"
                    value={controlValue}
                    oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.name, e.target.value, e)}
                    class="value-input"
                    disabled={controlDisabled}
                    maxlength="3"
                />
            </div>
        {/if}
    {/each}
</div>

<style>
    .controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .control {
        display: grid;
        grid-template-columns: 16px 4em 1fr 3em;
        gap: 8px;
        align-items: center;
    }

    .control.no-checkbox {
        grid-template-columns: 4em 1fr 3em;
    }

    .control label {
        font-size: 9pt;
        font-weight: 500;
        color: #555;
    }

    .control label.disabled {
        color: #999;
        opacity: 0.5;
    }

    .slider-wrapper {
        position: relative;
        width: 100%;
    }

    /* Custom slider styles */
    .color-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 7px;
        border-radius: 3.5px;
        background: var(--slider-gradient);
        cursor: pointer;
        outline: none;
    }

    .color-slider:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Webkit (Chrome, Safari) thumb */
    .color-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--thumb-color, #888);
        outline: 2px solid rgba(255,255,255,0.6);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    .color-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    /* Firefox thumb */
    .color-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--thumb-color, #888);
        outline: 2px solid rgba(255,255,255,0.6);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    .color-slider::-moz-range-thumb:hover {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    /* Firefox track */
    .color-slider::-moz-range-track {
        background: transparent;
        border: none;
    }

    .value-input {
        width: 4em;
        border: none !important;
        background: transparent;
        padding: 4px !important;
        font-size: 9pt !important;
        font-family: var(--font-stack-mono);
        text-align: right;
        border-radius: 5px;
    }

    .value-input:focus {
        outline: none;
        background: #fff;
    }

    .control input:disabled {
        opacity: 0.1;
        cursor: not-allowed;
    }

    .control-xypad {
        display: grid;
        grid-template-columns: 4em 1fr 3em;
        gap: 8px;
        align-items: start;
    }

    .control-xypad label {
        font-size: 9pt;
        font-weight: 500;
        color: #555;
    }

    .xypad-inputs {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .xypad-inputs input {
        width: 4em;
    }

    .xypad-wrapper {
        padding-left: 7px;
        padding-bottom: 6px;
    }
    .xypad-wrapper.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    /* Toggle switch styles */
    .toggle-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* Checkbox support styles */
    .control-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .control-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
        margin: 0;
        flex-shrink: 0;
    }
</style>
