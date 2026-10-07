// Turns the plan a planning agent wrote as JSON into the comment posted on the issue. The agent
// decides what the plan says; the layout, and the bookkeeping of which ids exist, are decided
// here. A person sees the summary, what needs their decision, the step titles and the QA criteria
// the pull request copies. The whole plan is folded underneath as JSON - the one copy the agents
// work from, and what the next revision starts from.

import { phraseProblems } from './ai-text.js';

const PREFIX = { risks: /^[RU]\d{1,4}$/, steps: /^S\d{1,4}$/, qa: /^QA\d{1,4}$/, checks: /^C\d{1,4}$/ };

// Where the plan's JSON starts in the comment. Safe as a marker because the agent's text cannot
// contain `<!--` - see `visible`.
export const JSON_MARKER = '<!-- ai-plan-json -->';

// The other way a plan carries its JSON: hidden, base64-encoded
const OLD_DATA = /<!-- ai-plan-data:([A-Za-z0-9+/=]+) -->/;

// Github refuses a comment over 65,536 characters, and the workflow checks the comment in bytes, so
// text that is not English counts at what it costs. What is left goes to the lines the workflow
// adds around the plan.
const PLAN_MAX = 60000;

// When a plan is too long, its text is cut to these lengths a step at a time, the least needed
// first. Nothing is dropped: every step, check and QA item is something the implementing agent
// or a tester works from. `null` is the plan's own fields.
const SHORTER = [
    ['risks', ['text'], 400, 'risks'],
    ['qa', ['do', 'expect'], 400, 'QA steps'],
    ['steps', ['detail'], 1500, 'step details'],
    ['risks', ['text', 'ask'], 200, 'risks'],
    ['qa', ['do', 'expect'], 200, 'QA steps'],
    ['steps', ['detail'], 800, 'step details'],
    ['steps', ['detail'], 400, 'step details'],
    ['steps', ['detail'], 200, 'step details'],
    ['checks', ['text'], 300, 'checks'],
    ['retired', ['why'], 60, 'reasons for retiring'],
    [null, ['summary'], 500, 'summary'],
    ['qa', ['where', 'do', 'expect'], 120, 'QA steps'],
    ['risks', ['text', 'ask'], 120, 'risks'],
    ['steps', ['title'], 80, 'step titles'],
    ['steps', ['scope'], 100, 'step scopes'],
    ['checks', ['text'], 150, 'checks'],
];

function shorten(value, max) {
    return value.length > max ? value.slice(0, max - 1).trimEnd() + '…' : value;
}

