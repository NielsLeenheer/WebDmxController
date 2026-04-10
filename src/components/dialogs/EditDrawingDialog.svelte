<script>
	import Dialog from '../common/Dialog.svelte';
	import Button from '../common/Button.svelte';
	import Group from '../common/form/Group.svelte';
	import InputText from '../common/form/InputText.svelte';
	import IdentifierPreview from '../common/IdentifierPreview.svelte';
	import { drawingLibrary } from '../../stores.svelte.js';
	import { toUniqueCSSIdentifier } from '../../lib/css/utils.js';

	let dialogRef = $state(null);
	let resolvePromise = $state(null);

	let editingDrawing = $state(null);
	let drawingName = $state('');

	export function open(drawing) {
		return new Promise((resolve) => {
			resolvePromise = resolve;
			editingDrawing = drawing;
			drawingName = drawing.name;

			requestAnimationFrame(() => {
				dialogRef?.showModal();
			});
		});
	}

	function handleSave() {
		if (!editingDrawing || !drawingName.trim()) {
			resolvePromise(null);
			closeDialog();
			return;
		}

		resolvePromise({ name: drawingName.trim() });
		closeDialog();
	}

	function handleCancel() {
		resolvePromise(null);
		closeDialog();
	}

	function closeDialog() {
		dialogRef?.close();
		editingDrawing = null;
		drawingName = '';
	}
</script>

{#if editingDrawing}
<Dialog
	bind:dialogRef={dialogRef}
	title="Edit Drawing"
	onclose={handleCancel}
>
	<form id="edit-drawing-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
		<Group label="Drawing Name:" for="drawing-name">
			<InputText
				id="drawing-name"
				bind:value={drawingName}
				placeholder="Drawing name"
				autofocus
			/>

			<IdentifierPreview
				identifiers={[`#${toUniqueCSSIdentifier(
					drawingName,
					new Set(drawingLibrary.getAll().filter(d => d.id !== editingDrawing?.id).map(d => d.cssIdentifier))
				)}`]}
			/>
		</Group>
	</form>

	{#snippet buttons()}
		<Button onclick={handleCancel} variant="secondary">Cancel</Button>
		<Button onclick={handleSave} variant="primary">Save</Button>
	{/snippet}
</Dialog>
{/if}
