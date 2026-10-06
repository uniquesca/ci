// Turns the report.json an implementing agent wrote into what is posted: the body of the pull
// request on the first run, the round comment after that, and the status block at the top of the
// pull request that every run rewrites. The agent decides what to say; the layout is decided here.

export const STATUS_START = '<!-- ai-status -->';
export const STATUS_END = '<!-- /ai-status -->';

const RESULTS = { pass: '✅ pass', fail: '❌ fail', not_run: '⏭️ not run' };
const MAX_ITEMS = 40;
// Github refuses a body over 65,536 characters, and the pull request description carries the
// report twice - as text, and as the hidden data in the status block, which base64 makes a third
// bigger - next to whatever the workflow adds. Measured on the report's own JSON.
const REPORT_MAX = 20000;
// What goes first when the report is too long: the check results, and the questions for a person
// last of all
const LEAVE_OUT_ORDER = ['verification', 'done', 'not_done', 'decisions'];

// Only a string or a number is text. Anything else the agent wrote where text belongs - an object,
// a list - reads as missing: turning it into a string can throw, and would print nonsense if not.
function clip(value, max) {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

function refs(item) {
    return (Array.isArray(item?.refs) ? item.refs : []).filter((ref) => typeof ref === 'string' && ref);
}

function refsText(list) {
    return list.length ? ` (${list.join(', ')})` : '';
}

function cell(text) {
    return text.replace(/\|/g, '\\|');
}

function list(raw, problems, name, pick) {
    if (raw !== undefined && !Array.isArray(raw)) {
        problems.push(`\`${name}\` is not a list`);
        return [];
    }
    const items = (raw ?? []).map(pick).filter(Boolean);
    if (items.length > MAX_ITEMS) {
        problems.push(`\`${name}\` has ${items.length} items, only the first ${MAX_ITEMS} are shown`);
    }
    return items.slice(0, MAX_ITEMS);
}

// The agent read text anybody able to comment wrote, so its output is untrusted input. Anything
// malformed is dropped or normalised and reported, never allowed to fail the run.
export function normaliseReport(raw) {
    const problems = [];
    const report = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    if (!report) {
        return { report: null, problems: ['report.json is not a JSON object'] };
    }

    const headline = clip(report.headline, 300);
    if (!headline) {
        problems.push('no headline');
    }

    const done = list(report.done, problems, 'done', (item) => {
        const what = clip(item?.what, 300);
        return what && { what, refs: refs(item) };
    });

    const notDone = list(report.not_done, problems, 'not_done', (item) => {
        const what = clip(item?.what, 300);
        return what && { what, why: clip(item.why, 400), refs: refs(item) };
    });

    const verification = list(report.verification, problems, 'verification', (item) => {
        const command = clip(item?.command, 150);
        if (!command) {
            return null;
        }
        // An own key, so "toString" and the like are not mistaken for a result
        const result = typeof item.result === 'string' && Object.hasOwn(RESULTS, item.result)
            ? item.result
            : 'not_run';
        if (result !== item.result) {
            problems.push(`\`${command}\` has result "${clip(item.result, 30)}", shown as not run`);
        }
        return { command, result, note: clip(item.note, 200) };
    });

    const decisions = list(report.decisions, problems, 'decisions', (item) => {
        const ask = clip(item?.ask, 400);
        return ask && { ask, refs: refs(item) };
    });

    const result = { headline, done, not_done: notDone, verification, decisions, left_out: 0 };
    while (JSON.stringify(result).length > REPORT_MAX) {
        const name = LEAVE_OUT_ORDER.find((list) => result[list].length);
        if (!name) {
            break;
        }
        result[name].pop();
        result.left_out++;
    }
    if (result.left_out) {
        problems.push(`the report was over ${REPORT_MAX} characters, so ${result.left_out} item(s) were left out`);
    }

    return { report: result, problems };
}

// Under the status block, the headline and the open decisions are already said above it.
export function renderReport(report, { underStatus = false } = {}) {
    const parts = [];

    if (!underStatus && report.headline) {
        parts.push(`**${report.headline}**`);
    }

    if (report.done.length) {
        parts.push('**Done**\n\n' + report.done.map((d) => `- ${d.what}${refsText(d.refs)}`).join('\n'));
    }

    if (report.not_done.length) {
        parts.push('**Not done**\n\n' + report.not_done
            .map((n) => `- ${n.what}${refsText(n.refs)}${n.why ? ` - ${n.why}` : ''}`)
            .join('\n'));
    }

    if (report.verification.length) {
        parts.push('**Verified**\n\n| Check | Result | |\n|---|---|---|\n' + report.verification
            .map((v) => `| \`${cell(v.command)}\` | ${RESULTS[v.result]} | ${cell(v.note)} |`)
            .join('\n'));
    }

    if (!underStatus && report.decisions.length) {
        parts.push('**Needs a decision**\n\n' + report.decisions.map((d) => `- ${d.ask}${refsText(d.refs)}`).join('\n'));
    }

    if (report.left_out) {
        parts.push(`${report.left_out} more item(s) did not fit. All of them are in \`report.json\`, in the run's \`ai-context-implement\` download.`);
    }

    return parts.join('\n\n');
}

// The block at the top of the pull request. It carries the report itself as hidden data, so the
// next round and the reviewer are handed what this run said without parsing prose back.
export function renderStatus(report, label) {
    const lines = [STATUS_START, `> **${label}:** ${report.headline || 'no headline given.'}`];

    if (report.decisions.length) {
        lines.push('>', '> Needs a decision:');
        lines.push(...report.decisions.map((d) => `> - ${d.ask}${refsText(d.refs)}`));
    }

    const data = Buffer.from(JSON.stringify(report)).toString('base64');
    lines.push(`<!-- ai-report:${data} -->`, STATUS_END);

    return lines.join('\n');
}

export function readStatus(body) {
    const match = /<!-- ai-report:([A-Za-z0-9+/=]+) -->/.exec(String(body ?? ''));
    if (!match) {
        return null;
    }
    try {
        return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

// Replaces the status block in a pull request body, or puts one at the top if there is none.
export function replaceStatus(body, status) {
    const text = String(body ?? '');
    const start = text.indexOf(STATUS_START);
    const end = text.indexOf(STATUS_END, start);

    if (start === -1 || end === -1) {
        return `${status}\n\n${text}`;
    }
    return text.slice(0, start) + status + text.slice(end + STATUS_END.length);
}
