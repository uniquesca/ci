import test from 'node:test';
import assert from 'node:assert/strict';
import { bannedPhrases, knownIds, planIds, withTextStats } from '../src/ai-text.js';

test('banned phrases are found anywhere in an object, once each', () => {
    const found = bannedPhrases({ a: 'Let me explain.', b: [{ c: 'A non-blocking nit. let me add' }], d: 3 });

    assert.deepEqual(found, ['non-blocking', 'Let me']);
    assert.deepEqual(bannedPhrases('I read `.ai-plan/plan.json` first'), ['I read', '.ai-plan/']);
    assert.deepEqual(bannedPhrases('The minor version just moved. Ireland read it.'), []);
});

test('references to ids the plan does not have are dropped, and nothing is checked without a plan', () => {
    const known = planIds({ steps: [{ id: 'S1' }], qa: [{ id: 'QA1' }], retired: [{ id: 'S2' }] });
    const problems = [];

    assert.deepEqual(knownIds(['S1', 'S2', 'QA1', 'S9'], known, problems, 'qa_focus'), ['S1', 'QA1']);
    assert.deepEqual(problems, ['qa_focus cites S2, S9, not in the plan - dropped']);
    assert.equal(planIds(null), null);
    assert.deepEqual(knownIds(['S9'], null, problems, 'x'), ['S9']);
});

test('the cost line gets the length, the layout and the problems by kind', () => {
    const line = '<!-- ai-cost {"v":1,"kind":"review","cost_usd":1.5} -->';
    const problems = [
        'uses "let me", which the style guide rules out',
        'qa_focus cites S9, not in the plan - dropped',
        'S1 is over 150 characters and was cut',
        'no headline',
    ];

    assert.equal(withTextStats(line, { chars: 812, structured: true, problems }),
        '<!-- ai-cost {"v":1,"kind":"review","cost_usd":1.5,"text_chars":812,"structured":true,'
        + '"text_problems":{"phrase":1,"id":1,"length":1,"shape":1}} -->');
    assert.equal(withTextStats('', { chars: 1, structured: false }), '');
    assert.equal(withTextStats(undefined, { chars: 1, structured: false }), '');
    assert.equal(withTextStats('<!-- ai-cost {broken -->', { chars: 1, structured: false }), '<!-- ai-cost {broken -->');
});
