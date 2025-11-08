<script>
    import { DMXController } from './lib/dmx.js';
    import { DEVICE_TYPES } from './lib/devices.js';
    import Header from './components/layout/Header.svelte';
    import Tabs from './components/layout/Tabs.svelte';
    import UniverseView from './components/views/UniverseView.svelte';
    import DevicesView from './components/views/DevicesView.svelte';
    import TimelineView from './components/views/TimelineView.svelte';
    import CSSView from './components/views/CSSView.svelte';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());
    let selectedType = $state('RGB');
    let devicesViewRef = $state(null);
    let devices = $state([]);

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
        <DevicesView {dmxController} bind:this={devicesViewRef} bind:selectedType bind:devices />
    </div>

    <div class="view-container" class:hidden={view !== 'universe'}>
        <UniverseView {dmxController} />
    </div>

    <div class="view-container" class:hidden={view !== 'timeline'}>
        <TimelineView {dmxController} {devices} />
    </div>

    <div class="view-container" class:hidden={view !== 'css'}>
        <CSSView {dmxController} {devices} />
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
