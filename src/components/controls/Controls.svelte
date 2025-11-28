<script>
    import XYPad from './XYPad.svelte';
    import ToggleSwitch from '../common/ToggleSwitch.svelte';

    let {
        controls, // Array of control definitions
        values = $bindable({}), // Control values object (e.g., { "color": { red, green, blue }, "dimmer": 255 })
        onChange = null, // Callback: (controlId, value) => void
        disabledControls = [], // Array of control ids that should be disabled
        enabledControls = $bindable(null), // Optional: array of enabled control ids, null = show all without checkboxes
        showCheckboxes = false // Whether to show enable/disable checkboxes
    } = $props();

    // Initialize enabledControls if showCheckboxes is true and enabledControls is null
    $effect(() => {
        if (showCheckboxes && enabledControls === null) {
            enabledControls = controls.map(c => c.id);
        }
    });

    function isControlEnabled(control) {
        if (!showCheckboxes || enabledControls === null) return true;
        return enabledControls.includes(control.id);
    }

    function toggleControlEnabled(control) {
        if (!showCheckboxes || enabledControls === null) return;

        if (enabledControls.includes(control.id)) {
            enabledControls = enabledControls.filter(id => id !== control.id);
        } else {
            enabledControls = [...enabledControls, control.id];
        }
    }

    function handleControlChange(controlId, value) {
        if (onChange) {
            onChange(controlId, value);
        } else {
            // If no onChange handler, mutate directly (for $bindable use case)
            if (typeof value === 'object' && value !== null) {
                values[controlId] = { ...value };
            } else {
                values[controlId] = value;
            }
        }
    }

    function handleRGBComponentChange(controlId, component, value) {
        const currentValue = values[controlId] || { red: 0, green: 0, blue: 0 };
        const newValue = { ...currentValue, [component]: value };
        handleControlChange(controlId, newValue);
    }

    function handleXYPadChange(controlId, panValue, tiltValue) {
        handleControlChange(controlId, { pan: panValue, tilt: tiltValue });
    }

    function handleToggleChange(controlId, control) {
        // Toggle between off and on values
        const currentValue = values[controlId];
        const onValue = control.type.onValue;
        const offValue = control.type.offValue;
        const newValue = currentValue === onValue ? offValue : onValue;
        handleControlChange(controlId, newValue);
    }

    function handleTextInputChange(controlId, inputValue, e, component = null) {
        const numValue = parseInt(inputValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
            if (component) {
                // RGB component change
                handleRGBComponentChange(controlId, component, numValue);
            } else {
                // Scalar value change
                handleControlChange(controlId, numValue);
            }
        } else if (inputValue === '') {
            // Allow empty for easier editing
            e.target.value = '';
        } else {
            // Invalid value, revert to current value
            if (component) {
                e.target.value = values[controlId]?.[component] ?? 0;
            } else {
                e.target.value = values[controlId] ?? 0;
            }
        }
    }

    function handleTextInput(e) {
        // Only allow digits
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }

    function isControlDisabled(controlId) {
        return disabledControls.includes(controlId);
    }

    // Generate gradient background for slider based on control
    function getSliderGradient(control, component = null) {
        return control.type.getGradient?.(component) 
            || 'linear-gradient(to right, rgb(0,0,0) 0%, rgb(128,128,128) 100%)';
    }

    // Get thumb color based on control and current value
    function getThumbColor(control, value, component = null) {
        return control.type.getColor?.(value, component)
            || `rgb(${Math.round(value * 0.5)}, ${Math.round(value * 0.5)}, ${Math.round(value * 0.5)})`;
    }
</script>

<div class="controls">
    {#each controls as control}
        {#if control.type.type === 'xypad' || control.type.type === 'xypad16'}
            {@const controlValue = values[control.id] || { pan: 128, tilt: 128 }}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
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
                    <label>{control.type.name}</label>
                </div>
                <div class="xypad-wrapper" class:disabled={controlDisabled}>
                    <XYPad
                        panValue={controlValue.pan}
                        tiltValue={controlValue.tilt}
                        onUpdate={(pan, tilt) => !controlDisabled && handleXYPadChange(control.id, pan, tilt)}
                    />
                </div>
                <div class="xypad-inputs">
                    <input
                        type="text"
                        value={controlValue.pan}
                        oninput={handleTextInput}
                        onchange={(e) => !controlDisabled && handleXYPadChange(control.id, parseInt(e.target.value) || 0, controlValue.tilt)}
                        class="value-input"
                        title="Pan"
                        disabled={controlDisabled}
                        maxlength="3"
                    />
                    <input
                        type="text"
                        value={controlValue.tilt}
                        oninput={handleTextInput}
                        onchange={(e) => !controlDisabled && handleXYPadChange(control.id, controlValue.pan, parseInt(e.target.value) || 0)}
                        class="value-input"
                        title="Tilt"
                        disabled={controlDisabled}
                        maxlength="3"
                    />
                </div>
            </div>
        {:else if control.type.type === 'rgb'}
            {@const colorValue = values[control.id] || { red: 0, green: 0, blue: 0 }}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
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
                    <input type="range" min="0" max="255" value={colorValue.red}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.id, 'red', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control, 'red')}; --thumb-color: {getThumbColor(control, colorValue.red, 'red')}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.red} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.id, e.target.value, e, 'red')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
            <!-- Green -->
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Green</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={colorValue.green}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.id, 'green', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control, 'green')}; --thumb-color: {getThumbColor(control, colorValue.green, 'green')}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.green} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.id, e.target.value, e, 'green')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
            <!-- Blue -->
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Blue</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={colorValue.blue}
                        oninput={(e) => !controlDisabled && handleRGBComponentChange(control.id, 'blue', parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control, 'blue')}; --thumb-color: {getThumbColor(control, colorValue.blue, 'blue')}"
                        disabled={controlDisabled} class="color-slider" />
                </div>
                <input type="text" value={colorValue.blue} oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.id, e.target.value, e, 'blue')}
                    class="value-input" disabled={controlDisabled} maxlength="3" />
            </div>
        {:else if control.type.type === 'toggle'}
            {@const controlValue = values[control.id] ?? control.type.offValue}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            {@const isOn = controlValue === control.type.onValue}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={controlDisabled}>{control.type.name}</label>
                <div class="toggle-wrapper">
                    <ToggleSwitch
                        checked={isOn}
                        disabled={controlDisabled}
                        onchange={() => handleToggleChange(control.id, control)}
                        label={control.type.name}
                    />
                </div>
                <input
                    type="text"
                    value={controlValue}
                    oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.id, e.target.value, e)}
                    class="value-input"
                    disabled={controlDisabled}
                    maxlength="3"
                />
            </div>
        {:else if control.type.type === 'slider'}
            {@const controlValue = values[control.id] ?? 0}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={controlDisabled}>{control.type.name}</label>
                <div class="slider-wrapper">
                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={controlValue}
                        oninput={(e) => !controlDisabled && handleControlChange(control.id, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(control)}; --thumb-color: {getThumbColor(control, controlValue)}"
                        disabled={controlDisabled}
                        class="color-slider"
                    />
                </div>
                <input
                    type="text"
                    value={controlValue}
                    oninput={handleTextInput}
                    onchange={(e) => !controlDisabled && handleTextInputChange(control.id, e.target.value, e)}
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
