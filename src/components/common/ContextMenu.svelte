<script>
    /**
     * ContextMenu - A popover menu anchored to a trigger element
     *
     * Usage:
     *   <ContextMenu bind:contextRef={contextRef}>
     *     <ContextAction onclick={handleDelete}>
     *       {@html deleteIcon} Delete
     *     </ContextAction>
     *   </ContextMenu>
     *
     *   contextRef.show(anchorElement)
     */
    let {
        contextRef = $bindable(null),
        children
    } = $props();

    let popoverRef = $state(null);
    let currentAnchor = $state(null);
    let isOpen = $state(false);
    const anchorName = '--context-menu-anchor';
    const animationDuration = 150;

    function handleToggle(event) {
        isOpen = event.newState === 'open';
        
        // Clean up anchor-name when popover closes (after animation completes)
        if (event.newState === 'closed' && currentAnchor) {
            setTimeout(() => {
                if (currentAnchor) {
                    currentAnchor.style.anchorName = '';
                    currentAnchor = null;
                }
            }, animationDuration);
        }
    }

    function show(anchorElement) {
        // If already open with the same anchor, close it (toggle behavior)
        if (isOpen && currentAnchor === anchorElement) {
            popoverRef?.hidePopover();
            return;
        }

        if (anchorElement) {
            // Clean up previous anchor if any
            if (currentAnchor && currentAnchor !== anchorElement) {
                currentAnchor.style.anchorName = '';
            }
            currentAnchor = anchorElement;
            anchorElement.style.anchorName = anchorName;
        }

        popoverRef?.showPopover();
    }

    // Expose methods via contextRef
    $effect(() => {
        contextRef = { show };
    });
</script>

<div
    bind:this={popoverRef}
    class="context-menu"
    popover="auto"
    style="--anchor: {anchorName}; --menu: {anchorName}-menu;"
    ontoggle={handleToggle}
>
    <div class="context-menu-content">
        {@render children()}
    </div>
</div>

<style>
    .context-menu {
        --d: 10px;
        --s: 14px;

        position: absolute;
        position-anchor: var(--anchor);
        position-try-fallbacks: --context-top;

        top: calc(var(--d) + anchor(bottom));
        justify-self: anchor-center;

        
        padding: 0;
        border: none;
        border-radius: 6px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        
        margin: 0 var(--d);
        z-index: 100;
        overflow: visible;
        
        anchor-name: var(--menu);

        /* Animation */
        opacity: 1;
        transition: 
            opacity 0.15s ease-out,
            margin-top 0.1s ease-out,
            display 0.15s allow-discrete,
            overlay 0.15s allow-discrete;
    }

    /* Starting state for open animation */
    @starting-style {
        .context-menu:popover-open {
            opacity: 0;
            margin-top: -10px;
        }
    }

    /* Closing state */
    .context-menu:not(:popover-open) {
        opacity: 0;
        margin-top: -10px;
    }

    @position-try --context-top {
        top: auto;
        bottom: calc(anchor(top) + var(--d));
        margin: 0;
    }

    .context-menu::backdrop {
        background: transparent;
    }

    /* Arrow pointing to anchor */
    .context-menu::before {
        content: '';
        display: block;
        position: fixed;
        z-index: -1;
        width: var(--s);
        background: inherit;

        position-anchor: var(--anchor);
        position-try-fallbacks: --context-tip-top;

        top: calc(anchor(bottom));
        bottom: anchor(var(--menu) bottom);
        justify-self: anchor-center;
        
        clip-path: polygon(50% .2em, 100% var(--d), 100% calc(100% - var(--d)), 50% calc(100% - .2em), 0 calc(100% - var(--d)), 0 var(--d));
    }

    @position-try --context-tip-top {
        top: anchor(var(--menu) top);
        bottom: calc(anchor(top));
    }

    .context-menu-content {
        display: flex;
        flex-direction: column;
        min-width: 160px;
        padding: 8px 0;
        gap: 12px;
    }
</style>
