<script>
    import { Icon } from 'svelte-icon';

    /**
     * Icon-only button component
     *
     * @prop {string} icon - SVG icon raw string
     * @prop {string} label - Accessible label for screen readers
     * @prop {Function} onclick - Click handler
     * @prop {boolean} disabled - Whether button is disabled
     * @prop {string} size - Button size: 'small' | 'medium' | 'large'
     */
    let {
        icon,
        label,
        onclick = null,
        disabled = false,
        size = 'medium'
    } = $props();
</script>

<button
    class="icon-button {size}"
    {onclick}
    {disabled}
    aria-label={label}
    title={label}
>
    <Icon data={icon} />
</button>

<style>
    .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .icon-button:hover:not(:disabled) {
        opacity: 0.7;
    }

    .icon-button:active:not(:disabled) {
        opacity: 0.5;
    }

    .icon-button:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .icon-button.small {
        width: 20px;
        height: 20px;
    }

    .icon-button.medium {
        width: 32px;
        height: 32px;
    }

    .icon-button.large {
        width: 48px;
        height: 48px;
    }

    .icon-button :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
