// Turns the plan a planning agent wrote as JSON into the comment posted on the issue. The agent
// decides what the plan says; the layout, and the bookkeeping of which ids exist, are decided
// here. The markdown keeps the shape every reader of a plan already parses - the `## Steps`
// heading, `**C1**`, the `## QA acceptance criteria` section the pull request copies.

const PREFIX = { risks: /^[RU]\d+$/, steps: /^S\d+$/, qa: /^QA\d+$/, checks: /^C\d+$/ };

export const DATA_PATTERN = /<!-- ai-plan-data:([A-Za-z0-9+/=]+) -->/;

// Only a string or a number is text. Anything else the agent wrote where text belongs - an object,
// a list - reads as missing: turning it into a string can throw, and would print nonsense if not.
function text(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function clip(value, max, problems, what) {
    const trimmed = text(value).trim();
    if (trimmed.length <= max) {
        return trimmed;
    }
    problems.push(`${what} is over ${max} characters and was cut`);
    return trimmed.slice(0, max - 1).trimEnd() + '…';
}

function ids(list) {
    return (Array.isArray(list) ? list : []).filter((id) => typeof id === 'string' && id);
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

    const seen = new Set();
    const section = (name, pick) => (Array.isArray(raw[name]) ? raw[name] : []).map((item) => {
        const id = text(item?.id).trim();
        if (!PREFIX[name].test(id)) {
            problems.push(`"${id}" is not a valid id for ${name}, dropped`);
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
        summary: clip(raw.summary, 1500, problems, 'The summary'),
        revision: clip(raw.revision, 600, problems, 'The revision note'),
        risks: section('risks', (item, id) => ({
            text: clip(item.text, 1000, problems, id),
            ask: clip(item.ask, 500, problems, id),
        })),
        steps: section('steps', (item, id) => ({
            title: clip(text(item.title).replace(/\s+/g, ' '), 150, problems, id),
            detail: clip(item.detail, 2500, problems, id),
            depends_on: ids(item.depends_on),
        })),
        qa: section('qa', (item, id) => ({
            covers: ids(item.covers),
            where: clip(item.where, 300, problems, id),
            do: clip(item.do, 800, problems, id),
            expect: clip(item.expect, 800, problems, id),
        })),
        qa_none: clip(raw.qa_none, 500, problems, 'qa_none'),
        checks: section('checks', (item, id) => ({ text: clip(item.text, 800, problems, id) })),
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
    const reasons = (list) => (Array.isArray(list) ? list : [])
        .filter((item) => typeof item?.id === 'string' && text(item.why).trim())
        .map((item) => [item.id.trim(), text(item.why).trim()]);
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

    return { plan, problems };
}

export function renderPlan(plan) {
    const parts = [];

    parts.push(plan.revision ? `**Revised:** ${plan.revision}\n\n${plan.summary}` : plan.summary);

    if (plan.risks.length) {
        parts.push('## Risks, unknowns and assumptions\n\n' + plan.risks
            .map((r) => `- **${r.id}** ${r.text}${r.ask ? ` **Needs:** ${r.ask}` : ''}`)
            .join('\n'));
    }

    const steps = plan.steps.map((s) => {
        const after = s.depends_on.length ? ` After ${s.depends_on.join(', ')}.` : '';
        const detail = (s.detail + after).trim();
        return `- [ ] **${s.id}** ${s.title}` + (detail ? '\n\n' + detail.replace(/^/gm, '  ') : '');
    });
    if (plan.retired.length) {
        steps.push('Retired: ' + plan.retired.map((r) => `~~${r.id}~~ ${r.why}`).join(', ') + '.');
    }
    parts.push('## Steps\n\n' + steps.join('\n\n'));

    if (plan.qa.length) {
        parts.push('## QA acceptance criteria\n\n' + plan.qa.map((q) => {
            const where = q.where ? `In ${q.where}: ` : '';
            return `- **${q.id}**${idsText(q.covers)} ${where}${q.do} **Expect:** ${q.expect}`;
        }).join('\n'));
    } else if (plan.qa_none) {
        parts.push(`## QA acceptance criteria\n\nNone - ${plan.qa_none}`);
    }

    parts.push('<details>\n<summary>Checks for the implementing agent</summary>\n\n'
        + plan.checks.map((c) => `**${c.id}** ${c.text}`).join('\n\n')
        + '\n\n</details>');

    return parts.join('\n\n');
}

export function planData(plan) {
    return `<!-- ai-plan-data:${Buffer.from(JSON.stringify(plan)).toString('base64')} -->`;
}

export function readPlanData(text) {
    const match = DATA_PATTERN.exec(String(text ?? ''));
    if (!match) {
        return null;
    }
    try {
        return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    } catch {
        return null;
    }
}
