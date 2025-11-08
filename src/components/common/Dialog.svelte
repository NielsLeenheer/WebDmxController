<script>
    /**
     * Reusable Dialog component
     *
     * @prop {string} title - Dialog title
     * @prop {Function} onclose - Close handler
     * @prop {boolean} open - Bind to control dialog state
     */
    let {
        title,
        onclose = null,
        dialogRef = $bindable(null),
        children
    } = $props();

    function handleClose() {
        dialogRef?.close();
        if (onclose) onclose();
    }
</script>

<dialog bind:this={dialogRef} class="dialog">
    <div class="dialog-header">
        <h2>{title}</h2>
        <button class="close-btn" onclick={handleClose}>×</button>
    </div>
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
</style>
