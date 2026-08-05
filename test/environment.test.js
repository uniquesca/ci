import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFallbacks, resolveReferences } from '../src/environment.js';

/**
 * Runs a callback with stdout captured, so that @actions/core annotations can be asserted on.
 *
 * @param {() => any} callback
 * @returns {{result: any, output: string}}
 */
function captureOutput(callback) {
    const original = process.stdout.write;
    let output = '';

    process.stdout.write = (chunk) => {
        output += chunk;
        return true;
    };

    try {
        return { result: callback(), output };
    } finally {
        process.stdout.write = original;
    }
}

/**
 * Merges fallbacks and resolves references the same way prepareEnvironment does.
 *
 * @param {Record<string, any>} variables
 * @param {Record<string, any>} fallbacks
 * @returns {Record<string, any>}
 */
function prepare(variables, fallbacks = {}) {
    return resolveReferences(applyFallbacks(variables, fallbacks));
}

test('applyFallbacks only fills in tokens the variables do not define', () => {
    const result = applyFallbacks(
        { 'db.host': '127.0.0.1' },
        { 'db.host': 'localhost', 'db.port': '3306' }
    );

    assert.deepEqual(result, { 'db.host': '127.0.0.1', 'db.port': '3306' });
});

test('applyFallbacks keeps a fallback out when the variable is an empty string', () => {
    const result = applyFallbacks({ 'db.password': '' }, { 'db.password': 'secret' });

    assert.equal(result['db.password'], '');
});

test('deprecated "$name" fallback reference still resolves', () => {
    const { result } = captureOutput(() => prepare(
        { 'db.host': '127.0.0.1' },
        { 'cache.host': '$db.host' }
    ));

    assert.equal(result['cache.host'], '127.0.0.1');
});

test('deprecated "$name" fallback reference emits a deprecation warning', () => {
    const { output } = captureOutput(() => prepare(
        { 'db.host': '127.0.0.1' },
        { 'cache.host': '$db.host' }
    ));

    assert.match(output, /::warning::/);
    assert.match(output, /cache\.host/);
    assert.match(output, /\$\(db\.host\)/);
    assert.match(output, /removed in v11/);
});

test('current "$(name)" fallback syntax resolves without a deprecation warning', () => {
    const { result, output } = captureOutput(() => prepare(
        { 'db.host': '127.0.0.1' },
        { 'cache.host': '$(db.host)' }
    ));

    assert.equal(result['cache.host'], '127.0.0.1');
    assert.doesNotMatch(output, /::warning::/);
});

test('deprecated "$name" syntax is not applied to provided variables', () => {
    // A password that happens to start with "$" has to survive untouched
    const { result, output } = captureOutput(() => prepare({
        'db.password': '$2y$10$abcdefghijklmnopqrstuv',
        'db.host': '127.0.0.1'
    }));

    assert.equal(result['db.password'], '$2y$10$abcdefghijklmnopqrstuv');
    assert.doesNotMatch(output, /::warning::/);
});

test('references are resolved inside provided variables, not only fallbacks', () => {
    const result = prepare({
        'api.host': 'example.com',
        'api.url': 'https://$(api.host)/v1'
    });

    assert.equal(result['api.url'], 'https://example.com/v1');
});

test('a reference may be embedded anywhere inside a value', () => {
    const result = prepare({
        'db.host': '127.0.0.1',
        'db.port': '3306',
        'db.dsn': 'mysql://$(db.host):$(db.port)/app'
    });

    assert.equal(result['db.dsn'], 'mysql://127.0.0.1:3306/app');
});

test('a variable may reference a fallback and a fallback may reference a variable', () => {
    const result = prepare(
        { 'api.url': 'https://$(api.host)' },
        { 'api.host': 'example.com', 'api.mirror': '$(api.url)/mirror' }
    );

    assert.equal(result['api.url'], 'https://example.com');
    assert.equal(result['api.mirror'], 'https://example.com/mirror');
});

test('references may be chained regardless of declaration order', () => {
    const result = prepare({
        'a': '$(b)/a',
        'b': '$(c)/b',
        'c': 'root'
    });

    assert.equal(result['a'], 'root/b/a');
    assert.equal(result['b'], 'root/b');
});

test('a whole-value reference preserves the referenced value type', () => {
    const result = prepare({
        'db.port': 3306,
        'cache.port': '$(db.port)'
    });

    assert.equal(result['cache.port'], 3306);
    assert.equal(typeof result['cache.port'], 'number');
});

test('a partial reference stringifies the referenced value', () => {
    const result = prepare({
        'db.port': 3306,
        'db.address': '127.0.0.1:$(db.port)'
    });

    assert.equal(result['db.address'], '127.0.0.1:3306');
});

test('non-string values are passed through untouched', () => {
    const result = prepare({
        'feature.enabled': true,
        'retry.count': 5,
        'nothing': null
    });

    assert.equal(result['feature.enabled'], true);
    assert.equal(result['retry.count'], 5);
    assert.equal(result['nothing'], null);
});

test('"$$(" escapes to a literal "$("', () => {
    const result = prepare({
        'shell.cmd': 'echo $$(pwd)',
        'pwd': 'should not be used'
    });

    assert.equal(result['shell.cmd'], 'echo $(pwd)');
});

test('an escaped reference can sit next to a real one', () => {
    const result = prepare({
        'dir': '/srv',
        'shell.cmd': 'cd $(dir) && echo $$(pwd)'
    });

    assert.equal(result['shell.cmd'], 'cd /srv && echo $(pwd)');
});

test('a value with no reference is left alone', () => {
    const result = prepare({
        'plain': 'just a string',
        'money': 'costs $5 (roughly)'
    });

    assert.equal(result['plain'], 'just a string');
    assert.equal(result['money'], 'costs $5 (roughly)');
});

test('an unknown reference target throws', () => {
    assert.throws(
        () => prepare({ 'api.url': 'https://$(api.host)' }),
        /Referenced variable "api\.host" is not found\./
    );
});

test('an unknown target in a deprecated fallback reference throws', () => {
    assert.throws(
        () => captureOutput(() => prepare({}, { 'cache.host': '$db.host' })),
        /Referenced variable "db\.host" is not found\./
    );
});

test('a reference cannot reach Object.prototype members', () => {
    assert.throws(
        () => prepare({ 'api.url': 'https://$(toString)' }),
        /Referenced variable "toString" is not found\./
    );
});

test('a token named after an Object.prototype member still takes its fallback', () => {
    const result = prepare({}, { 'toString': 'plain value' });

    assert.equal(result['toString'], 'plain value');
});

test('a circular reference throws instead of looping', () => {
    assert.throws(
        () => prepare({ 'a': '$(b)', 'b': '$(a)' }),
        /Circular token reference detected: a -> b -> a/
    );
});

test('a self reference throws', () => {
    assert.throws(
        () => prepare({ 'a': 'prefix-$(a)' }),
        /Circular token reference detected: a -> a/
    );
});

test('a longer reference cycle throws', () => {
    assert.throws(
        () => prepare({ 'a': '$(b)', 'b': '$(c)', 'c': '$(a)' }),
        /Circular token reference detected: a -> b -> c -> a/
    );
});
