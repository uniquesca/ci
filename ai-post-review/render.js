// Usage: node render.js <review.json> <positions.json> <out-dir> [links.json]
// Writes body.md and comments.json into <out-dir>, and prints the outcome as JSON. Also writes
// body-full.md: the same review with every finding in the body, for when it goes out without its
// inline comments and their text would otherwise be lost. `links.json` is the address of each
// posted inline comment, in order, for laying the body out again with its list linked.
import fs from 'node:fs';
import path from 'node:path';
import { renderReview } from '../src/ai-review.js';
import { withTextStats } from '../src/ai-text.js';

const [reviewFile, positionsFile, outDir, linksFile] = process.argv.slice(2);

let raw = null;
try {
    raw = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
} catch {
    // Reported by renderReview as "not a JSON object"
}

const positions = new Set(Object.keys(JSON.parse(fs.readFileSync(positionsFile, 'utf8'))));

let plan = null;
try {
    plan = JSON.parse(fs.readFileSync(process.env.PLAN_FILE, 'utf8'));
} catch {
    // The review is what is being checked
}

const options = {
    maxComments: Number(process.env.MAX_COMMENTS),
    maxLength: Number(process.env.MAX_LENGTH),
    plan,
};
let links = [];
if (linksFile) {
    try {
        links = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
    } catch {
        // The body goes out unlinked
    }
}

const result = renderReview(raw, { ...options, positions, links: Array.isArray(links) ? links : [] });
const full = renderReview(raw, { ...options, positions: new Set() });

fs.writeFileSync(path.join(outDir, 'body.md'), result.body + '\n');
fs.writeFileSync(path.join(outDir, 'body-full.md'), full.body + '\n');
fs.writeFileSync(path.join(outDir, 'comments.json'), JSON.stringify(result.comments));

console.log(JSON.stringify({
    verdict: result.verdict,
    comments: result.comments.length,
    unplaced: result.unplaced,
    problems: result.problems,
    cost_line: withTextStats(process.env.COST, {
        chars: result.body.length + result.comments.reduce((sum, c) => sum + c.body.length, 0),
        structured: true,
        problems: result.problems,
    }),
}));
