<script>
    import { Icon } from 'svelte-icon';
    import listIcon from '../assets/icons/list.svg?raw';
    import universeIcon from '../assets/icons/universe.svg?raw';

    let { view = $bindable() } = $props();
</script>

<div class="tabs-container">
    <nav>
        <label>
            <input type="radio" name="view" value="devices" bind:group={view}>
            <Icon data={listIcon} />
            Devices
        </label>

        <label>
            <input type="radio" name="view" value="universe" bind:group={view}>
            <Icon data={universeIcon} />
            Universe
        </label>
    </nav>
</div>

<style>
    .tabs-container {
        display: flex;
        padding: 15px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
    }

    nav {
        border: none;
        border-radius: 6px;
        background: #eaeaea;
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
        padding: 0px 16px;
        cursor: pointer;
    }

    label :global(svg) {
        width: 1.2em;
        height: 1.2em;
    }

    label:first-child {
        border-radius: 6px 0 0 6px;
    }

    label:last-child {
        border-radius: 0 6px 6px 0;
    }

    label:has(:focus-visible) {
        outline: -webkit-focus-ring-color auto 1px;
    }

    label:has(input:checked) {
        background: #d5d5d5;
    }

    input {
        position: absolute;
        opacity: 0;
    }
</style>
