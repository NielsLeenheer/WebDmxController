<script>
    import { onMount } from 'svelte';
    import { DMXController } from './lib/outputs/dmx.js';
    import { DEVICE_TYPES } from './lib/outputs/devices.js';
    import { controlValuesToDMX } from './lib/outputs/controls.js';
    import { deviceLibrary, animationLibrary, inputLibrary, triggerLibrary, sceneLibrary, drawingLibrary } from './stores.svelte.js';
    import { TriggerManager } from './lib/triggers/manager.js';
    import { SceneController } from './lib/scenes/manager.svelte.js';
    import { CustomPropertyManager, CSSManager } from './lib/css/index.js';
    import { InputController } from './lib/inputs/controller.js';
    import Header from './components/layout/Header.svelte';
    import Tabs from './components/layout/Tabs.svelte';
    import UniverseView from './components/views/UniverseView.svelte';
    import DevicesView from './components/views/DevicesView.svelte';
    import AnimationsView from './components/views/AnimationsView.svelte';
    import InputsView from './components/views/InputsView.svelte';
    import TriggersView from './components/views/TriggersView.svelte';
    import ScenesView from './components/views/ScenesView.svelte';
    import EditorView from './components/views/EditorView.svelte';
    import DrawingView from './components/views/DrawingView.svelte';
    import FloatingPreview from './components/common/FloatingPreview.svelte';
    import { LaserManager } from './lib/outputs/laser/LaserManager.js';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());
    let devicesViewRef = $state(null);
    let universeMode = $state('view'); // 'view' or 'edit'

    // Reactive systems
    let triggerManager = $state(new TriggerManager());
    let sceneController = $state(new SceneController(sceneLibrary));
    let customPropertyManager = $state(new CustomPropertyManager());
    let inputController = $state(new InputController(inputLibrary, customPropertyManager, triggerManager, triggerLibrary));

    // CSS Manager - handles all CSS sampling and DOM management
    let cssManager = $state(null);
    let laserManager = $state(new LaserManager(deviceLibrary, drawingLibrary));
    let selectedDrawingId = $state(null);
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
            // Silently ignore user cancellation
            if (error.name === 'NotFoundError') return;
            alert('Failed to connect: ' + error.message);
        }
    }

    function handleDisconnect() {
        dmxController.disconnect();
        connected = false;
    }

    // Handle sampled CSS values from CSSManager
    // This callback is called every frame with the latest sampled values
    function handleSampledValues(sampledValues) {
        // Only update DMX hardware when NOT on Devices tab
        // Universe tab in view mode shows sampled values, edit mode handles its own output
        if (!dmxController || view === 'devices' || (view === 'universe' && universeMode === 'edit')) {
            return;
        }

        deviceLibrary.getAll().forEach(device => {
            const controlValues = sampledValues.get(device.id);
            if (!controlValues) return;

            // Get device type definition
            const deviceType = DEVICE_TYPES[device.type];
            if (!deviceType) return;

            // Convert control values to DMX array
            const dmxArray = controlValuesToDMX(deviceType, controlValues);

            // Update DMX hardware
            for (let i = 0; i < dmxArray.length; i++) {
                const channel = device.startChannel + i;
                dmxController.setChannel(channel, dmxArray[i]);
            }
        });
    }

    onMount(() => {
        // Create CSS Manager
        cssManager = new CSSManager(deviceLibrary, animationLibrary, inputLibrary, triggerLibrary, triggerManager, sceneLibrary, drawingLibrary);
        cssManager.initialize(mainElement);

        // Give input controller access to scene state for LED feedback
        inputController.setSceneController(sceneController);

        // Wire up scene controller to CSS manager and LED refresh
        sceneController.setOnSceneChange((cssIdentifier) => {
            cssManager.setScene(cssIdentifier);

            // Refresh button LEDs so scene-selecting buttons reflect the active scene
            inputController.applyColorsToDevices().catch(err => {
                console.warn('Failed to refresh button colors after scene change:', err);
            });
        });

        // Listen for scene priority stack events from triggers and select buttons
        triggerManager.on('scenePush', ({ level, id, sceneId }) => {
            if (level === 'momentary') {
                sceneController.pushMomentaryScene(id, sceneId);
            } else if (level === 'toggle') {
                sceneController.pushToggleScene(id, sceneId);
            }
        });

        triggerManager.on('scenePop', ({ level, id }) => {
            if (level === 'momentary') {
                sceneController.removeMomentaryScene(id);
            } else if (level === 'toggle') {
                sceneController.removeToggleScene(id);
            }
        });

        triggerManager.on('sceneSelect', ({ sceneId }) => {
            sceneController.setSelectScene(sceneId);
        });

        // Listen for group selection events from select-mode buttons
        triggerManager.on('groupSelection', ({ groupCssId, inputCssId }) => {
            cssManager.setGroupSelection(groupCssId, inputCssId);
        });

        // Initialize LaserManager with the sampler container
        laserManager.initialize(cssManager.getContainer());

        // Subscribe to sampled values for DMX output
        const unsubscribe = cssManager.subscribe(handleSampledValues);

        // Flush all pending saves before page unload
        const handleBeforeUnload = () => {
            deviceLibrary.flush();
            animationLibrary.flush();
            inputLibrary.flush();
            triggerLibrary.flush();
            sceneLibrary.flush();
            drawingLibrary.flush();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Return cleanup function
        return () => {
            unsubscribe();
            laserManager.destroy();
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
    />

    <div class="view-container" class:hidden={view !== 'devices'}>
        <DevicesView
            {dmxController}
            {laserManager}
            bind:this={devicesViewRef}
            isActive={view === 'devices'}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'universe'}>
        <UniverseView {dmxController} isActive={view === 'universe'} bind:mode={universeMode} />
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

    <div class="view-container" class:hidden={view !== 'scenes'}>
        <ScenesView {sceneController} />
    </div>

    <div class="view-container" class:hidden={view !== 'css'}>
        <EditorView
            {cssManager}
            {sceneController}
            {laserManager}
        />
    </div>

    <div class="view-container" class:hidden={view !== 'drawing'}>
        <DrawingView
            {laserManager}
            bind:selectedDrawingId
        />
    </div>
</main>

{#if view === 'drawing'}
    <FloatingPreview {laserManager} {selectedDrawingId} />
{/if}

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
