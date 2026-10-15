// A short map of a repository's folders for an agent's prompt, built from the paths git tracks.

// Dependencies and build output: one line each, never opened. A repository that commits them
// would otherwise spend the whole map on them.
const UNOPENED = new Set(['node_modules', 'vendor', 'dist', 'build']);

function tree(paths) {
    const root = { files: 0, children: new Map() };
    for (const file of paths) {
        const folders = file.split('/').slice(0, -1);
        let node = root;
        node.files += 1;
        for (const name of folders) {
            if (!node.children.has(name)) {
                node.children.set(name, { files: 0, children: new Map() });
            }
            node = node.children.get(name);
            node.files += 1;
        }
    }
    return root;
}

function render(node, depth, maxChildren, indent = '') {
    if (depth === 0) {
        return [];
    }
    // The biggest folders are the ones worth naming, shown in name order
    const shown = [...node.children]
        .sort(([, a], [, b]) => b.files - a.files)
        .slice(0, maxChildren)
        .sort(([a], [b]) => a.localeCompare(b));
    const lines = shown.flatMap(([name, child]) => [
        `${indent}${name}/ (${child.files})`,
        ...(UNOPENED.has(name) ? [] : render(child, depth - 1, maxChildren, `${indent}  `)),
    ]);
    const hidden = node.children.size - shown.length;
    if (hidden > 0) {
        lines.push(`${indent}... ${hidden} more folders`);
    }
    return lines;
}

// The deepest map that fits in maxLines, never less than the top level. Empty when there are
// no folders.
export function folderMap(paths, { depth = 3, maxLines = 100, maxChildren = 12 } = {}) {
    const root = tree(paths);
    let lines = [];
    for (let d = depth; d >= 1; d--) {
        lines = render(root, d, maxChildren);
        if (lines.length <= maxLines) {
            break;
        }
    }
    return lines.join('\n');
}
