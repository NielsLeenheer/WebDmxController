<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../assets/icons/connect.svg?raw';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';

    let { onconnect, ondisconnect, connected } = $props();
</script>

<header>
    {#if !connected}
        <button id="start" onclick={onconnect}>
            <Icon data={connectIcon} />
            Connect DMX controller
        </button>
    {:else}
        <button id="stop" onclick={ondisconnect}>
            <Icon data={disconnectIcon} />
            Disconnect
        </button>
    {/if}
</header>

<style>
    header {
        display: flex;
        align-items: center;
    }

    button :global(svg) {
        height: 75%;
        margin-right: 3px;
    }

    button#start {
        background-color: #bbdefb;
        color: #1976d2;
    }

    button#stop {
        background-color: #fff;
        color: #000;
    }
</style>
