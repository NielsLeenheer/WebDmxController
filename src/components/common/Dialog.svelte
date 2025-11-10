<script>
    /**
     * Reusable Dialog component
     *
     * @prop {string} title - Dialog title (optional for anchored dialogs)
     * @prop {Function} onclose - Close handler
     * @prop {boolean} open - Bind to control dialog state
     * @prop {boolean} anchored - Enable anchored positioning
     * @prop {string} anchorId - Anchor name (CSS anchor-name value)
     * @prop {boolean} showArrow - Show arrow pointing to anchor (default true for anchored)
     * @prop {boolean} lightDismiss - Enable light dismiss on backdrop click (default true for anchored)
     */
    let {
        title = null,
        onclose = null,
        dialogRef = $bindable(null),
        anchored = false,
        anchorId = null,
        showArrow = true,
        lightDismiss = true,
        children
    } = $props();

    function handleClose() {
        dialogRef?.close();
        if (onclose) onclose();
    }

    function handleClick(event) {
        if (anchored && lightDismiss && event.target === dialogRef) {
            handleClose();
        }
    }
</script>

<dialog
    bind:this={dialogRef}
    class="dialog"
    class:anchored
    class:show-arrow={showArrow && anchored}
    style={anchored && anchorId ? `position-anchor: --${anchorId}` : ''}
    onclick={handleClick}
>
    {#if title}
        <div class="dialog-header">
            <h2>{title}</h2>
            <button class="close-btn" onclick={handleClose}>×</button>
        </div>
    {/if}
    <div class="dialog-body">
        {@render children()}
    </div>
</dialog>

<style>
    .dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        min-width: 400px;
        max-width: 90vw;
        max-height: 90vh;
    }

    .dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    /* Anchored dialog styles */
    .dialog.anchored {
        position: fixed;
        position-anchor: var(--position-anchor);
        top: anchor(bottom);
        left: anchor(center);
        translate: -50% 8px;
        margin: 0;
        z-index: 100;
        min-width: 300px;
        max-width: 400px;
        overflow: visible;
    }

    .dialog.anchored::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }

    /* Arrow pointing up to anchor element */
    .dialog.show-arrow::before {
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid #fff;
        filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.1));
    }

    .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #ddd;
        background: #f5f5f5;
    }

    .dialog-header h2 {
        margin: 0;
        font-size: 14pt;
        font-weight: 600;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 24pt;
        line-height: 1;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .close-btn:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #333;
    }

    .dialog-body {
        padding: 20px;
    }

    /* Remove padding for anchored dialogs (content handles its own padding) */
    .dialog.anchored .dialog-body {
        padding: 0;
    }
</style>