// Only a string or a number is text. Anything else the agent wrote where text belongs - an object,
// a list - reads as missing: turning it into a string can throw, and would print nonsense if not.
function text(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

// `<!--` in the agent's text could open a hidden comment - and one that looks like the plan's
// data, sitting above the real one, would be read back in its place
function visible(value) {
    return text(value).replace(/<!--/g, '&lt;!--');
}

// A field laid out on one line of the plan: a line break in it would start a line of its own, and
// `---` or a heading there ends or fakes the QA section `ai-qa-criteria` copies
function line(value) {
    return visible(value).replace(/\s+/g, ' ');
}

// A field that keeps its paragraphs: a line that would end or fake a section is shown as text
function block(value) {
    return visible(value).replace(/^([ \t]*)(#|-{3,}|\*{3,}|_{3,}|<\/?details)/gm, '$1\\$2');
}

function clip(value, max, problems, what) {
    const trimmed = visible(value).trim();
    if (trimmed.length <= max) {
        return trimmed;
    }
    problems.push(`${what} is over ${max} characters and was cut`);
    return trimmed.slice(0, max - 1).trimEnd() + '…';
}

// Each id once, and only something short enough to be one
function ids(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter((id) => typeof id === 'string' && id && id.length <= 20))];
}

function idsText(list) {
    return list.length ? ` (${list.join(', ')})` : '';
}

// Every id the plan ever used: live ones, and the retired ones it carries. The previous plan is
// read back from the comment it was posted in, so it is checked rather than trusted.
export function allIds(plan) {
    if (!plan || typeof plan !== 'object') {
        return [];
    }
    return ['risks', 'steps', 'qa', 'checks', 'retired']
        .flatMap((name) => (Array.isArray(plan[name]) ? plan[name] : []))
        .map((item) => item?.id)
        .filter((id) => typeof id === 'string' && id);
}

// The agent read text anybody able to comment wrote, so its output is untrusted input. Small
// faults are fixed and reported; a plan without steps or checks is refused, because those are
// what the implementing agent works from.
export function normalisePlan(raw, previous = null) {
    const problems = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { plan: null, problems: ['the plan is not a JSON object'] };
    }

    // A retired id stays retired: an old comment citing it has to keep meaning what it meant
    const retiredBefore = new Set(allIds({ retired: previous?.retired }));

    const seen = new Set();
    const section = (name, pick) => (Array.isArray(raw[name]) ? raw[name] : []).map((item) => {
        const id = text(item?.id).trim();
        if (!PREFIX[name].test(id)) {
            problems.push(`"${shorten(id, 30)}" is not a valid id for ${name}, dropped`);
            return null;
        }
        if (retiredBefore.has(id)) {
            problems.push(`${id} was retired by an earlier plan and cannot be used again, dropped`);
            return null;
        }
        if (seen.has(id)) {
            problems.push(`${id} is used twice, the second was dropped`);
            return null;
        }
        seen.add(id);
        return { id, ...pick(item, id) };
    }).filter(Boolean);

    const plan = {
        summary: clip(block(raw.summary), 1500, problems, 'The summary'),
        revision: clip(line(raw.revision), 600, problems, 'The revision note'),
        risks: section('risks', (item, id) => ({
            text: clip(line(item.text), 1000, problems, id),
            ask: clip(line(item.ask), 500, problems, id),
        })),
        steps: section('steps', (item, id) => ({
            title: clip(line(item.title), 150, problems, id),
            scope: clip(line(item.scope), 200, problems, id),
            detail: clip(block(item.detail), 2500, problems, id),
            depends_on: ids(item.depends_on),
        })),
        qa: section('qa', (item, id) => ({
            covers: ids(item.covers),
            where: clip(line(item.where), 300, problems, id),
            do: clip(line(item.do), 800, problems, id),
            expect: clip(line(item.expect), 800, problems, id),
        })),
        qa_none: clip(line(raw.qa_none), 500, problems, 'qa_none'),
        checks: section('checks', (item, id) => ({ text: clip(block(item.text), 800, problems, id) })),
        retired: [],
    };

    const stepIds = new Set(plan.steps.map((step) => step.id));
    const knownSteps = (list, owner, verb) => list.filter((id) => {
        if (!stepIds.has(id)) {
            problems.push(`${owner} ${verb} ${id}, which is not a step - dropped`);
        }
        return stepIds.has(id);
    });
    for (const step of plan.steps) {
        step.depends_on = knownSteps(step.depends_on, step.id, 'depends on');
    }
    for (const qa of plan.qa) {
        qa.covers = knownSteps(qa.covers, qa.id, 'covers');
    }

    // Retired ids are kept for good, so the next revision knows which numbers are used and an
    // old comment citing one still reads. Whatever the previous plan had that this one neither
    // uses nor retires is retired here rather than forgotten.
    const validId = (id) => Object.values(PREFIX).some((pattern) => pattern.test(id));
    const reasons = (list) => (Array.isArray(list) ? list : [])
        .filter((item) => {
            if (typeof item?.id !== 'string' || !text(item.why).trim()) {
                return false;
            }
            if (!validId(item.id.trim())) {
                problems.push(`"${shorten(item.id.trim(), 30)}" is not a valid id to retire, dropped`);
                return false;
            }
            return true;
        })
        .map((item) => [item.id.trim(), shorten(line(item.why).trim(), 300)]);
    const why = new Map([...reasons(previous?.retired), ...reasons(raw.retired)]);

    const candidates = new Set([...allIds(previous), ...why.keys()]);
    for (const id of candidates) {
        if (seen.has(id)) {
            continue;
        }
        if (!why.has(id)) {
            problems.push(`${id} was in the previous plan and is neither used nor retired - retired it`);
        }
        plan.retired.push({ id, why: why.get(id) || 'dropped' });
        seen.add(id);
    }

    if (!plan.steps.length || !plan.checks.length) {
        return { plan: null, problems: [...problems, 'the plan has no steps or no checks'] };
    }
    if (!plan.summary) {
        problems.push('no summary');
    }
    problems.push(...phraseProblems(plan));

    const size = () => Buffer.byteLength(renderPlan(plan));
    for (const [name, fields, max, what] of SHORTER) {
        if (size() <= PLAN_MAX) {
            break;
        }
        for (const item of name ? plan[name] : [plan]) {
            for (const field of fields) {
                item[field] = shorten(item[field], max);
            }
        }
        problems.push(`the plan was over ${PLAN_MAX} bytes, so its ${what} were cut to ${max} characters`);
    }
    if (size() > PLAN_MAX) {
        problems.push(`the plan is still over ${PLAN_MAX} bytes with every text cut short, and may be too long to post`);
    }

    return { plan, problems };
}

// The part of a rendered plan a person reads, above the folded JSON
export function visiblePart(rendered) {
    const end = rendered.indexOf(JSON_MARKER);
    return (end === -1 ? rendered : rendered.slice(0, end)).trimEnd();
}

export function renderPlan(plan) {
    const parts = [plan.revision ? `**Revised:** ${plan.revision}\n\n${plan.summary}` : plan.summary];

    if (plan.risks.length) {
        parts.push('### Risks, unknowns and assumptions\n\n' + plan.risks
            .map((r) => `- **${r.id}** ${r.text}${r.ask ? ` **Needs your decision:** ${r.ask}` : ''}`)
            .join('\n'));
    }

    // The scope goes on a line of its own under the title, inside the same list item
    parts.push('### Steps\n\n' + plan.steps
        .map((s) => `- [ ] **${s.id}** ${s.title}${s.scope ? `\n  ${s.scope}` : ''}`)
        .join('\n'));

    // A plan with nothing for a tester says why in its JSON, and shows no section at all
    if (plan.qa.length) {
        parts.push('### QA acceptance criteria\n\n' + plan.qa.map((q) => {
            const where = q.where ? `In ${q.where}: ` : '';
            return `- **${q.id}**${idsText(q.covers)} ${where}${q.do} **Expect:** ${q.expect}`;
        }).join('\n'));
    }

    // A JSON string holds no raw line break, so no line of it can close the fence early
    parts.push(`${JSON_MARKER}\n<details>\n<summary>Full plan for the implementing agent</summary>\n\n`
        + '```json\n' + JSON.stringify(plan, null, 2) + '\n```\n\n</details>');

    return parts.join('\n\n');
}

// The plan's JSON out of a posted comment, folded or hidden
export function readPlanData(text) {
    const body = String(text ?? '');
    const start = body.indexOf(JSON_MARKER);
    const folded = start === -1 ? null : /```json\n([\s\S]*?)\n```/.exec(body.slice(start));
    const old = OLD_DATA.exec(body);
    try {
        if (folded) {
            return JSON.parse(folded[1]);
        }
        return old ? JSON.parse(Buffer.from(old[1], 'base64').toString('utf8')) : null;
    } catch {
        return null;
    }
}
