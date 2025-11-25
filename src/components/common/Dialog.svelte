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
     * @prop {string} width - Explicit width for the dialog (optional)
     * @snippet tools - Optional snippet for tool buttons (e.g., Delete)
     * @snippet buttons - Optional snippet for action buttons (e.g., Cancel, Save)
     */
    let {
        title = null,
        onclose = null,
        dialogRef = $bindable(null),
        anchored = false,
        anchorId = null,
        showArrow = true,
        lightDismiss = true,
        width = null,
        children,
        tools,
        buttons
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
    class:explicit-width={width !== null}
    style="{anchored && anchorId ? `--dialog: --${anchorId}-dialog; --anchor: --${anchorId};` : ''}{width ? `width: ${width};` : ''}"
    onclick={handleClick}
>
    {#if title}
        <div class="dialog-header">
            <h2>{title}</h2>
        </div>
    {/if}
    <div class="dialog-body">
        {@render children()}
    </div>
    {#if tools || buttons}
        <div class="dialog-footer">
            <div class="dialog-footer-tools">
                {#if tools}
                    {@render tools()}
                {/if}
            </div>
            <div class="dialog-footer-buttons">
                {#if buttons}
                    {@render buttons()}
                {/if}
            </div>
        </div>
    {/if}
</dialog>

<style>
    .dialog {
        border: none;
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-height: 90vh;
    }

    /* Default sizing for implicitly sized dialogs */
    .dialog:not(.explicit-width) {
        min-width: 400px;
        max-width: 90vw;
    }

    .dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    /* Anchored dialog styles */
    .dialog.anchored {
        --d: 12px; 
        --s: 18px;

        position: absolute;
        position-anchor: var(--anchor);
        position-try-fallbacks: --custom-top;

        top: anchor(bottom);
        top: calc(var(--d) + anchor(bottom));
        justify-self: anchor-center;

        margin: 0 var(--d);
        z-index: 100;
        overflow: visible;

        anchor-name: var(--dialog);
    }

    @position-try --custom-top {
        top: auto;
        bottom: calc(anchor(top) + var(--d));
        margin: 0;
    }


    /* Default sizing for implicitly sized anchored dialogs */
    .dialog.anchored:not(.explicit-width) {
        min-width: 300px;
        max-width: 400px;
    }

    .dialog.anchored::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }

    /* Arrow pointing up to anchor element */
    .dialog.show-arrow::before {
        content: '';
        display: block;
        position: fixed;
        z-index: -1;
        width: var(--s);
        background: inherit;

        position-anchor: var(--anchor);
        position-try-fallbacks: --custom-tip-top;

        top: calc(anchor(bottom));
        bottom: anchor(var(--dialog) bottom);
        justify-self: anchor-center;

        clip-path: polygon(50% .2em,100% var(--d),100% calc(100% - var(--d)),50% calc(100% - .2em),0 calc(100% - var(--d)),0 var(--d));
    }

    @position-try --custom-tip-top {
        top: anchor(var(--dialog) top);
        bottom: calc(anchor(top));
    }

    .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: #f5f5f5;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
    }

    .dialog-header h2 {
        margin: 0;
        font-size: 12pt;
        font-weight: 600;
    }

    .dialog-body {
        padding: 20px;
    }

    .dialog-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px 20px 20px;
        gap: 10px;
    }

    .dialog-footer-tools {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .dialog-footer-buttons {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .dialog-footer :global(svg) {
        width: 16px;
        height: 16px;
        margin-right: 6px;
    }
</style>
