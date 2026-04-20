<script>
    import Preview from '../common/Preview.svelte';
    import activeIcon from '../../assets/icons/active.svg?raw';

    let {
        label,        // group display name
        items,        // Array<{ input, selected: boolean, inputState: object }>
        onSelect      // (input) => void
    } = $props();
</script>

<div class="group-card">
    <div class="group-header">{label}</div>
    <div class="group-items">
        {#each items as item (item.input.id)}
            <button
                type="button"
                class="group-item"
                onclick={() => onSelect?.(item.input)}
            >
                <Preview
                    type="input"
                    size="small"
                    data={item.input}
                    state={item.inputState}
                />
                <div class="group-item-name">{item.input.name}</div>
                <div class="group-item-check" aria-hidden="true">
                    {#if item.selected}
                        {@html activeIcon}
                    {/if}
                </div>
            </button>
        {/each}
    </div>
</div>

<style>
    .group-card {
        background: #f0f0f0;
        border: none;
        border-radius: 8px;
        padding: 15px;
    }

    .group-header {
        font-size: 9pt;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding-bottom: 10px;
    }

    .group-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .group-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        border-radius: 0;
        font-family: inherit;
        color: inherit;
    }

    .group-item-name {
        flex: 1;
        min-width: 0;
        font-size: 10pt;
        font-weight: 500;
        color: #333;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .group-item-check {
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #2196f3;
    }

    .group-item-check :global(svg) {
        width: 18px;
        height: 18px;
    }
</style>
