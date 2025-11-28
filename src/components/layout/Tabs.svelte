<script>
    import { Icon } from 'svelte-icon';
    import listIcon from '../../assets/icons/list.svg?raw';
    import universeIcon from '../../assets/icons/universe.svg?raw';
    import animationsIcon from '../../assets/icons/animations.svg?raw';
    import inputsIcon from '../../assets/icons/inputs.svg?raw';
    import triggersIcon from '../../assets/icons/triggers.svg?raw';
    import cssIcon from '../../assets/icons/css.svg?raw';

    let {
        view = $bindable(),
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
            <input type="radio" name="view" value="animations" bind:group={view}>
            <Icon data={animationsIcon} />
            Animations
        </label>

        <label>
            <input type="radio" name="view" value="inputs" bind:group={view}>
            <Icon data={inputsIcon} />
            Inputs
        </label>

        <label>
            <input type="radio" name="view" value="triggers" bind:group={view}>
            <Icon data={triggersIcon} />
            Triggers
        </label>

        <label>
            <input type="radio" name="view" value="css" bind:group={view}>
            <Icon data={cssIcon} />
            Editor
        </label>

        <label>
            <input type="radio" name="view" value="universe" bind:group={view}>
            <Icon data={universeIcon} />
            Universe
        </label>
    </nav>

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
