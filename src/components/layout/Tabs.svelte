<script>
    import { Icon } from 'svelte-icon';
    import listIcon from '../../assets/icons/list.svg?raw';
    import universeIcon from '../../assets/icons/universe.svg?raw';
    import timelineIcon from '../../assets/icons/timeline.svg?raw';
    import animationsIcon from '../../assets/icons/animations.svg?raw';
    import cssIcon from '../../assets/icons/css.svg?raw';

    let {
        view = $bindable(),
        showAddDevice = false,
        deviceTypes = null,
        selectedType = $bindable(),
        onAddDevice = null,
        onClearUniverse = null
    } = $props();
</script>

<div class="tabs-container">
    <nav>
        <label>
            <input type="radio" name="view" value="devices" bind:group={view}>
            <Icon data={listIcon} />
            Devices
        </label>

        <label>
            <input type="radio" name="view" value="timeline" bind:group={view}>
            <Icon data={timelineIcon} />
            Timeline
        </label>

        <label>
            <input type="radio" name="view" value="animations" bind:group={view}>
            <Icon data={animationsIcon} />
            Animations
        </label>

        <label>
            <input type="radio" name="view" value="css" bind:group={view}>
            <Icon data={cssIcon} />
            CSS
        </label>

        <label>
            <input type="radio" name="view" value="universe" bind:group={view}>
            <Icon data={universeIcon} />
            Universe
        </label>
    </nav>

    {#if showAddDevice && view === 'devices'}
        <div class="add-device">
            <select bind:value={selectedType}>
                {#each Object.entries(deviceTypes) as [key, type]}
                    <option value={key}>{type.name}</option>
                {/each}
            </select>
            <button onclick={onAddDevice}>Add Device</button>
        </div>
    {/if}

    {#if view === 'universe' && onClearUniverse}
        <div class="clear-universe">
            <button onclick={onClearUniverse}>Clear</button>
        </div>
    {/if}
</div>

<style>
    .tabs-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
    }

    nav {
        border: none;
        border-radius: 6px;
        font-family: system-ui;
        font-size: 10pt;
        display: flex;
        height: 32px;
        align-items: stretch;
        user-select: none;
    }

    label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0px 12px;
        cursor: pointer;
        border-radius: 6px;
    }

    label :global(svg) {
        width: 1.8em;
        height: 1.8em;
    }

    label:has(:focus-visible) {
        outline: -webkit-focus-ring-color auto 1px;
    }

    label:has(input:checked) {
        background: #fff;
    }

    input[type="radio"] {
        position: absolute;
        opacity: 0;
    }

    .add-device {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .add-device select {
        margin: 0;
        min-width: 200px;
        height: 32px;
    }

    .add-device button {
        margin: 0;
        height: 32px;
    }

    .clear-universe {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .clear-universe button {
        margin: 0;
        height: 32px;
    }
</style>
