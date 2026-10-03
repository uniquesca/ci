// Renders the plan JSON a planning agent wrote, for ai-render-plan. Inputs come in as INPUT_*
// variables, outputs go to GITHUB_OUTPUT. A plan it cannot use falls back to the final message
// the agent ended on, which the caller checks the way it always has.
import fs from 'node:fs';
import path from 'node:path';
import { normalisePlan, renderPlan, planData } from '../src/ai-plan.js';

const env = process.env;
const out = path.join(env.RUNNER_TEMP, 'ai-render-plan');
fs.mkdirSync(out, { recursive: true });

const outputs = { rendered: 'false', plan_file: '', data: '', has_qa: 'false' };

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

const raw = readJson(env.INPUT_PLAN_FILE, () => warn(`The agent wrote no ${env.INPUT_PLAN_FILE}`))
    ?? fromMessage(env.INPUT_FALLBACK_FILE);
const previous = normalisePlan(readJson(env.INPUT_PREVIOUS_FILE)).plan;

const { plan, problems } = raw ? normalisePlan(raw, previous) : { plan: null, problems: [] };
problems.forEach(warn);

const file = path.join(out, 'plan.md');

if (plan) {
    fs.writeFileSync(file, renderPlan(plan) + '\n');
    Object.assign(outputs, { rendered: 'true', plan_file: file, data: planData(plan), has_qa: String(plan.qa.length > 0) });
} else if (env.INPUT_FALLBACK_FILE && fs.existsSync(env.INPUT_FALLBACK_FILE)) {
    warn('Posting the final message the agent ended on instead');
    const text = fs.readFileSync(env.INPUT_FALLBACK_FILE, 'utf8');
    fs.writeFileSync(file, text);
    outputs.plan_file = file;
    outputs.has_qa = String(/^## QA acceptance criteria\s*\n\s*(?!None\b)\S/m.test(text));
}

fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
