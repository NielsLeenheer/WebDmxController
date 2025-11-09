<script>
    import { DMXController } from './lib/dmx.js';
    import { DEVICE_TYPES } from './lib/devices.js';
    import { AnimationLibrary } from './lib/animations.js';
    import { MappingLibrary, TriggerManager } from './lib/mappings.js';
    import { CSSGenerator, CSSSampler, CustomPropertyManager } from './lib/cssEngine.js';
    import { InputController } from './lib/inputController.js';
    import Header from './components/layout/Header.svelte';
    import Tabs from './components/layout/Tabs.svelte';
    import UniverseView from './components/views/UniverseView.svelte';
    import DevicesView from './components/views/DevicesView.svelte';
    import TimelineView from './components/views/TimelineView.svelte';
    import AnimationsView from './components/views/AnimationsView.svelte';
    import InputsView from './components/views/InputsView.svelte';
    import TriggersView from './components/views/TriggersView.svelte';
    import CSSView from './components/views/CSSView.svelte';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());
    let selectedType = $state('RGB');
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

    function handleAddDevice() {
        if (devicesViewRef?.addDevice) {
            devicesViewRef.addDevice(selectedType);
        }
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
        showAddDevice={true}
        deviceTypes={DEVICE_TYPES}
        bind:selectedType
        onAddDevice={handleAddDevice}
        onClearUniverse={handleClearUniverse}
    />

    <div class="view-container" class:hidden={view !== 'devices'}>
        <DevicesView
            {dmxController}
            {animationLibrary}
            {mappingLibrary}
            {inputController}
            {cssGenerator}
            bind:this={devicesViewRef}
            bind:selectedType
            bind:devices
        />
    </div>

    <div class="view-container" class:hidden={view !== 'universe'}>
        <UniverseView {dmxController} />
    </div>

    <div class="view-container" class:hidden={view !== 'timeline'}>
        <TimelineView {dmxController} {devices} />
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
            {dmxController}
            {devices}
            {animationLibrary}
            {mappingLibrary}
            {cssGenerator}
            {cssSampler}
            {triggerManager}
            {customPropertyManager}
            isActive={view === 'css'}
        />
    </div>
</main>

<style>
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
