<script>
	/**
	 * IdentifierPreview - Displays CSS identifier previews
	 *
	 * Props:
	 * - identifiers: Array of identifier strings to display
	 */

	let { identifiers } = $props();
</script>

<div class="css-identifiers">
	{#each identifiers as identifier}
		<code class="css-identifier">{identifier}</code>
	{/each}
</div>

<style>
    
    .css-identifiers {
        display: flex;
        flex-wrap: wrap;
        justify-content: end;
        gap: 8px;
        margin-top: 8px;
    }

        .css-identifier {
        font-family: var(--font-stack-mono);
        font-size: 8pt;
        color: #888;
        display: inline-block;
    }

</style>