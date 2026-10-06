// Turns the review.json a reviewing agent wrote into the Github review that is submitted. The
// agent decides what to say; the shape of the review - its order, its headings, its length - is
// decided here, so it is the same on every run.

export const SEVERITIES = ['blocking', 'should', 'nit'];

const LABELS = { blocking: 'Blocking', should: 'Should fix', nit: 'Nit' };

const HEADLINE_MAX = 300;
const TITLE_MAX = 150;

// Only a string or a number is text. Anything else the agent wrote where text belongs - an object,
// a list - reads as missing: turning it into a string can throw, and would print nonsense if not.
function text(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function clip(value, max) {
    const flat = text(value).trim();
    return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

function oneLine(value, max) {
    return clip(text(value).replace(/\s+/g, ' '), max);
}

function refsSuffix(refs) {
    return refs.length ? ` (${refs.join(', ')})` : '';
}

// The agent read text that anybody able to comment wrote, so its output is untrusted input.
// Anything malformed is dropped or normalised and reported, never allowed to fail the review.
export function normaliseReview(raw) {
    const problems = [];
    const review = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

    if (review !== raw) {
        problems.push('review.json is not a JSON object');
    }

    const headline = oneLine(review.headline, HEADLINE_MAX);
    if (!headline) {
        problems.push('no headline');
    }

    if (review.findings !== undefined && !Array.isArray(review.findings)) {
        problems.push('findings is not a list, so none were read');
    }

    const findings = [];
    for (const item of Array.isArray(review.findings) ? review.findings : []) {
        const title = oneLine(item?.title, TITLE_MAX);
        if (!title) {
            problems.push('a finding without a title was dropped');
            continue;
        }

        let severity = item.severity;
        if (!SEVERITIES.includes(severity)) {
            problems.push(`"${title}" has severity "${oneLine(severity, 30)}", treated as "should"`);
            severity = 'should';
        }

        findings.push({
            severity,
            title,
            body: text(item.body).trim(),
            path: typeof item.path === 'string' && item.path ? item.path : null,
            line: Number.isInteger(item.line) ? item.line : null,
            refs: (Array.isArray(item.refs) ? item.refs : []).filter((ref) => typeof ref === 'string' && ref),
        });
    }

    findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

    const qaFocus = (Array.isArray(review.qa_focus) ? review.qa_focus : [])
        .filter((id) => typeof id === 'string' && id);

    return { headline, findings, qaFocus, problems };
}

// `positions` holds `path:line` for every line an inline comment may sit on. A finding that
// cannot be placed is not lost: its body goes into the review body instead.
export function renderReview(raw, { positions = new Set(), maxComments = 30, maxLength = 1500 } = {}) {
    const { headline, findings, qaFocus, problems } = normaliseReview(raw);

    const verdict = findings.some((f) => f.severity === 'blocking') ? 'changes_requested' : 'comment';

    const comments = [];
    for (const finding of findings) {
        const where = `${finding.path}:${finding.line}`;
        finding.inline = Boolean(finding.path && finding.line && positions.has(where) && comments.length < maxComments);

        if (finding.inline) {
            comments.push({
                path: finding.path,
                line: finding.line,
                side: 'RIGHT',
                body: `**${LABELS[finding.severity]}:** ${finding.title}${refsSuffix(finding.refs)}`
                    + (finding.body ? `\n\n${clip(finding.body, maxLength)}` : ''),
            });
        }
    }

    const parts = [`**${headline || 'The reviewing agent gave no headline.'}**`];

    for (const severity of SEVERITIES) {
        const group = findings.filter((f) => f.severity === severity);
        if (!group.length) {
            continue;
        }

        const lines = group.map((f) => {
            const head = `- ${f.title}${refsSuffix(f.refs)}`;
            if (f.inline) {
                return `${head} - \`${f.path}:${f.line}\``;
            }
            const location = f.path ? ` - \`${f.path}${f.line ? ':' + f.line : ''}\`` : '';
            const body = f.body ? '\n\n' + clip(f.body, maxLength).replace(/^/gm, '  ') : '';
            return head + location + body;
        });

        parts.push(`**${LABELS[severity]}**\n\n${lines.join('\n')}`);
    }

    if (qaFocus.length) {
        parts.push(`For a tester to check first: ${qaFocus.join(', ')}.`);
    }

    const unplaced = findings.filter((f) => f.path && !f.inline).length;

    return { verdict, body: parts.join('\n\n'), comments, unplaced, problems };
}
