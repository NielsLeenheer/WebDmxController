<script>
    /**
     * Reusable Button component
     *
     * @prop {string} variant - Button style variant: 'primary' | 'secondary' | 'danger'
     * @prop {boolean} disabled - Whether button is disabled
     * @prop {Function} onclick - Click handler
     * @prop {string} type - Button type attribute
     */
    let {
        variant = 'primary',
        disabled = false,
        onclick = null,
        type = 'button',
        children
    } = $props();
</script>

<button
    class="button {variant}"
    {disabled}
    {onclick}
    {type}
>
    {@render children()}
</button>

<style>
    .button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-family: system-ui;
        font-size: 10pt;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s, opacity 0.2s;
        user-select: none;
    }

    .button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .button.primary {
        background: #0078d4;
        color: white;
    }

    .button.primary:hover:not(:disabled) {
        background: #106ebe;
    }

    .button.primary:active:not(:disabled) {
        background: #005a9e;
    }

    .button.secondary {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
    }

    .button.secondary:hover:not(:disabled) {
        background: #e0e0e0;
    }

    .button.secondary:active:not(:disabled) {
        background: #d0d0d0;
    }

    .button.danger {
        background: #d13438;
        color: white;
    }

    .button.danger:hover:not(:disabled) {
        background: #a52a2d;
    }

    .button.danger:active:not(:disabled) {
        background: #7d1f22;
    }
</style>
