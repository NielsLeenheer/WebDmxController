<script>
    import { DMXController } from './lib/dmx.js';
    import { DEVICE_TYPES } from './lib/devices.js';
    import Header from './components/Header.svelte';
    import Tabs from './components/Tabs.svelte';
    import UniverseView from './components/UniverseView.svelte';
    import DevicesView from './components/DevicesView.svelte';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());
    let selectedType = $state('RGB');
    let devicesViewRef = $state(null);

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
    />

    {#if view === 'universe'}
        <UniverseView {dmxController} />
    {:else if view === 'devices'}
        <DevicesView {dmxController} bind:this={devicesViewRef} bind:selectedType />
    {/if}
</main>
