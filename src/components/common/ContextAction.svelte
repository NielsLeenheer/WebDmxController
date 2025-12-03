<script>
    /**
     * ContextAction - A menu item for ContextMenu
     *
     * Usage:
     *   <ContextAction onclick={handleAction}>
     *     {@html icon} Action Label
     *   </ContextAction>
     *
     * @prop {Function} onclick - Click handler
     * @prop {boolean} disabled - Whether the action is disabled
     * @prop {string} variant - Style variant: 'default' | 'danger'
     */
    let {
        onclick = null,
        disabled = false,
        variant = 'default',
        children
    } = $props();

    function handleClick(event) {
        if (disabled) {
            event.preventDefault();
            return;
        }

        // Close the popover (find parent context menu)
        const popover = event.target.closest('[popover]');
        if (popover) {
            popover.hidePopover();
        }

        if (onclick) {
            onclick(event);
        }
    }
</script>

<button
    class="context-action {variant}"
    class:disabled
    onclick={handleClick}
    {disabled}
>
    {@render children()}
</button>

<style>
    .context-action {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        height: auto;
        border: none;
        border-radius: 0;
        background: transparent;
        font-family: system-ui;
        font-weight: 500;
        font-size: 10pt;
        color: #333;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.3s;

        margin-top: -8px;
        margin-bottom: -8px;
        padding: 8px 12px;
    }

    .context-action:first-child {
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
    }
    .context-action:last-child {
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
    }

    .context-action:hover:not(:disabled) {
        background: #f0f0f0;
    }

    .context-action:active:not(:disabled) {
        background: #e0e0e0;
    }

    .context-action.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .context-action.danger:hover:not(:disabled) {
        /* background: #fef0f0; */
    }

    .context-action :global(svg) {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }

</style>
