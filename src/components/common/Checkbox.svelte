<script>
    let {
        checked = $bindable(false),
        disabled = false,
        onchange = null,
        label = null
    } = $props();

    function handleToggle() {
        if (disabled) return;
        checked = !checked;
        onchange?.(checked);
    }
</script>

<button
    class="checkbox"
    class:checked={checked}
    onclick={handleToggle}
    {disabled}
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
>
    <span class="checkbox-checkmark"></span>
</button>

<style>
    .checkbox {
        position: relative;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 3px;
        background: #fff;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .checkbox:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .checkbox-checkmark {
        width: 12px;
        height: 6px;
        border-left: 2px solid transparent;
        border-bottom: 2px solid transparent;
        transform: rotate(-45deg);
        transition: border-color 0.2s ease;
        pointer-events: none;
    }

    .checkbox.checked .checkbox-checkmark {
        border-left-color: #4caf50;
        border-bottom-color: #4caf50;
    }
</style>
