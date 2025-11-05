<script>
    let { onconnect, ondisconnect, connected } = $props();
</script>

<header>
    <h1>WebDMX Controller</h1>

    <div class="spacer"></div>

    {#if !connected}
        <button onclick={onconnect}>
            Connect
        </button>
    {:else}
        <button onclick={ondisconnect}>
            Disconnect
        </button>
    {/if}
</header>

<style>
    header {
        display: flex;
        align-items: center;
    }

    h1 {
        font-size: 14pt;
        font-weight: 600;
        margin: 0;
        color: #333;
    }

    .spacer {
        flex: 1;
    }
</style>
