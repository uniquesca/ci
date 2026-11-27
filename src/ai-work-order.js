// The work order: everything the coding agent works from, in one object. It is built once, where
// the work is handed over from wherever it was asked for, and posted on the pull request. Every
// round after that reads it from there, so the agent and its rounds never go back to the source.
import zlib from 'node:zlib';

export const WORK_ORDER_MARKER = '<!-- ai-work-order -->';

// A comment holds 65,536 characters. Above this the JSON goes compressed, which a plan of any
// realistic size fits in.
const PLAIN_LIMIT = 55_000;
const DATA_LINE = /^<!-- ai-work-order-data ([A-Za-z0-9+/=]+) -->$/m;
const FENCED = /```json\n([\s\S]*?)\n```/;

export function buildWorkOrder({ source, task, plan, planMarkdown, planUrl, planBase, planCreatedAt, feedback, createdAt }) {
    if (!source?.kind) {
        throw new Error('A work order needs a source');
    }
    return {
        version: 1,
        source,
        task: { title: task?.title ?? '', body: task?.body ?? '', ...(task?.parent || task?.linked?.length ? { parent: task.parent ?? null, linked: task.linked ?? [] } : {}) },
        plan: plan ?? null,
        plan_markdown: planMarkdown ?? '',
        plan_url: planUrl ?? '',
        plan_base: planBase ?? '',
        plan_created_at: planCreatedAt ?? '',
        feedback_on_plan: feedback ?? [],
        created_at: createdAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
}

export function workOrderComment(order) {
    const json = JSON.stringify(order, null, 2);
    const head = [
        WORK_ORDER_MARKER,
        '',
        `What the coding agent works from on this pull request, handed over from ${sourceText(order.source)}. `
            + 'Every round reads the newest of these. Run the command there again to hand over a revised plan.',
        '',
    ];
    if (json.length <= PLAIN_LIMIT) {
        return [...head, '<details>', '<summary>Work order</summary>', '', '```json', json, '```', '', '</details>', ''].join('\n');
    }
    const data = zlib.gzipSync(JSON.stringify(order)).toString('base64');
    return [...head, `<!-- ai-work-order-data ${data} -->`, ''].join('\n');
}

export function readWorkOrder(body) {
    const text = String(body ?? '');
    if (!text.startsWith(WORK_ORDER_MARKER)) {
        return null;
    }
    try {
        const data = DATA_LINE.exec(text);
        if (data) {
            return check(JSON.parse(zlib.gunzipSync(Buffer.from(data[1], 'base64')).toString('utf8')));
        }
        const fenced = FENCED.exec(text);
        return fenced ? check(JSON.parse(fenced[1])) : null;
    } catch {
        return null;
    }
}

function check(order) {
    return order && order.version === 1 && order.source?.kind ? order : null;
}

function sourceText(source) {
    if (source.kind === 'issue') {
        return `#${source.number}`;
    }
    if (source.kind === 'clickup') {
        return `[ClickUp ${source.display_id || source.id}](${source.url})`;
    }
    return source.url ? `[${source.kind} ${source.id ?? ''}](${source.url})`.replace(' ]', ']') : source.kind;
}
