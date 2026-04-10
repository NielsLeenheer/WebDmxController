<script>
	import { drawingLibrary } from '../../stores.svelte.js';
	import { createDragDrop } from '../../lib/ui/dragdrop.svelte.js';
	import DrawingCard from '../cards/DrawingCard.svelte';
	import Button from '../common/Button.svelte';
	import ContextMenu from '../common/ContextMenu.svelte';
	import ContextAction from '../common/ContextAction.svelte';
	import ContextSeparator from '../common/ContextSeparator.svelte';
	import EditDrawingDialog from '../dialogs/EditDrawingDialog.svelte';
	import CodeEditor from '../common/CodeEditor.svelte';
	import IconButton from '../common/IconButton.svelte';
	import { html } from '@codemirror/lang-html';
	import { toUniqueCSSIdentifier } from '../../lib/css/utils.js';

	import newIcon from '../../assets/icons/new.svg?raw';
	import editIcon from '../../assets/icons/edit.svg?raw';
	import removeIcon from '../../assets/icons/remove.svg?raw';
	import activeIcon from '../../assets/icons/active.svg?raw';
	import openIcon from '../../assets/icons/open.svg?raw';
	import saveIcon from '../../assets/icons/save.svg?raw';
	import duplicateIcon from '../../assets/icons/duplicate.svg?raw';
	import dotsIcon from '../../assets/glyphs/dots.svg?raw';

	let {
		laserManager,
		selectedDrawingId = $bindable(null)
	} = $props();

	let drawings = $derived(drawingLibrary.getAll());

	// Selected drawing
	let selectedDrawing = $derived(selectedDrawingId ? drawingLibrary.get(selectedDrawingId) : null);
	let editorContent = $state('');

	// Auto-select first drawing by order
	$effect(() => {
		if (!selectedDrawingId && drawings.length > 0) {
			const first = drawings.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
			selectDrawing(first.id);
		}
	});

	// Re-inject drawings when library changes (track full array for property changes)
	$effect(() => {
		// Access each drawing's properties to track changes like isDefault, content, name
		for (const d of drawings) { d.isDefault; d.content; d.cssIdentifier; }
		laserManager?.updateDrawings();
	});

	// Dialog and context menu refs
	let editDrawingDialog;
	let contextMenuRef = $state(null);
	let editorMenuRef = $state(null);
	let editorMenuButtonRef = $state(null);

	// Drag and drop
	const dnd = createDragDrop({
		items: () => drawings,
		onReorder: (orderedIds) => {
			drawingLibrary.reorder(orderedIds);
		},
		orientation: 'vertical',
		getItemId: (item) => item.id
	});

	function selectDrawing(id) {
		selectedDrawingId = id;
		const drawing = drawingLibrary.get(id);
		editorContent = drawing?.content || '';
	}

	function addDrawing() {
		const drawing = drawingLibrary.create();
		selectDrawing(drawing.id);
	}

	function deleteDrawing(drawing) {
		if (!drawing) return;
		if (!confirm(`Delete drawing "${drawing.name}"?`)) return;

		const wasSelected = selectedDrawingId === drawing.id;
		drawingLibrary.remove(drawing.id);

		if (wasSelected) {
			selectedDrawingId = null;
		}
	}

	async function editDrawing(drawing) {
		if (!drawing) return;
		const result = await editDrawingDialog.open(drawing);
		if (!result) return;

		const existingIdentifiers = new Set(
			drawingLibrary.getAll().filter(d => d.id !== drawing.id).map(d => d.cssIdentifier)
		);

		drawingLibrary.update(drawing.id, {
			name: result.name,
			cssIdentifier: toUniqueCSSIdentifier(result.name, existingIdentifiers)
		});
	}

	function duplicateDrawing(drawing) {
		if (!drawing) return;
		const copy = drawingLibrary.create(`${drawing.name} (copy)`, drawing.content);
		selectDrawing(copy.id);
	}

	function setDefault(drawing) {
		if (!drawing) return;
		if (drawing.isDefault) {
			drawingLibrary.clearDefault();
		} else {
			drawingLibrary.setDefault(drawing.id);
		}
	}

	let updateTimeout = null;

	function handleEditorInput(newContent) {
		editorContent = newContent;

		if (updateTimeout) clearTimeout(updateTimeout);
		updateTimeout = setTimeout(() => {
			if (selectedDrawingId) {
				drawingLibrary.updateContent(selectedDrawingId, newContent);
			}
		}, 500);
	}

	function saveDrawing() {
		if (!selectedDrawing) return;
		const blob = new Blob([selectedDrawing.content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${selectedDrawing.name}.svg`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function loadDrawing() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.svg,.xml,.txt';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file || !selectedDrawingId) return;
			const reader = new FileReader();
			reader.onload = () => {
				const content = reader.result;
				editorContent = content;
				drawingLibrary.updateContent(selectedDrawingId, content);
			};
			reader.readAsText(file);
		};
		input.click();
	}
</script>

<div class="drawing-view">
	<!-- Left column: Drawing list -->
	<div class="drawings-column">
		<div class="column-header">
			<Button onclick={addDrawing} variant="secondary" size="small">
				{@html newIcon}
				Add Drawing
			</Button>
		</div>

		<div class="drawings-list">
			{#each drawings as drawing (drawing.id)}
				<DrawingCard
					{drawing}
					{dnd}
					isDefault={drawing.isDefault}
					isSelected={selectedDrawingId === drawing.id}
					onEdit={(item, anchor) => contextMenuRef?.show(item, anchor)}
					onSelect={(d) => selectDrawing(d.id)}
				/>
			{/each}

			{#if drawings.length === 0}
				<div class="empty-state">
					<p>No drawings yet.</p>
					<p>Click "Add Drawing" to create one.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Right column: Editor -->
	<div class="editor-column">
		<div class="editor-kebab">
			<IconButton
				bind:buttonRef={editorMenuButtonRef}
				icon={dotsIcon}
				onclick={() => editorMenuRef?.show(null, editorMenuButtonRef)}
				title="Options"
				size="small"
			/>
		</div>

		{#if selectedDrawing}
			<div class="editor-area">
				<CodeEditor
					bind:value={editorContent}
					language={html()}
					oninput={handleEditorInput}
					paddingTop="88px"
					paddingRight="40px"
				/>
			</div>
		{:else}
			<div class="empty-state">
				<p>Select a drawing to edit</p>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Drawing Dialog -->
<EditDrawingDialog bind:this={editDrawingDialog} />

<!-- Context Menu -->
<ContextMenu bind:contextRef={contextMenuRef}>
	<ContextAction onclick={(drawing) => setDefault(drawing)}>
		{@html activeIcon}
		{#if contextMenuRef?.getContext()?.isDefault}
			Clear Default
		{:else}
			Set as Default
		{/if}
	</ContextAction>
	<ContextAction onclick={(drawing) => editDrawing(drawing)}>
		{@html editIcon}
		Edit
	</ContextAction>
	<ContextAction onclick={(drawing) => duplicateDrawing(drawing)}>
		{@html duplicateIcon}
		Duplicate
	</ContextAction>
	<ContextSeparator />
	<ContextAction onclick={(drawing) => deleteDrawing(drawing)} variant="danger">
		{@html removeIcon}
		Delete
	</ContextAction>
</ContextMenu>

<!-- Editor Menu -->
<ContextMenu bind:contextRef={editorMenuRef}>
	<ContextAction onclick={loadDrawing} disabled={!selectedDrawing}>{@html openIcon} Load SVG</ContextAction>
	<ContextAction onclick={saveDrawing} disabled={!selectedDrawing}>{@html saveIcon} Save SVG</ContextAction>
</ContextMenu>

<style>
	.drawing-view {
		display: grid;
		grid-template-columns: 320px 1fr;
		height: 100%;
		overflow: hidden;
	}

	.drawings-column,
	.editor-column {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.editor-column {
		position: relative;
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px 40px;
		gap: 8px;
	}

	.drawings-column .column-header {
		padding-right: 16px;
	}
	.editor-kebab {
		position: absolute;
		top: 26px;
		right: 40px;
		z-index: 1;
	}

	.drawings-list {
		flex: 1;
		overflow-y: auto;
		padding: 20px 40px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.drawings-column .drawings-list {
		padding-right: 16px;
	}

	.editor-area {
		flex: 1;
		overflow: hidden;
		padding: 0 0 0 16px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		font-size: 10pt;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		padding: 4px;
	}
</style>
