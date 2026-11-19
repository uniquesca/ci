import fs from 'fs';
import path from 'path';

const DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];

/**
 * Expands the `release.npm_packages` entries into folders holding a package.json. An entry may use
 * `*` in place of any path segment.
 *
 * @param {string} root - Repository root.
 * @param {string[]} patterns - Folders relative to the root.
 * @returns {string[]} - Folders relative to the root, sorted, without duplicates.
 */
export function expandPackageFolders(root, patterns) {
    const found = new Set();

    for (const pattern of patterns) {
        let folders = ['.'];
        for (const segment of pattern.split('/').filter((s) => s !== '' && s !== '.')) {
            if (!segment.includes('*')) {
                folders = folders.map((folder) => path.join(folder, segment));
                continue;
            }
            const regex = new RegExp('^' + segment.split('*').map(escapeRegex).join('[^/]*') + '$');
            folders = folders.flatMap((folder) => {
                const full = path.join(root, folder);
                if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
                    return [];
                }
                return fs.readdirSync(full, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules' && regex.test(entry.name))
                    .map((entry) => path.join(folder, entry.name));
            });
        }

        const matched = folders.filter((folder) => fs.existsSync(path.join(root, folder, 'package.json')));
        if (matched.length === 0) {
            throw new Error(`release.npm_packages: "${pattern}" matches no folder with a package.json`);
        }
        matched.forEach((folder) => found.add(folder));
    }

    return [...found].sort();
}

function escapeRegex(text) {
    return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sets `version` in the root package.json and in every listed package, and sets every dependency
 * of a listed package on another one (or on the root package) to exactly that version.
 *
 * @param {string} root - Repository root.
 * @param {string} version - Version being released, x.y.z.
 * @param {string[]} patterns - `release.npm_packages` from `_ci_environment.json`.
 * @returns {string[]} - The package.json files written, relative to the root.
 */
export function setPackageVersions(root, version, patterns = []) {
    const folders = expandPackageFolders(root, patterns);
    if (fs.existsSync(path.join(root, 'package.json')) && !folders.includes('.')) {
        folders.unshift('.');
    }

    const packages = folders.map((folder) => {
        const file = path.join(folder, 'package.json');
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        return { file, text, json: JSON.parse(text) };
    });
    const names = new Set(packages.map((pkg) => pkg.json.name).filter(Boolean));

    const written = [];
    for (const pkg of packages) {
        pkg.json.version = version;
        for (const field of DEPENDENCY_FIELDS) {
            for (const name of Object.keys(pkg.json[field] ?? {})) {
                if (names.has(name) && name !== pkg.json.name) {
                    pkg.json[field][name] = version;
                }
            }
        }

        const indent = pkg.text.match(/^[ \t]+(?=")/m)?.[0] ?? '  ';
        const eol = pkg.text.includes('\r\n') ? '\r\n' : '\n';
        const output = JSON.stringify(pkg.json, null, indent).replace(/\n/g, eol) + (pkg.text.endsWith('\n') ? eol : '');
        if (output !== pkg.text) {
            fs.writeFileSync(path.join(root, pkg.file), output);
            written.push(pkg.file);
        }
    }

    return written;
}

/**
 * Reads `release.npm_packages` from `_ci_environment.json`. Missing file or key means none.
 *
 * @param {string} root - Repository root.
 * @returns {string[]}
 */
export function readNpmPackages(root) {
    const file = path.join(root, '_ci_environment.json');
    if (!fs.existsSync(file)) {
        return [];
    }
    const packages = JSON.parse(fs.readFileSync(file, 'utf8')).release?.npm_packages ?? [];
    if (!Array.isArray(packages) || packages.some((p) => typeof p !== 'string')) {
        throw new Error('_ci_environment.json: release.npm_packages has to be an array of folder paths');
    }
    return packages;
}
