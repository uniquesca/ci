import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_SCHEMA, generatePlan, renderPlanMarkdown } from '../src/ai-plan.js';

const SAMPLE_PLAN = {
    task: 'Add a healthcheck endpoint to the API',
    summary: 'Expose a lightweight /health route returning service status.',
    steps: [
        {
            id: 1,
            title: 'Add the route handler',
            details: 'Create a handler that returns 200 with a JSON status body.',
            files: ['src/routes/health.js'],
            depends_on: []
        },
        {
            id: 2,
            title: 'Register the route',
            details: 'Wire the handler into the router.',
            files: ['src/router.js'],
            depends_on: [1]
        }
    ],
    risks: ['The router registration order may matter.'],
    verification: ['curl /health returns 200 with a JSON body.']
};

test('renderPlanMarkdown renders task, summary, steps, risks and verification', () => {
    const md = renderPlanMarkdown(SAMPLE_PLAN);

    assert.match(md, /^# Implementation plan/);
    assert.match(md, /\*\*Task:\*\* Add a healthcheck endpoint to the API/);
    assert.match(md, /Expose a lightweight \/health route/);

    // Steps rendered as a numbered list with details, files and deps
    assert.match(md, /1\. \*\*Add the route handler\*\*/);
    assert.match(md, /2\. \*\*Register the route\*\*/);
    assert.match(md, /- Files: src\/routes\/health\.js/);
    assert.match(md, /- Depends on: #1/);

    // Sections
    assert.match(md, /## Risks & assumptions/);
    assert.match(md, /- The router registration order may matter\./);
    assert.match(md, /## Verification/);
    assert.match(md, /- curl \/health returns 200 with a JSON body\./);
});

test('renderPlanMarkdown omits empty optional sections', () => {
    const md = renderPlanMarkdown({
        task: 'Minimal task',
        summary: 'Just do it.',
        steps: [
            { id: 1, title: 'Do it', details: 'The one step.', files: [], depends_on: [] }
        ],
        risks: [],
        verification: []
    });

    assert.doesNotMatch(md, /## Risks & assumptions/);
    assert.doesNotMatch(md, /## Verification/);
    assert.doesNotMatch(md, /- Files:/);
    assert.doesNotMatch(md, /- Depends on:/);
    assert.match(md, /## Steps/);
});

test('renderPlanMarkdown always ends with a single trailing newline', () => {
    const md = renderPlanMarkdown(SAMPLE_PLAN);
    assert.ok(md.endsWith('\n'));
    assert.ok(!md.endsWith('\n\n'));
});

test('generatePlan requires a task', async () => {
    await assert.rejects(
        () => generatePlan('   ', { apiKey: 'test-key' }),
        /task is required/
    );
});

test('generatePlan requires an explicit apiKey and never reads the environment', async () => {
    process.env.ANTHROPIC_API_KEY = 'key-from-the-environment';

    try {
        await assert.rejects(
            () => generatePlan('Add a healthcheck endpoint'),
            /apiKey is required/
        );
    } finally {
        delete process.env.ANTHROPIC_API_KEY;
    }
});

test('PLAN_SCHEMA has the expected top-level shape', () => {
    assert.equal(PLAN_SCHEMA.type, 'object');
    assert.equal(PLAN_SCHEMA.additionalProperties, false);
    assert.deepEqual(
        PLAN_SCHEMA.required,
        ['task', 'summary', 'steps', 'risks', 'verification']
    );

    // Each step object must constrain its shape for structured outputs
    const step = PLAN_SCHEMA.properties.steps.items;
    assert.equal(step.type, 'object');
    assert.equal(step.additionalProperties, false);
    assert.deepEqual(step.required, ['id', 'title', 'details', 'files', 'depends_on']);
});
