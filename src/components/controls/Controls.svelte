<script>
    import XYPad from './XYPad.svelte';
    import ToggleSwitch from '../common/ToggleSwitch.svelte';

    let {
        controls, // Array of control definitions
        components, // Array of component definitions (with channel mapping)
        values = $bindable([]),
        onChange = null,
        disabledChannels = [], // Array of channel indices that should be disabled
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

    function handleSliderChange(channelIndex, value) {
        values[channelIndex] = value;
        if (onChange) {
            onChange(channelIndex, value);
        }
    }

    function handleXYPadChange(xChannel, yChannel, xValue, yValue) {
        values[xChannel] = xValue;
        values[yChannel] = yValue;
        if (onChange) {
            onChange(xChannel, xValue);
            onChange(yChannel, yValue);
        }
    }

    function handleToggleChange(channelIndex, control) {
        // Toggle between off and on values
        const currentValue = values[channelIndex];
        const newValue = currentValue === control.onValue ? control.offValue : control.onValue;
        handleSliderChange(channelIndex, newValue);
    }

    function handleTextInputChange(channelIndex, inputValue, e) {
        const numValue = parseInt(inputValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
            handleSliderChange(channelIndex, numValue);
        } else if (inputValue === '') {
            // Allow empty for easier editing
            e.target.value = '';
        } else {
            // Invalid value, revert to current value
            e.target.value = values[channelIndex];
        }
    }

    function handleTextInput(e) {
        // Only allow digits
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    }

    function isChannelDisabled(channelIndex) {
        return disabledChannels.includes(channelIndex);
    }

    // Get the channel number for a component index
    function getChannel(componentIndex) {
        return components[componentIndex].channel;
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
            default:
                return `rgb(${Math.round(value * 0.5)}, ${Math.round(value * 0.5)}, ${Math.round(value * 0.5)})`;
        }
    }
</script>

