import Anthropic from '@anthropic-ai/sdk';

/**
 * Model used to generate plans. Anthropic's most capable Opus-tier model.
 *
 * @type {string}
 */
export const PLAN_MODEL = 'claude-opus-4-8';

/**
 * JSON schema for the machine-friendly plan. Constrains the model's output via
 * structured outputs so the result is always valid JSON with a known shape,
 * ready to hand to a downstream AI implementor agent.
 *
 * Note: structured outputs do not support min/maxLength, numeric constraints,
 * or recursion — every object sets `additionalProperties: false` and `required`.
 *
 * @type {object}
 */
export const PLAN_SCHEMA = {
    type: 'object',
    properties: {
        task: {
            type: 'string',
            description: 'Restatement of the task this plan addresses.'
        },
        summary: {
            type: 'string',
            description: 'A short human-readable overview of the approach.'
        },
        steps: {
            type: 'array',
            description: 'Ordered implementation steps.',
            items: {
                type: 'object',
                properties: {
                    id: {
                        type: 'integer',
                        description: 'Stable identifier for this step, starting at 1.'
                    },
                    title: {
                        type: 'string',
                        description: 'Short imperative title of the step.'
                    },
                    details: {
                        type: 'string',
                        description: 'What to do in this step and why.'
                    },
                    files: {
                        type: 'array',
                        description: 'Files likely to be created or modified in this step.',
                        items: { type: 'string' }
                    },
                    depends_on: {
                        type: 'array',
                        description: 'Ids of steps that must be completed first.',
                        items: { type: 'integer' }
                    }
                },
                required: ['id', 'title', 'details', 'files', 'depends_on'],
                additionalProperties: false
            }
        },
        risks: {
            type: 'array',
            description: 'Risks, unknowns, or assumptions worth flagging.',
            items: { type: 'string' }
        },
        verification: {
            type: 'array',
            description: 'Concrete checks that prove the task is complete.',
            items: { type: 'string' }
        }
    },
    required: ['task', 'summary', 'steps', 'risks', 'verification'],
    additionalProperties: false
};

const SYSTEM_PROMPT = [
    'You are a senior software architect acting as a planning agent.',
    'Given a task, produce a concrete, actionable implementation plan.',
    'The plan is consumed in two ways: a human reviews the summary, and a',
    'separate AI implementor agent executes the structured steps — so each',
    'step must be self-contained, unambiguous, and ordered, with explicit',
    'dependencies and the files it is expected to touch.',
    'Do not write the implementation yourself; plan it.'
].join(' ');

/**
 * Renders the machine-friendly plan as a human-readable markdown document.
 * Pure function — no I/O — so it can be unit-tested without a network call.
 *
 * @param {object} plan Plan object matching PLAN_SCHEMA.
 * @returns {string} Markdown representation of the plan.
 */
export function renderPlanMarkdown(plan) {
    const lines = ['# Implementation plan', ''];

    if (plan.task) {
        lines.push(`**Task:** ${plan.task}`, '');
    }

    if (plan.summary) {
        lines.push(plan.summary, '');
    }

    lines.push('## Steps', '');
    for (const step of plan.steps || []) {
        lines.push(`${step.id}. **${step.title}**`);
        if (step.details) {
            lines.push(`   ${step.details}`);
        }
        if (step.files && step.files.length > 0) {
            lines.push(`   - Files: ${step.files.join(', ')}`);
        }
        if (step.depends_on && step.depends_on.length > 0) {
            lines.push(`   - Depends on: ${step.depends_on.map((id) => `#${id}`).join(', ')}`);
        }
        lines.push('');
    }

    if (plan.risks && plan.risks.length > 0) {
        lines.push('## Risks & assumptions', '');
        for (const risk of plan.risks) {
            lines.push(`- ${risk}`);
        }
        lines.push('');
    }

    if (plan.verification && plan.verification.length > 0) {
        lines.push('## Verification', '');
        for (const check of plan.verification) {
            lines.push(`- ${check}`);
        }
        lines.push('');
    }

    return lines.join('\n').trim() + '\n';
}

/**
 * Asks the AI agent to turn a task into an implementation plan.
 *
 * Uses a single structured Messages API call (streamed to avoid HTTP timeouts
 * on longer plans). The API key must be passed in explicitly — it is never read
 * from the environment, so the caller decides where the credential comes from.
 *
 * @param {string} task The task to plan for.
 * @param {{ apiKey: string, model?: string }} options
 * @returns {Promise<{ machine: object, humanReadable: string }>}
 * @throws {Error} If the task is empty, the API key is missing, or the response
 *                 is not valid plan JSON.
 */
export async function generatePlan(task, { apiKey, model = PLAN_MODEL } = {}) {
    if (!task || !task.trim()) {
        throw new Error('task is required');
    }

    if (!apiKey) {
        throw new Error('apiKey is required');
    }

    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream({
        model,
        max_tokens: 32000,
        thinking: { type: 'adaptive' },
        output_config: {
            effort: 'high',
            format: { type: 'json_schema', schema: PLAN_SCHEMA }
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: task }]
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
        throw new Error('AI agent declined to produce a plan for this task');
    }

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock) {
        throw new Error('AI agent returned no plan content');
    }

    let machine;
    try {
        machine = JSON.parse(textBlock.text);
    } catch (error) {
        throw new Error(`AI agent returned invalid plan JSON: ${error.message}`);
    }

    return { machine, humanReadable: renderPlanMarkdown(machine) };
}
