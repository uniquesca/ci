// Usage: node render.js <review.json> <positions.json> <out-dir>
// Writes body.md and comments.json into <out-dir>, and prints the outcome as JSON.
import fs from 'node:fs';
import path from 'node:path';
import { renderReview } from '../src/ai-review.js';

const [reviewFile, positionsFile, outDir] = process.argv.slice(2);

let raw = null;
try {
    raw = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
} catch {
    // Reported by renderReview as "not a JSON object"
}

const positions = new Set(Object.keys(JSON.parse(fs.readFileSync(positionsFile, 'utf8'))));

const result = renderReview(raw, {
    positions,
    maxComments: Number(process.env.MAX_COMMENTS),
    maxLength: Number(process.env.MAX_LENGTH),
});

fs.writeFileSync(path.join(outDir, 'body.md'), result.body + '\n');
fs.writeFileSync(path.join(outDir, 'comments.json'), JSON.stringify(result.comments));

console.log(JSON.stringify({
    verdict: result.verdict,
    comments: result.comments.length,
    unplaced: result.unplaced,
    problems: result.problems,
}));
