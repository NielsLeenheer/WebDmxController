<script>
    import { onMount } from 'svelte';
    import { EditorView, basicSetup } from 'codemirror';
    import { EditorState } from '@codemirror/state';
    import { keymap } from '@codemirror/view';
    import { indentWithTab } from '@codemirror/commands';

    let {
        value = $bindable(''),
        language = null,
        oninput = null,
        readonly = false,
        placeholder = '',
        paddingTop = '0px',
        paddingRight = '0px'
    } = $props();

    let containerRef = $state(null);
    let editorView = null;
    let ignoreNextUpdate = false;

    onMount(() => {
        const extensions = [
            basicSetup,
            keymap.of([indentWithTab]),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged && !ignoreNextUpdate) {
                    const newValue = update.state.doc.toString();
                    value = newValue;
                    if (oninput) oninput(newValue);
                }
                ignoreNextUpdate = false;
            }),
            EditorView.theme({
                '&': {
                    height: '100%',
                    fontSize: '10pt',
                    backgroundColor: 'transparent'
                },
                '.cm-scroller': {
                    overflow: 'auto',
                    fontFamily: 'var(--font-stack-mono)',
                    paddingTop
                },
                '.cm-content': {
                    minHeight: '200px',
                    paddingRight
                },
                '&.cm-focused': {
                    outline: 'none'
                },
                '.cm-gutters': {
                    display: 'none'
                },
                '.cm-activeLineGutter': {
                    backgroundColor: '#f0f0f0'
                },
                '.cm-activeLine': {
                    backgroundColor: 'transparent'
                }
            })
        ];

        if (language) {
            extensions.push(language);
        }

        if (readonly) {
            extensions.push(EditorState.readOnly.of(true));
        }

        if (placeholder) {
            import('@codemirror/view').then(({ placeholder: ph }) => {
                // Placeholder is set at creation, can't add dynamically easily
            });
        }

        editorView = new EditorView({
            state: EditorState.create({
                doc: value,
                extensions
            }),
            parent: containerRef
        });

        return () => {
            editorView?.destroy();
        };
    });

    // Update editor when value changes externally
    $effect(() => {
        if (editorView && value !== editorView.state.doc.toString()) {
            ignoreNextUpdate = true;
            editorView.dispatch({
                changes: {
                    from: 0,
                    to: editorView.state.doc.length,
                    insert: value
                }
            });
        }
    });
</script>

<div class="code-editor" bind:this={containerRef}></div>

<style>
    .code-editor {
        height: 100%;
        overflow: hidden;
    }

    .code-editor :global(.cm-editor) {
        height: 100%;
    }
</style>
