// Renders the plan JSON a planning agent wrote, for ai-render-plan. Inputs come in as INPUT_*
// variables, outputs go to GITHUB_OUTPUT. A plan it cannot use falls back to the final message
// the agent ended on, which the caller checks the way it always has.
import fs from 'node:fs';
import path from 'node:path';
import { normalisePlan, renderPlan, visiblePart } from '../src/ai-plan.js';
import { withTextStats } from '../src/ai-text.js';

const env = process.env;
const out = path.join(env.RUNNER_TEMP, 'ai-render-plan');
fs.mkdirSync(out, { recursive: true });

const outputs = { rendered: 'false', plan_file: '', has_qa: 'false', cost_line: '' };

function warn(message) {
    console.log(`::warning title=Plan problem::${message}`);
}

function readJson(file, missing) {
    if (!file || !fs.existsSync(file)) {
        missing?.();
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        warn(`${file} is not valid JSON`);
        return null;
    }
}

// An agent refused the write is told to end on the JSON instead, fenced or not
function fromMessage(file) {
    if (!file || !fs.existsSync(file)) {
        return null;
    }
    const text = fs.readFileSync(file, 'utf8').trim();
    const fenced = /^```(?:json)?\s*\n([\s\S]*)\n```$/.exec(text);
    try {
        return JSON.parse(fenced ? fenced[1] : text);
    } catch {
        return null;
    }
}

// Anything that still goes wrong reading the plan falls back to the agent's final message, the
// same as a plan it cannot use
function read(input, previousPlan) {
    try {
        return normalisePlan(input, previousPlan);
    } catch (error) {
        warn(`The plan could not be read: ${error.message}`);
        return { plan: null, problems: [] };
    }
}

const previous = read(readJson(env.INPUT_PREVIOUS_FILE)).plan;

// The file first. When it gives no usable plan - missing, not JSON, or JSON that is not a plan -
// the final message is tried as the plan, since that is where the agent is told to put it when
// writing is refused.
const fromFile = readJson(env.INPUT_PLAN_FILE, () => warn(`The agent wrote no ${env.INPUT_PLAN_FILE}`));
let { plan, problems } = fromFile ? read(fromFile, previous) : { plan: null, problems: [] };
if (!plan) {
    const fromFinal = fromMessage(env.INPUT_FALLBACK_FILE);
    if (fromFinal) {
        problems.forEach(warn);
        ({ plan, problems } = read(fromFinal, previous));
    }
}
problems.forEach(warn);

const file = path.join(out, 'plan.md');

let chars = 0;
if (plan) {
    const rendered = renderPlan(plan);
    fs.writeFileSync(file, rendered + '\n');
    Object.assign(outputs, { rendered: 'true', plan_file: file, has_qa: String(plan.qa.length > 0) });
    chars = visiblePart(rendered).length;
} else if (env.INPUT_FALLBACK_FILE && fs.existsSync(env.INPUT_FALLBACK_FILE)) {
    warn('Posting the final message the agent ended on instead');
    const text = fs.readFileSync(env.INPUT_FALLBACK_FILE, 'utf8');
    fs.writeFileSync(file, text);
    outputs.plan_file = file;
    outputs.has_qa = String(/^## QA acceptance criteria\s*\n\s*(?!None\b)\S/m.test(text));
    chars = text.length;
}
outputs.cost_line = withTextStats(env.INPUT_COST_LINE, { chars, structured: Boolean(plan), problems });

fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
