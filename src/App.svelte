<script>
    import { DMXController } from './lib/dmx.js';
    import Header from './components/Header.svelte';
    import Tabs from './components/Tabs.svelte';
    import UniverseView from './components/UniverseView.svelte';
    import DevicesView from './components/DevicesView.svelte';

    let view = $state('devices');
    let connected = $state(false);
    let dmxController = $state(new DMXController());

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
</script>

<Header
    onconnect={handleConnect}
    ondisconnect={handleDisconnect}
    {connected}
/>

<main>
    <Tabs bind:view />

    {#if view === 'universe'}
        <UniverseView {dmxController} />
    {:else if view === 'devices'}
        <DevicesView {dmxController} />
    {/if}
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
