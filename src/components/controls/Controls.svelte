<script>
    import XYPad from './XYPad.svelte';
    import ToggleSwitch from '../common/ToggleSwitch.svelte';
    import { remapDMXAxis } from '../../lib/outputs/controls.js';

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

    function wheelDefaultValue() {
        return { index: 0, modifier: false, speed: 0 };
    }

    function handleWheelSwatch(controlId, index) {
        const current = values[controlId] ?? wheelDefaultValue();
        handleControlChange(controlId, {
            index,
            modifier: !!current.modifier,
            speed: 0
        });
    }

    function handleWheelModifier(controlId, control, nextModifier) {
        const current = values[controlId] ?? wheelDefaultValue();
        const slots = nextModifier
            ? (control.type.modifierSlots ?? control.type.staticSlots)
            : control.type.staticSlots;
        const maxIndex = Math.max(0, (slots?.length ?? 1) - 1);
        handleControlChange(controlId, {
            index: Math.min(current.index ?? 0, maxIndex),
            modifier: nextModifier,
            speed: current.speed ?? 0
        });
    }

    function handleWheelSpeed(controlId, rawSpeed) {
        const current = values[controlId] ?? wheelDefaultValue();
        // Middle third of the slider is a deadzone — the selected swatch drives the channel.
        // Only the outer thirds send rotation speed (reverse / forward).
        const effective = Math.abs(rawSpeed) < 34 ? 0 : rawSpeed;
        handleControlChange(controlId, {
            index: current.index ?? 0,
            modifier: !!current.modifier,
            speed: effective
        });
    }

    function wheelSwatchBackground(slot) {
        const colors = slot?.colors ?? [];
        if (colors.length === 0) {
            return slot?.icon ? '#f5f5f5' : 'repeating-linear-gradient(45deg, #ddd 0 4px, #ccc 4px 8px)';
        }
        if (colors.length === 1) return colors[0];
        if (colors.length === 2) return `linear-gradient(90deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`;
        const stops = colors.map((c, i) => `${c} ${((i / (colors.length - 1)) * 100).toFixed(1)}%`).join(', ');
        return `linear-gradient(90deg, ${stops})`;
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
        {#if control.separator}
            <hr class="control-separator" />
        {:else if control.type.type === 'xypad' || control.type.type === 'xypad16'}
            {@const controlValue = values[control.id] || { pan: 128, tilt: 128 }}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            {@const hasRemap = control.panMin !== undefined || control.panMax !== undefined || control.invertPan
                || control.tiltMin !== undefined || control.tiltMax !== undefined || control.invertTilt}
            {@const displayPan = hasRemap
                ? remapDMXAxis(controlValue.pan, control.panMin ?? 0, control.panMax ?? 255, !!control.invertPan)
                : null}
            {@const displayTilt = hasRemap
                ? remapDMXAxis(controlValue.tilt, control.tiltMin ?? 0, control.tiltMax ?? 255, !!control.invertTilt)
                : null}
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
                    <span class="control-label">{control.type.name}</span>
                </div>
                <div class="xypad-wrapper" class:disabled={controlDisabled}>
                    <XYPad
                        panValue={controlValue.pan}
                        tiltValue={controlValue.tilt}
                        onUpdate={(pan, tilt) => !controlDisabled && handleXYPadChange(control.id, pan, tilt)}
                    />
                </div>
                <div class="xypad-inputs">
                    <div class="xypad-input-row">
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
                        {#if displayPan !== null}<div class="dmx-value" title="DMX pan">{displayPan}</div>{/if}
                    </div>
                    <div class="xypad-input-row">
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
                        {#if displayTilt !== null}<div class="dmx-value" title="DMX tilt">{displayTilt}</div>{/if}
                    </div>
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
                <span class="control-label" class:disabled={controlDisabled}>Red</span>
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
                <span class="control-label" class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Green</span>
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
                <span class="control-label" class:disabled={controlDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>Blue</span>
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
            {@const displayValue = control.inverted ? (255 - controlValue) : controlValue}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <span class="control-label" class:disabled={controlDisabled}>{control.type.name}</span>
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
                    value={displayValue}
                    oninput={handleTextInput}
                    onchange={(e) => {
                        if (controlDisabled) return;
                        const typed = parseInt(e.target.value);
                        if (!isNaN(typed) && typed >= 0 && typed <= 255) {
                            const actual = control.inverted ? (255 - typed) : typed;
                            handleControlChange(control.id, actual);
                        } else if (e.target.value === '') {
                            e.target.value = '';
                        } else {
                            e.target.value = displayValue;
                        }
                    }}
                    class="value-input"
                    disabled={controlDisabled}
                    maxlength="3"
                />
            </div>
        {:else if control.type.type === 'wheel'}
            {@const wheelValue = values[control.id] ?? { index: 0, modifier: false, speed: 0 }}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            {@const activeSlots = wheelValue.modifier
                ? (control.type.modifierSlots ?? control.type.staticSlots)
                : control.type.staticSlots}
            {@const rotating = (wheelValue.speed ?? 0) !== 0}
            {@const wheelDmx = control.type.valueToDMX(wheelValue)[0] ?? 0}
            {@const modeLabel = control.type.id === 'pattern-wheel' ? 'Shake' : 'Mixed'}
            <div class="control control-wheel" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <span class="control-label" class:disabled={controlDisabled}>{control.type.name}</span>
                <div class="wheel-swatches" class:dim={rotating} class:disabled={controlDisabled}>
                    {#each activeSlots as slot, i}
                        <button
                            type="button"
                            class="wheel-swatch"
                            class:selected={!rotating && wheelValue.index === i}
                            class:numbered={(slot.colors?.length ?? 0) === 0 && !slot.icon}
                            class:iconed={!!slot.icon}
                            class:slot-disabled={slot.disabled}
                            style="background: {wheelSwatchBackground(slot)};"
                            disabled={controlDisabled || slot.disabled}
                            title={slot.label}
                            onclick={() => !controlDisabled && !slot.disabled && handleWheelSwatch(control.id, i)}
                        >
                            {#if slot.icon}
                                {@html slot.icon}
                            {:else if (slot.colors?.length ?? 0) === 0}
                                <span>{i}</span>
                            {/if}
                        </button>
                    {/each}
                </div>
                {#if control.type.modifierSlots}
                    <label class="wheel-mode">
                        <input
                            type="checkbox"
                            checked={!!wheelValue.modifier}
                            onchange={(e) => !controlDisabled && handleWheelModifier(control.id, control, e.target.checked)}
                            disabled={controlDisabled}
                        />
                        {modeLabel}
                    </label>
                {/if}
                <div class="wheel-speed-row">
                    <span class="wheel-speed-label">◀</span>
                    <div class="slider-wrapper">
                        <input
                            type="range"
                            min="-100"
                            max="100"
                            step="1"
                            value={wheelValue.speed ?? 0}
                            oninput={(e) => !controlDisabled && handleWheelSpeed(control.id, parseInt(e.target.value))}
                            onchange={(e) => {
                                // On release in the deadzone, snap the thumb to exact center.
                                if (Math.abs(parseInt(e.target.value)) < 34) {
                                    e.target.value = 0;
                                }
                            }}
                            style="--slider-gradient: linear-gradient(to right, #ccc 0%, #333 50%, #ccc 100%); --thumb-color: #444;"
                            disabled={controlDisabled}
                            class="color-slider wheel-speed"
                        />
                    </div>
                    <span class="wheel-speed-label">▶</span>
                </div>
                <input
                    type="text"
                    value={wheelDmx}
                    oninput={handleTextInput}
                    onchange={(e) => {
                        const n = parseInt(e.target.value);
                        if (!isNaN(n) && n >= 0 && n <= 255 && !controlDisabled) {
                            const next = control.type.dmxToValue([n], wheelValue);
                            handleControlChange(control.id, next);
                        } else {
                            e.target.value = wheelDmx;
                        }
                    }}
                    class="value-input wheel-speed-value"
                    disabled={controlDisabled}
                    maxlength="3"
                />
            </div>
        {:else if control.type.type === 'sparks'}
            {@const sparksValue = values[control.id] ?? { level: 0, cleaning: false }}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            {@const sliderValue = sparksValue.level ?? 0}
            {@const cleaning = !!sparksValue.cleaning}
            {@const dmxDisplay = cleaning ? 255 : sliderValue}
            <div class="control control-sparks" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <span class="control-label" class:disabled={controlDisabled}>{control.type.name}</span>
                <div class="slider-wrapper">
                    <input
                        type="range"
                        min="0"
                        max="209"
                        value={sliderValue}
                        oninput={(e) => !controlDisabled && handleControlChange(control.id, { level: parseInt(e.target.value), cleaning })}
                        style="--slider-gradient: {control.type.getGradient()}; --thumb-color: {control.type.getColor(sparksValue)}"
                        disabled={controlDisabled}
                        class="color-slider"
                    />
                </div>
                <input
                    type="text"
                    value={dmxDisplay}
                    oninput={handleTextInput}
                    onchange={(e) => {
                        if (controlDisabled) return;
                        const typed = parseInt(e.target.value);
                        if (!isNaN(typed) && typed >= 0 && typed <= 255) {
                            if (typed >= 210) {
                                handleControlChange(control.id, { level: sliderValue, cleaning: true });
                            } else {
                                handleControlChange(control.id, { level: typed, cleaning: false });
                            }
                        } else {
                            e.target.value = dmxDisplay;
                        }
                    }}
                    class="value-input"
                    disabled={controlDisabled}
                    maxlength="3"
                />
                <label class="sparks-cleaning">
                    <input
                        type="checkbox"
                        checked={cleaning}
                        disabled={controlDisabled}
                        onchange={(e) => handleControlChange(control.id, { level: sliderValue, cleaning: e.target.checked })}
                    />
                    Cleaning
                </label>
            </div>
        {:else if control.type.type === 'ilda'}
            <!-- ILDA control rendered separately below -->
        {:else if control.type.type === 'slider'}
            {@const controlValue = values[control.id] ?? 0}
            {@const controlDisabled = isControlDisabled(control.id) || !isControlEnabled(control)}
            {@const displayValue = control.inverted ? (255 - controlValue) : controlValue}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <span class="control-label" class:disabled={controlDisabled}>{control.type.name}</span>
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
                    value={displayValue}
                    oninput={handleTextInput}
                    onchange={(e) => {
                        if (controlDisabled) return;
                        const typed = parseInt(e.target.value);
                        if (!isNaN(typed) && typed >= 0 && typed <= 255) {
                            const actual = control.inverted ? (255 - typed) : typed;
                            handleControlChange(control.id, actual);
                        } else if (e.target.value === '') {
                            e.target.value = '';
                        } else {
                            e.target.value = displayValue;
                        }
                    }}
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

    .control-separator {
        border: none;
        border-top: 1px solid #e0e0e0;
        margin: 6px 0;
        width: 100%;
    }

    /* Sparks control — slider row + cleaning row */
    .control-sparks {
        display: grid;
        grid-template-columns: 16px 4em 1fr 3em;
        grid-template-areas:
            "cb    label slider    value"
            ".     .     cleaning  .";
        column-gap: 8px;
        row-gap: 4px;
        align-items: center;
    }

    .control-sparks.no-checkbox {
        grid-template-columns: 4em 1fr 3em;
        grid-template-areas:
            "label slider    value"
            ".     cleaning  .";
    }

    .control-sparks > .control-checkbox { grid-area: cb; }
    .control-sparks > .control-label    { grid-area: label; }
    .control-sparks > .slider-wrapper   { grid-area: slider; }
    .control-sparks > .value-input      { grid-area: value; text-align: right; }
    .control-sparks > .sparks-cleaning  { grid-area: cleaning; }

    .sparks-cleaning {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 0px;
        margin-bottom: 6px;
        font-size: 9pt;
        color: #555;
        cursor: pointer;
        user-select: none;
        justify-self: start;
    }

    .sparks-cleaning input {
        margin: 0;
        cursor: pointer;
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

    .control .control-label {
        font-size: 9pt;
        font-weight: 500;
        color: #555;
    }

    .control .control-label.disabled {
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
        margin: 0;
        border-radius: 3.5px;
        background: var(--slider-gradient);
        cursor: pointer;
        outline: none;

        position: relative;
        top: -1px;
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

    .control-xypad .control-label {
        font-size: 9pt;
        font-weight: 500;
        color: #555;
    }

    .xypad-inputs {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .xypad-input-row {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .xypad-inputs input {
        width: 4em;
    }

    .dmx-value {
        font-size: 8pt;
        color: #888;
        text-align: right;
        width: 4em;
    }

    .xypad-wrapper {
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

    /* Wheel control styles — share column widths with .control */
    .control-wheel {
        display: grid;
        grid-template-columns: 16px 4em 1fr 3em;
        grid-template-areas:
            "cb    label swatches swatches"
            ".     .     mode     ."
            ".     .     speed    value";
        column-gap: 8px;
        row-gap: 6px;
        align-items: start;
    }

    .control-wheel.no-checkbox {
        grid-template-columns: 4em 1fr 3em;
        grid-template-areas:
            "label mode     ."
            ".     swatches swatches"
            ".     speed    value";
    }

    .control-wheel > .control-checkbox {
        grid-area: cb;
        align-self: center;
    }

    .control-wheel > .control-label {
        grid-area: label;
        align-self: start;
        margin-top: 3px;
    }

    .wheel-swatches {
        grid-area: swatches;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .wheel-swatches.dim .wheel-swatch {
        opacity: 0.45;
    }

    .wheel-swatches.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .wheel-mode {
        grid-area: mode;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
        margin-bottom: 4px;
        font-size: 9pt;
        color: #555;
        cursor: pointer;
        user-select: none;
        justify-self: start;
    }

    .wheel-mode input {
        margin: 0;
        cursor: pointer;
    }

    .wheel-swatch {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        /* border: 1px solid rgba(0, 0, 0, 0.2); */
        cursor: pointer;
        padding: 0;
        position: relative;
        transition: transform 0.08s ease, box-shadow 0.08s ease;
        box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.1);
    }

    .wheel-swatch:hover:not(:disabled) {
        transform: scale(1.08);
    }

    .wheel-swatch.selected {
        box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.1), 0 0 0 1.5px #2196f3, 0 0 12px rgba(33, 150, 243, 0.4);
    }

    .wheel-swatch.slot-disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .wheel-swatch.slot-disabled:hover {
        transform: none;
    }

    .wheel-swatch.numbered {
        color: #444;
        font-size: 9pt;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .wheel-swatch.iconed {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333;
    }

    .wheel-swatch.iconed > :global(svg) {
        width: 18px;
        height: 18px;
        pointer-events: none;
    }

    .wheel-speed-row {
        grid-area: speed;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .wheel-speed-row .slider-wrapper {
        flex: 1;
    }

    .wheel-speed-label {
        font-size: 9pt;
        color: #888;
        font-family: var(--font-stack-mono);
    }

    .wheel-speed-value {
        grid-area: value;
        align-self: center;
        text-align: right;
    }
</style>