<div class="controls">
    {#each controls as control}
        {#if control.type === 'xypad'}
            {@const xChannel = getChannel(control.components.x)}
            {@const yChannel = getChannel(control.components.y)}
            {@const xDisabled = isChannelDisabled(xChannel)}
            {@const yDisabled = isChannelDisabled(yChannel)}
            {@const bothDisabled = xDisabled && yDisabled}
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
                <div class="xypad-wrapper" class:disabled={bothDisabled}>
                    <XYPad
                        panValue={values[xChannel]}
                        tiltValue={values[yChannel]}
                        onUpdate={(x, y) => !bothDisabled && handleXYPadChange(xChannel, yChannel, x, y)}
                    />
                </div>
                <div class="xypad-inputs">
                    <input
                        type="text"
                        value={values[xChannel]}
                        oninput={handleTextInput}
                        onchange={(e) => !xDisabled && handleTextInputChange(xChannel, e.target.value, e)}
                        class="value-input"
                        title="X"
                        disabled={xDisabled}
                        maxlength="3"
                    />
                    <input
                        type="text"
                        value={values[yChannel]}
                        oninput={handleTextInput}
                        onchange={(e) => !yDisabled && handleTextInputChange(yChannel, e.target.value, e)}
                        class="value-input"
                        title="Y"
                        disabled={yDisabled}
                        maxlength="3"
                    />
                </div>
            </div>
        {:else if control.type === 'rgb'}
            {@const rChannel = getChannel(control.components.r)}
            {@const gChannel = getChannel(control.components.g)}
            {@const bChannel = getChannel(control.components.b)}
            <!-- Red -->
            {@const rDisabled = isChannelDisabled(rChannel) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={rDisabled}>{components[control.components.r].name}</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={values[rChannel]}
                        oninput={(e) => !rDisabled && handleSliderChange(rChannel, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Red')}; --thumb-color: {getThumbColor('Red', values[rChannel])}"
                        disabled={rDisabled} class="color-slider" />
                </div>
                <input type="text" value={values[rChannel]} oninput={handleTextInput}
                    onchange={(e) => !rDisabled && handleTextInputChange(rChannel, e.target.value, e)}
                    class="value-input" disabled={rDisabled} maxlength="3" />
            </div>
            <!-- Green -->
            {@const gDisabled = isChannelDisabled(gChannel) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={gDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>{components[control.components.g].name}</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={values[gChannel]}
                        oninput={(e) => !gDisabled && handleSliderChange(gChannel, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Green')}; --thumb-color: {getThumbColor('Green', values[gChannel])}"
                        disabled={gDisabled} class="color-slider" />
                </div>
                <input type="text" value={values[gChannel]} oninput={handleTextInput}
                    onchange={(e) => !gDisabled && handleTextInputChange(gChannel, e.target.value, e)}
                    class="value-input" disabled={gDisabled} maxlength="3" />
            </div>
            <!-- Blue -->
            {@const bDisabled = isChannelDisabled(bChannel) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                <label class:disabled={bDisabled} style={showCheckboxes ? 'grid-column-start: 2' : ''}>{components[control.components.b].name}</label>
                <div class="slider-wrapper">
                    <input type="range" min="0" max="255" value={values[bChannel]}
                        oninput={(e) => !bDisabled && handleSliderChange(bChannel, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient('Blue')}; --thumb-color: {getThumbColor('Blue', values[bChannel])}"
                        disabled={bDisabled} class="color-slider" />
                </div>
                <input type="text" value={values[bChannel]} oninput={handleTextInput}
                    onchange={(e) => !bDisabled && handleTextInputChange(bChannel, e.target.value, e)}
                    class="value-input" disabled={bDisabled} maxlength="3" />
            </div>
        {:else if control.type === 'toggle'}
            {@const channelIndex = getChannel(control.components.value)}
            {@const channelDisabled = isChannelDisabled(channelIndex) || !isControlEnabled(control)}
            {@const isOn = values[channelIndex] === control.onValue}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={channelDisabled}>{control.name}</label>
                <div class="toggle-wrapper">
                    <ToggleSwitch
                        checked={isOn}
                        disabled={channelDisabled}
                        onchange={() => handleToggleChange(channelIndex, control)}
                        label="{control.name}"
                    />
                </div>
                <input
                    type="text"
                    value={values[channelIndex]}
                    oninput={handleTextInput}
                    onchange={(e) => !channelDisabled && handleTextInputChange(channelIndex, e.target.value, e)}
                    class="value-input"
                    disabled={channelDisabled}
                    maxlength="3"
                />
            </div>
        {:else if control.type === 'slider'}
            {@const channelIndex = getChannel(control.components.value)}
            {@const channelDisabled = isChannelDisabled(channelIndex) || !isControlEnabled(control)}
            <div class="control" class:no-checkbox={!showCheckboxes}>
                {#if showCheckboxes}
                    <input
                        type="checkbox"
                        checked={isControlEnabled(control)}
                        onchange={() => toggleControlEnabled(control)}
                        class="control-checkbox"
                    />
                {/if}
                <label class:disabled={channelDisabled}>{control.name}</label>
                <div class="slider-wrapper">
                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={values[channelIndex]}
                        oninput={(e) => !channelDisabled && handleSliderChange(channelIndex, parseInt(e.target.value))}
                        style="--slider-gradient: {getSliderGradient(components[control.components.value].name)}; --thumb-color: {getThumbColor(components[control.components.value].name, values[channelIndex])}"
                        disabled={channelDisabled}
                        class="color-slider"
                    />
                </div>
                <input
                    type="text"
                    value={values[channelIndex]}
                    oninput={handleTextInput}
                    onchange={(e) => !channelDisabled && handleTextInputChange(channelIndex, e.target.value, e)}
                    class="value-input"
                    disabled={channelDisabled}
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
        font-weight: 600;
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
        outline: 2px solid white;
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
        outline: 2px solid white;
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
        border: none;
        background: transparent;
        padding: 4px;
        font-size: 9pt;
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
        align-items: center;
    }

    .control-xypad label {
        font-size: 9pt;
        font-weight: 600;
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
        padding-left: 6px;
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
