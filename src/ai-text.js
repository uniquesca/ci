// Checks shared by everything that posts what an agent wrote: phrases the style guide rules out,
// references to plan ids that do not exist, and what the checks found, recorded in the cost line.

// Kept to what is never right in what a person reads. Words like "just" or "minor" are left out:
// they are fine as often as not, and a check that cries wolf is one nobody reads.
const PHRASES = [
    /\bnon-blocking\b/i,
    /\byou (?:might|may|could) (?:want to )?consider\b/i,
    /\bit (?:might|may) be worth\b/i,
    /\blet me\b/i,
    /\bI (?:have )?(?:read|ran|checked|looked at|reviewed|examined|investigated|explored)\b/,
    /\.ai-(?:plan|review|reports)\//,
];

function strings(value) {
    if (typeof value === 'string') {
        return [value];
    }
    if (value && typeof value === 'object') {
        return Object.values(value).flatMap(strings);
    }
    return [];
}

// Every banned phrase in the text, or in the strings of an object, once each
export function bannedPhrases(value) {
    const text = strings(value).join('\n');
    return [...new Set(PHRASES.map((pattern) => pattern.exec(text)?.[0]).filter(Boolean))];
}

export function phraseProblems(value) {
    return bannedPhrases(value).map((phrase) => `uses "${phrase}", which the style guide rules out`);
}

// The ids a plan has live: what a report or a review may cite. Null when there is no plan to
// check against, which leaves every reference alone.
export function planIds(plan) {
    if (!plan || typeof plan !== 'object') {
        return null;
    }
    return new Set(['risks', 'steps', 'qa', 'checks']
        .flatMap((name) => (Array.isArray(plan[name]) ? plan[name] : []))
        .map((item) => item?.id)
        .filter((id) => typeof id === 'string' && id));
}

export function knownIds(list, known, problems, what) {
    if (!known) {
        return list;
    }
    const unknown = list.filter((id) => !known.has(id));
    if (unknown.length) {
        problems.push(`${what} cites ${unknown.join(', ')}, not in the plan - dropped`);
    }
    return list.filter((id) => known.has(id));
}

// Which check a problem came from, for counting them in the cost line
function kind(problem) {
    if (/style guide/.test(problem)) {
        return 'phrase';
    }
    if (/not in the plan|not a step|not a valid id|retired|used twice|ids over/.test(problem)) {
        return 'id';
    }
    if (/\bcut\b|left out|only the first|over \d+ (?:bytes|characters)/.test(problem)) {
        return 'length';
    }
    return 'shape';
}

// The cost line with what was posted added: its length in characters, whether it was laid out
// from the agent's JSON or is its plain final message, and how many problems each check found.
// Anything that is not a cost line is handed back unchanged.
export function withTextStats(costLine, { chars, structured, problems = [] }) {
    const match = /^<!-- ai-cost (\{.*\}) -->$/.exec(String(costLine ?? '').trim());
    if (!match) {
        return costLine ?? '';
    }
    let cost;
    try {
        cost = JSON.parse(match[1]);
    } catch {
        return costLine;
    }
    const counts = {};
    for (const problem of problems) {
        counts[kind(problem)] = (counts[kind(problem)] ?? 0) + 1;
    }
    Object.assign(cost, { text_chars: chars, structured, text_problems: counts });
    return `<!-- ai-cost ${JSON.stringify(cost)} -->`;
}
