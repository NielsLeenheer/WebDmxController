<script>
    import { onMount, onDestroy } from 'svelte';
    import { DMXController } from './lib/outputs/dmx.js';
    import { DEVICE_TYPES, convertChannelsToArray } from './lib/outputs/devices.js';
    import { AnimationLibrary } from './lib/animations.js';
    import { MappingLibrary, TriggerManager } from './lib/mappings.js';
    import { CSSGenerator, CSSSampler, CustomPropertyManager } from './lib/cssEngine.js';
    import { InputController } from './lib/inputController.js';
    import Header from './components/layout/Header.svelte';
    import Tabs from './components/layout/Tabs.svelte';
    import UniverseView from './components/views/UniverseView.svelte';
    import DevicesView from './components/views/DevicesView.svelte';
    import AnimationsView from './components/views/AnimationsView.svelte';
    import InputsView from './components/views/InputsView.svelte';
    import TriggersView from './components/views/TriggersView.svelte';
    import CSSView from './components/views/CSSView.svelte';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());
    let devicesViewRef = $state(null);
    let devices = $state([]);

    // New reactive systems
    let animationLibrary = $state(new AnimationLibrary());
    let mappingLibrary = $state(new MappingLibrary());
    let triggerManager = $state(new TriggerManager());
    let customPropertyManager = $state(new CustomPropertyManager());
    let cssSampler = $state(new CSSSampler());
    let cssGenerator = $state(new CSSGenerator(animationLibrary, mappingLibrary));
    let inputController = $state(new InputController(mappingLibrary, customPropertyManager, triggerManager));

    // CSS sampling infrastructure
    let animationTargetsContainer;
    let triggerClassesContainer;
    let styleElement;
    let animationFrameId;

    // Initialize input controller
    $effect(() => {
        inputController.initialize();
    });

    async function handleConnect() {
        try {
            await dmxController.connect();
            connected = true;
        } catch (error) {
            alert('Failed to connect: ' + error.message);
        }
    }

    function handleDisconnect() {
        dmxController.disconnect();
        connected = false;
    }

    function handleClearUniverse() {
        if (dmxController) {
            dmxController.clearUniverse();
        }
        // Also clear device values
        if (devicesViewRef?.clearAllDeviceValues) {
            devicesViewRef.clearAllDeviceValues();
        }
    }

    // CSS sampling and DMX output loop
    function updateDMXFromCSS() {
        if (!cssSampler) return;

        // Sample CSS values for all devices
        const sampledValues = cssSampler.sampleAll(devices);

        devices.forEach(device => {
            const channels = sampledValues.get(device.id);
            if (!channels) return;

            // Convert sampled channels to device channel array based on device type
            const newValues = convertChannelsToArray(device.type, channels);

            // Only update DMX hardware when NOT on Devices or Universe tab
            // Those tabs handle their own DMX output
            if (dmxController && view !== 'devices' && view !== 'universe') {
                updateDeviceToDMX(device, newValues);
            }
        });

        // Continue animation loop
        animationFrameId = requestAnimationFrame(updateDMXFromCSS);
    }

    function updateDeviceToDMX(device, values) {
        if (!dmxController) return;

        for (let i = 0; i < values.length; i++) {
            const channel = device.startChannel + i;
            dmxController.setChannel(channel, values[i]);
        }
    }

    // Update CSS in the global style element
    function updateGlobalCSS(generatedCSS, customCSS) {
        if (styleElement) {
            const combinedCSS = generatedCSS + '\n\n' + customCSS;
            styleElement.textContent = `@scope (.animation-targets) {\n${combinedCSS}\n}`;
        }
    }

    onMount(() => {
        // Create style element for @property definitions (must be at document level)
        const propertyDefsElement = document.createElement('style');
        propertyDefsElement.id = 'css-property-definitions';
        propertyDefsElement.textContent = `
/* CSS Custom Property Definitions */
@property --safety {
  syntax: "none | probably";
  inherits: false;
  initial-value: none;
}

@property --fuel {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --smoke {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --pan {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --tilt {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --amber {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
`;
        document.head.appendChild(propertyDefsElement);

        // Create style element for user CSS
        styleElement = document.createElement('style');
        styleElement.id = 'css-animation-styles';
        document.head.appendChild(styleElement);

        // Create inner trigger-classes container
        if (animationTargetsContainer) {
            triggerClassesContainer = document.createElement('div');
            triggerClassesContainer.className = 'trigger-classes';
            animationTargetsContainer.appendChild(triggerClassesContainer);
        }

        // Initialize CSS sampler with the inner container (where devices will be)
        if (cssSampler && triggerClassesContainer) {
            cssSampler.initialize(triggerClassesContainer);
            cssSampler.updateDevices(devices);
        }

        // Set trigger manager container to inner container (where classes go)
        if (triggerManager && triggerClassesContainer) {
            triggerManager.setContainer(triggerClassesContainer);
        }

        // Start animation loop
        if (!animationFrameId) {
            updateDMXFromCSS();
        }
    });

    // Watch for device changes and update CSS sampler
    $effect(() => {
        if (cssSampler && devices) {
            cssSampler.updateDevices(devices);
        }
    });

    onDestroy(() => {
        // Stop animation loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Remove style elements
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }

        const propertyDefsElement = document.getElementById('css-property-definitions');
        if (propertyDefsElement && propertyDefsElement.parentNode) {
            propertyDefsElement.parentNode.removeChild(propertyDefsElement);
        }
    });
</script>

<Header
    onconnect={handleConnect}
    ondisconnect={handleDisconnect}
    {connected}
    {inputController}
/>

<main>
    <Tabs
        bind:view
        onClearUniverse={handleClearUniverse}
    />

    <!-- Off-screen animation targets container (global, used across all tabs) -->
    <div class="animation-targets" bind:this={animationTargetsContainer}></div>

    <div class="view-container" class:hidden={view !== 'devices'}>
        <DevicesView
            {dmxController}
            bind:this={devicesViewRef}
            bind:devices
            isActive={view === 'devices'}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'universe'}>
        <UniverseView {dmxController} isActive={view === 'universe'} />
    </div>

    <div class="view-container" class:hidden={view !== 'animations'}>
        <AnimationsView
            {animationLibrary}
            {cssGenerator}
            {devices}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'inputs'}>
        <InputsView
            {inputController}
            {mappingLibrary}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'triggers'}>
        <TriggersView
            {mappingLibrary}
            {animationLibrary}
            {devices}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'css'}>
        <CSSView
            {devices}
            {animationLibrary}
            {mappingLibrary}
            {cssGenerator}
            {styleElement}
        />
    </div>
</main>

<style>
    .animation-targets {
        position: absolute;
        left: -9999px;
        top: -9999px;
        pointer-events: none;
    }

    .view-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }

    .view-container.hidden {
        display: none;
    }
</style>
