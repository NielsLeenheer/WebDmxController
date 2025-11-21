<script>
    import { onMount, onDestroy } from 'svelte';
    import { DMXController } from './lib/outputs/dmx.js';
    import { convertChannelsToArray } from './lib/outputs/devices.js';
    import { deviceLibrary, animationLibrary, inputLibrary, triggerLibrary } from './lib/libraries.svelte.js';
    import { TriggerManager } from './lib/mappings.js';
    import { CustomPropertyManager, CSSManager } from './lib/css/index.js';
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

    // Reactive systems
    let triggerManager = $state(new TriggerManager());
    let customPropertyManager = $state(new CustomPropertyManager());
    let inputController = $state(new InputController(inputLibrary, customPropertyManager, triggerManager));

    // CSS Manager - handles all CSS sampling and DOM management
    let cssManager = $state(null);
    let mainElement;

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
        deviceLibrary.clearAllValues();
    }

    // Handle sampled CSS values from CSSManager
    // This callback is called every frame with the latest sampled values
    function handleSampledValues(sampledValues) {
        // Only update DMX hardware when NOT on Devices or Universe tab
        // Those tabs handle their own DMX output
        if (!dmxController || view === 'devices' || view === 'universe') {
            return;
        }

        deviceLibrary.getAll().forEach(device => {
            const channels = sampledValues.get(device.id);
            if (!channels) return;

            // Convert sampled channels to device channel array based on device type
            const newValues = convertChannelsToArray(device.type, channels);

            // Update DMX hardware
            for (let i = 0; i < newValues.length; i++) {
                const channel = device.startChannel + i;
                dmxController.setChannel(channel, newValues[i]);
            }
        });
    }

    onMount(() => {
        // Create CSS Manager
        cssManager = new CSSManager(deviceLibrary, animationLibrary, inputLibrary, triggerLibrary, triggerManager);
        cssManager.initialize(mainElement);

        // Subscribe to sampled values for DMX output
        const unsubscribe = cssManager.subscribe(handleSampledValues);

        // Flush all pending saves before page unload
        const handleBeforeUnload = () => {
            deviceLibrary.flush();
            animationLibrary.flush();
            inputLibrary.flush();
            triggerLibrary.flush();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Return cleanup function
        return () => {
            unsubscribe();
            cssManager.destroy();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    });
</script>

<Header
    onconnect={handleConnect}
    ondisconnect={handleDisconnect}
    {connected}
    {inputController}
/>

<main bind:this={mainElement}>
    <Tabs
        bind:view
        onClearUniverse={handleClearUniverse}
    />

    <div class="view-container" class:hidden={view !== 'devices'}>
        <DevicesView
            {dmxController}
            bind:this={devicesViewRef}
            isActive={view === 'devices'}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'universe'}>
        <UniverseView {dmxController} isActive={view === 'universe'} />
    </div>

    <div class="view-container" class:hidden={view !== 'animations'}>
        <AnimationsView />
    </div>

    <div class="view-container" class:hidden={view !== 'inputs'}>
        <InputsView
            {inputController}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'triggers'}>
        <TriggersView />
    </div>

    <div class="view-container" class:hidden={view !== 'css'}>
        <CSSView
            {cssManager}
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
