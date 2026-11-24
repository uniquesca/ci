// Builds, reads and lays out the work order for ai-work-order. Inputs come in as INPUT_*
// variables, outputs go to GITHUB_OUTPUT. The Github calls are the action's own, in bash.
import fs from 'node:fs';
import path from 'node:path';
import { buildWorkOrder, readWorkOrder, workOrderComment } from '../src/ai-work-order.js';

const env = process.env;
const dir = env.INPUT_DIRECTORY || '.ai-plan';
const orderFile = path.join(dir, 'work-order.json');

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
}

function readText(file) {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

// What every mode hands back, so a caller reads the same outputs whichever way the order came
function outputs(order, found) {
    const planFile = path.join(dir, 'plan.md');
    return {
        found: String(found),
        file: found ? orderFile : '',
        source: order ? JSON.stringify(order.source) : '',
        title: (order?.task.title ?? '').replace(/[\r\n]/g, ''),
        has_plan: String(Boolean(order?.plan_markdown)),
        plan_file: order?.plan_markdown ? planFile : '',
        plan_url: order?.plan_url ?? '',
        plan_base: order?.plan_base ?? '',
        plan_created_at: order?.plan_created_at ?? '',
    };
}

// The files the steps after the agent read the plan from - the report and the QA criteria
function writePlanFiles(order) {
    if (order.plan) {
        fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(order.plan, null, 2) + '\n');
    }
    if (order.plan_markdown) {
        fs.writeFileSync(path.join(dir, 'plan.md'), order.plan_markdown);
    }
}

let result;
switch (env.INPUT_MODE) {
    case 'build': {
        // From what ai-stage-issue staged. The issue and its comments go into the order and are
        // taken out of the working tree, so the agent reads them in one place only.
        const issue = readJson(path.join(dir, 'issue.json'), {});
        const order = buildWorkOrder({
            source: JSON.parse(env.INPUT_SOURCE),
            task: { title: issue.title, body: issue.body },
            plan: readJson(path.join(dir, 'plan.json'), null),
            planMarkdown: readText(path.join(dir, 'plan.md')),
            planUrl: env.INPUT_PLAN_URL,
            planBase: env.INPUT_PLAN_BASE,
            planCreatedAt: env.INPUT_PLAN_CREATED_AT,
            feedback: readJson(path.join(dir, 'comments.json'), []),
        });
        fs.writeFileSync(orderFile, JSON.stringify(order, null, 2) + '\n');
        fs.rmSync(path.join(dir, 'issue.json'), { force: true });
        fs.rmSync(path.join(dir, 'comments.json'), { force: true });
        result = outputs(order, true);
        break;
    }
    case 'read': {
        const order = readWorkOrder(readText(env.INPUT_COMMENT_FILE || ''));
        if (order) {
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(orderFile, JSON.stringify(order, null, 2) + '\n');
            writePlanFiles(order);
        }
        result = outputs(order, Boolean(order));
        break;
    }
    case 'comment': {
        const file = path.join(env.RUNNER_TEMP, 'ai-work-order-comment.md');
        fs.writeFileSync(file, workOrderComment(readJson(orderFile, null)));
        result = { comment_file: file };
        break;
    }
    default:
        throw new Error(`Unknown mode '${env.INPUT_MODE}'`);
}

fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
