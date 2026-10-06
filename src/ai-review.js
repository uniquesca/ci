// Turns the review.json a reviewing agent wrote into the Github review that is submitted. The
// agent decides what to say; the shape of the review - its order, its headings, its length - is
// decided here, so it is the same on every run.

// Highest first. A `high` finding is what requests changes.
export const SEVERITIES = ['high', 'medium', 'low'];

const LABELS = { high: '🔴 High', medium: '🟠 Medium', low: '🟡 Low' };

// Also accepted as severities, read as the names they map to
const OLD_NAMES = { blocking: 'high', should: 'medium', nit: 'low' };

const HEADLINE_MAX = 300;
const TITLE_MAX = 150;
// Github refuses a review or comment body over 65,536 characters. What is left goes to the marker,
// the footer and the cost line added around this body.
const BODY_MAX = 60000;

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

// References are plan ids like S3 or QA2. Anything longer is not one, and a list longer than this
// is not a reference any more - both would otherwise make a comment Github refuses.
const ID_MAX = 20;
const IDS_MAX = 10;

function idList(value, problems, what) {
    const all = (Array.isArray(value) ? value : []).filter((id) => typeof id === 'string' && id);
    const kept = all.filter((id) => id.length <= ID_MAX).slice(0, IDS_MAX);
    if (kept.length < all.length) {
        problems.push(`${what} had ids over ${ID_MAX} characters or more than ${IDS_MAX} of them, some were left out`);
    }
    return kept;
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

        let severity = typeof item.severity === 'string' && Object.hasOwn(OLD_NAMES, item.severity)
            ? OLD_NAMES[item.severity]
            : item.severity;
        if (!SEVERITIES.includes(severity)) {
            problems.push(`"${title}" has severity "${oneLine(item.severity, 30)}", treated as "medium"`);
            severity = 'medium';
        }

        findings.push({
            severity,
            title,
            body: text(item.body).trim(),
            path: typeof item.path === 'string' && item.path ? item.path : null,
            line: Number.isInteger(item.line) ? item.line : null,
            refs: idList(item.refs, problems, `"${title}"`),
        });
    }

    findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

    const qaFocus = idList(review.qa_focus, problems, 'qa_focus');

    return { headline, findings, qaFocus, problems };
}

// `positions` holds `path:line` for every line an inline comment may sit on. A finding placed
// inline is listed in the body by its title and tracked as a thread; one that cannot be placed
// keeps its text in the body instead. `links` holds the address of each inline comment, in the
// order of `comments` - known only once the review is posted, so the body is rendered again then.
export function renderReview(raw, { positions = new Set(), maxComments = 30, maxLength = 1500, maxBody = BODY_MAX, links = [] } = {}) {
    const { headline, findings, qaFocus, problems } = normaliseReview(raw);

    const verdict = findings.some((f) => f.severity === 'high') ? 'changes_requested' : 'comment';

    const comments = [];
    for (const finding of findings) {
        const where = `${finding.path}:${finding.line}`;
        finding.inline = Boolean(finding.path && finding.line && positions.has(where) && comments.length < maxComments);

        if (finding.inline) {
            finding.link = typeof links[comments.length] === 'string' ? links[comments.length] : '';
            comments.push({
                path: finding.path,
                line: finding.line,
                side: 'RIGHT',
                body: `**${LABELS[finding.severity]}:** ${finding.title}${refsSuffix(finding.refs)}`
                    + (finding.body ? `\n\n${clip(finding.body, maxLength)}` : ''),
            });
        }
    }

    const status = verdict === 'changes_requested'
        ? '### 🔴 Changes requested'
        : findings.length ? '### 🟡 Changes suggested' : '### 🟢 Looks good';

    const counts = SEVERITIES
        .map((severity) => [findings.filter((f) => f.severity === severity).length, severity])
        .filter(([count]) => count)
        .map(([count, severity]) => `${LABELS[severity].split(' ')[0]} ${count} ${severity}`);

    // Each finding in the list, and as its title alone for when the whole review would not fit
    const entries = findings.map((f, index) => {
        const title = f.link ? `[${f.title.replace(/[[\]]/g, '\\$&')}](${f.link})` : f.title;
        const location = f.path ? ` - \`${f.path}${f.line ? ':' + f.line : ''}\`` : '';
        const head = `${index + 1}. **${LABELS[f.severity]}** ${title}${refsSuffix(f.refs)}${location}`;
        const body = !f.inline && f.body ? '\n\n' + clip(f.body, maxLength).replace(/^/gm, '   ') : '';
        return { finding: f, full: head + body, short: head, use: 'full' };
    });

    const build = () => {
        const parts = [status, headline || 'The reviewing agent gave no headline.'];

        if (counts.length) {
            parts.push(`**Findings:** ${counts.join(' · ')}`);
        }

        const lines = entries.filter((e) => e.use !== 'dropped').map((e) => e[e.use]);
        if (lines.length) {
            parts.push(lines.join('\n'));
        }

        const dropped = entries.filter((e) => e.use === 'dropped').length;
        if (dropped) {
            parts.push(`${dropped} more finding(s) did not fit. All of them are in \`review.json\`, in the run's \`ai-context-review\` download.`);
        }

        if (qaFocus.length) {
            parts.push(`For a tester to check first: ${qaFocus.join(', ')}.`);
        }

        return parts.join('\n\n');
    };

    // Too long: the least severe findings lose their text first, from the bottom up, and only
    // then are left out altogether
    let body = build();
    while (body.length > maxBody) {
        const shorten = entries.findLast((e) => e.use === 'full' && e.full !== e.short);
        const drop = entries.findLast((e) => e.use !== 'dropped');
        if (shorten) {
            shorten.use = 'short';
        } else if (drop) {
            drop.use = 'dropped';
        } else {
            break;
        }
        body = build();
    }
    if (entries.some((e) => e.use !== 'full')) {
        problems.push(`the review was over ${maxBody} characters, so some findings were cut short or left out`);
    }

    const unplaced = findings.filter((f) => f.path && !f.inline).length;

    return { verdict, body, comments, unplaced, problems };
}
