import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisePlan, renderPlan, planData, readPlanData } from '../src/ai-plan.js';

const plan = {
    summary: 'Business hours get their own settings page.',
    risks: [{ id: 'U1', text: 'Whether hours differ per office.', ask: 'Confirm one set per company.' }],
    steps: [
        { id: 'S1', title: 'Add the model', detail: 'In `src/Hours.php`.' },
        { id: 'S2', title: 'Add the page', detail: 'Uses S1.', depends_on: ['S1'] },
    ],
    qa: [{ id: 'QA1', covers: ['S2'], where: 'Company Settings -> Business Hours', do: 'Set Monday to 9-5 and save.', expect: 'Reloading shows 9-5.' }],
    checks: [{ id: 'C1', text: 'Run `composer test`; HoursTest passes.' }],
};

test('a plan renders in the shape its readers parse', () => {
    const { plan: normal, problems } = normalisePlan(plan);
    const text = renderPlan(normal);

    assert.deepEqual(problems, []);
    assert.ok(text.startsWith('Business hours get their own settings page.'));
    const order = ['## Risks', '## Steps', '## QA acceptance criteria', '<details>'].map((s) => text.indexOf(s));
    assert.ok(order.every((pos) => pos >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(text, /- \*\*U1\*\* Whether hours differ per office\. \*\*Needs:\*\* Confirm/);
    assert.match(text, /- \[ \] \*\*S2\*\* Add the page\n\n {2}Uses S1\. After S1\./);
    assert.match(text, /- \*\*QA1\*\* \(S2\) In Company Settings -> Business Hours: Set Monday/);
    assert.match(text, /\*\*C1\*\* Run `composer test`/);
    assert.ok(!text.includes('Retired'));
});

test('a plan with nothing for a tester says so', () => {
    const { plan: normal } = normalisePlan({ ...plan, qa: [], qa_none: 'a refactor with no visible change.' });

    assert.match(renderPlan(normal), /## QA acceptance criteria\n\nNone - a refactor/);
});

test('a plan without steps or checks is refused', () => {
    assert.equal(normalisePlan({ ...plan, steps: [] }).plan, null);
    assert.equal(normalisePlan({ ...plan, checks: [] }).plan, null);
    assert.equal(normalisePlan('text').plan, null);
});

test('ids that are malformed, in the wrong section or used twice are dropped and reported', () => {
    const { plan: normal, problems } = normalisePlan({
        ...plan,
        steps: [...plan.steps, { id: 'S1', title: 'Again' }, { id: 'C9', title: 'Wrong section' }, { id: 'step', title: 'Bad' }],
    });

    assert.deepEqual(normal.steps.map((s) => s.id), ['S1', 'S2']);
    assert.equal(problems.length, 3);
});

test('references to steps that do not exist are dropped', () => {
    const { plan: normal, problems } = normalisePlan({
        ...plan,
        qa: [{ ...plan.qa[0], covers: ['S2', 'S9'] }],
    });

    assert.deepEqual(normal.qa[0].covers, ['S2']);
    assert.equal(problems.length, 1);
});

test('a revision retires what the previous plan had and this one dropped', () => {
    const previous = normalisePlan({ ...plan, steps: [...plan.steps, { id: 'S3', title: 'Old' }, { id: 'S4', title: 'Older' }] }).plan;
    const { plan: revised, problems } = normalisePlan({
        ...plan,
        revision: 'S3 and S4 dropped.',
        retired: [{ id: 'S3', why: 'superseded by S2' }],
    }, previous);

    assert.deepEqual(revised.retired, [{ id: 'S3', why: 'superseded by S2' }, { id: 'S4', why: 'dropped' }]);
    assert.equal(problems.length, 1);
    const text = renderPlan(revised);
    assert.ok(text.startsWith('**Revised:** S3 and S4 dropped.'));
    assert.match(text, /Retired: ~~S3~~ superseded by S2, ~~S4~~ dropped\./);
});

test('retired ids stay retired across revisions', () => {
    const first = normalisePlan({ ...plan, retired: [{ id: 'S7', why: 'merged into S2' }] }).plan;
    const second = normalisePlan(plan, first).plan;

    assert.deepEqual(second.retired, [{ id: 'S7', why: 'merged into S2' }]);
});

test('the plan data reads back from the comment', () => {
    const { plan: normal } = normalisePlan(plan);

    assert.deepEqual(readPlanData(`text\n${planData(normal)}\nmore`), normal);
    assert.equal(readPlanData('no data'), null);
});

test('a value that is not text where text belongs reads as missing, and never throws', () => {
    const notText = { toString: null };
    const result = normalisePlan({
        summary: notText,
        steps: [{ id: notText, title: 'Dropped' }, { id: 'S1', title: notText, detail: 'Kept.' }],
        checks: [{ id: 'C1', text: 'Tests pass.' }],
        retired: [{ id: 'S2', why: notText }],
    });

    assert.deepEqual(result.plan.steps.map((s) => [s.id, s.title, s.detail]), [['S1', '', 'Kept.']]);
    assert.ok(result.problems.includes('"" is not a valid id for steps, dropped'));
    assert.ok(result.problems.includes('no summary'));
});

test('a previous plan read back malformed does not break the next one', () => {
    for (const previous of [{ steps: 'nope' }, { retired: [null, { id: 5 }] }, 'text']) {
        const result = normalisePlan({ summary: 'S.', steps: [{ id: 'S1', title: 'T' }], checks: [{ id: 'C1', text: 'C' }] }, previous);
        assert.deepEqual(result.plan.retired, []);
    }
});

test('a plan too long for Github keeps every item, and cuts the least needed text first', () => {
    const many = (n, make) => Array.from({ length: n }, (_, i) => make(i + 1));
    const result = normalisePlan({
        summary: 'Big.',
        risks: many(10, (i) => ({ id: `R${i}`, text: 'r'.repeat(1000) })),
        steps: many(30, (i) => ({ id: `S${i}`, title: `Step ${i}`, detail: 'd'.repeat(2500) })),
        qa: many(10, (i) => ({ id: `QA${i}`, do: 'q'.repeat(800), expect: 'e'.repeat(800) })),
        checks: [{ id: 'C1', text: 'Tests pass.' }],
    });

    assert.ok(renderPlan(result.plan).length <= 50000);
    assert.equal(result.plan.steps.length, 30);
    assert.equal(result.plan.risks.length, 10);
    assert.equal(result.plan.qa.length, 10);
    assert.ok(result.plan.risks.every((r) => r.text.length <= 400));
    assert.match(result.problems.at(-1), /^the plan was over 50000 characters, so its /);
});

test('ids are short and listed once, and a retired reason is cut, so no giant value gets through', () => {
    const result = normalisePlan({
        summary: 'S.',
        steps: [{ id: 'S1', title: 'A' }, { id: 'S2', title: 'B', depends_on: Array(70000).fill('S1') }, { id: `S${'9'.repeat(70000)}`, title: 'C' }],
        checks: [{ id: 'C1', text: 'C' }],
        retired: [{ id: 'S3', why: 'w'.repeat(70000) }, { id: 'S'.repeat(70000), why: 'x' }],
    });

    assert.deepEqual(result.plan.steps.map((s) => s.id), ['S1', 'S2']);
    assert.deepEqual(result.plan.steps[1].depends_on, ['S1']);
    assert.deepEqual(result.plan.retired.map((r) => [r.id, r.why.length]), [['S3', 300]]);
    assert.ok(renderPlan(result.plan).length < 1000);
});
