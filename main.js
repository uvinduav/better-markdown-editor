import { EditorView, keymap, ViewPlugin, Decoration } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const fileInput = document.getElementById('file-input');
const openBtn = document.getElementById('open-btn');
const saveBtn = document.getElementById('save-btn');

// --- Rich Markdown Styling ---
// This theme styles the *syntax* itself to look like a preview.
const markdownHighlighting = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "2.2em", fontWeight: "bold", color: "#222" },
    { tag: tags.heading2, fontSize: "1.8em", fontWeight: "bold", color: "#333" },
    { tag: tags.heading3, fontSize: "1.5em", fontWeight: "bold", color: "#444" },
    { tag: tags.heading4, fontSize: "1.2em", fontWeight: "bold", color: "#555" },
    { tag: tags.heading5, fontWeight: "bold", color: "#666" },
    { tag: tags.heading6, color: "#777" },

    { tag: tags.strong, fontWeight: "bold", color: "#000" },
    { tag: tags.emphasis, fontStyle: "italic", color: "#333" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#888" },

    { tag: tags.link, color: "#007bff", textDecoration: "underline" },
    { tag: tags.url, color: "#0056b3" },

    { tag: tags.quote, fontStyle: "italic", color: "#666", borderLeft: "4px solid #ddd" },
    { tag: tags.monospace, fontFamily: "monospace", backgroundColor: "#f0f0f0", borderRadius: "3px", padding: "2px" },

    { tag: tags.list, color: "#333" }
]);

const baseTheme = EditorView.baseTheme({
    "&": {
        fontSize: "16px",
        lineHeight: "1.6",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    ".cm-content": {
        maxWidth: "800px",
        margin: "0 auto",
        paddingBottom: "300px" // Scrolling space
    },
    ".cm-line": {
        padding: "0 4px"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "#007bff"
    }
});

// --- Syntax Hiding Plugin (WYSIWYG) ---
const hideMarksPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.compute(view);
    }
    update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.compute(update.view);
        }
    }
    compute(view) {
        let widgets = [];
        let ranges = view.state.selection.ranges;
        for (let { from, to } of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from, to,
                enter: (node) => {
                    // Hide generic formatting markers (Hash, Stars, etc)
                    // Targets: HeaderMark, EmphasisMark, StrongEmphasisMark, QuoteMark
                    if (
                        node.name === "HeaderMark" ||
                        node.name === "EmphasisMark" ||
                        node.name === "StrongEmphasisMark" ||
                        node.name === "QuoteMark"
                    ) {
                        // Check for cursor collision (Cursor inside or touching the mark)
                        let overlap = false;
                        for (let r of ranges) {
                            if (r.from <= node.to && r.to >= node.from) {
                                overlap = true;
                                break;
                            }
                        }
                        if (!overlap) {
                            widgets.push(Decoration.replace({}).range(node.from, node.to));
                        }
                    }
                }
            })
        }
        return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
}, {
    decorations: v => v.decorations
});

// --- CodeMirror Setup ---
const startState = EditorState.create({
    doc: "# Better Markdown Editor\n\n## Live Preview\n\nSymbols like **bold** hashes and *italic* stars are hidden until you click on them.\n\nTry clicking here -> **Reveal Me**\n\n> This quote mark is also hidden.",
    extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        markdown(),
        syntaxHighlighting(markdownHighlighting),
        baseTheme,
        hideMarksPlugin,
        EditorView.lineWrapping
    ]
});

const view = new EditorView({
    state: startState,
    parent: document.getElementById('editor')
});


// --- Toolbar Functionality ---

// Save Functionality
saveBtn.addEventListener('click', () => {
    const text = view.state.doc.toString();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
});

// Open Functionality
openBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            // Update CodeMirror doc
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: content }
            });
        };
        reader.readAsText(file);
    }
    // Reset input
    fileInput.value = '';
});
