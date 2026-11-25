import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkOrder, readWorkOrder, workOrderComment, WORK_ORDER_MARKER } from '../src/ai-work-order.js';

const order = buildWorkOrder({
    source: { kind: 'issue', repository: 'uniquesca/officio', number: 12, url: 'https://github.com/uniquesca/officio/issues/12' },
    task: { title: 'Export clients', body: 'As CSV.' },
    plan: { summary: 'Add an export.', steps: [{ id: 'S1', title: 'Add the button' }] },
    planMarkdown: 'Add an export.',
    planUrl: 'https://github.com/uniquesca/officio/issues/12#issuecomment-1',
    planBase: 'develop',
    planCreatedAt: '2026-11-24T10:00:00Z',
    feedback: [{ author: 'george', body: 'Semicolons, please.' }],
    createdAt: '2026-11-24T11:00:00Z',
});

test('a work order reads back from the comment it is posted as', () => {
    const comment = workOrderComment(order);

    assert.ok(comment.startsWith(WORK_ORDER_MARKER));
    assert.match(comment, /handed over from #12/);
    assert.deepEqual(readWorkOrder(comment), order);
});

test('a work order too large to post as it is goes compressed, and still reads back', () => {
    const big = { ...order, plan_markdown: 'x '.repeat(40_000) };
    const comment = workOrderComment(big);

    assert.ok(comment.length < 65_536);
    assert.doesNotMatch(comment, /```json/);
    assert.deepEqual(readWorkOrder(comment), big);
});

test('anything that is not a work order reads as none', () => {
    assert.equal(readWorkOrder('Looks good to me'), null);
    assert.equal(readWorkOrder(`${WORK_ORDER_MARKER}\n\`\`\`json\nnot json\n\`\`\``), null);
    assert.equal(readWorkOrder(`${WORK_ORDER_MARKER}\n\`\`\`json\n{"version":2}\n\`\`\``), null);
});

test('a work order needs a source', () => {
    assert.throws(() => buildWorkOrder({ task: { title: 'x' } }), /source/);
});
