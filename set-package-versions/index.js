import { execFileSync } from 'child_process';
import process from 'process';
import { readNpmPackages, setPackageVersions } from '../src/package-versions.js';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    console.error('Usage: node index.js x.y.z');
    process.exit(1);
}

const root = process.cwd();
const written = setPackageVersions(root, version, readNpmPackages(root));
for (const file of written) {
    console.log(`Set ${version} in ${file}`);
}
if (written.length > 0) {
    execFileSync('git', ['add', '--', ...written], { stdio: 'inherit' });
}
