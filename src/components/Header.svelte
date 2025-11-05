<script>
    import { Icon } from 'svelte-icon';
    import connectIcon from '../assets/icons/connect.svg?raw';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';

    let { onconnect, ondisconnect, connected } = $props();
</script>

<header>
    {#if !connected}
        <button onclick={onconnect}>
            <Icon data={connectIcon} />
            Connect
        </button>
    {:else}
        <button onclick={ondisconnect}>
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
        width: 1.2em;
        height: 1.2em;
        margin-right: 4px;
    }
</style>
