import fs from 'fs';
import path from 'path';

/** Matches a value that consists of nothing but a single "$(name)" reference. */
const WHOLE_REFERENCE_PATTERN = /^\$\(([^)]+)\)$/;

/**
 * Emits a warning.
 *
 * This module also runs inside Docker images, so @actions/core is deliberately not used here.
 * Under GitHub Actions the message is written as a workflow annotation, elsewhere as a plain line.
 *
 * @param {string} message - The warning message.
 * @returns {void}
 */
function warn(message) {
    if (!process.env.GITHUB_ACTIONS) {
        console.log(`Warning: ${message}`);
        return;
    }

    const escaped = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::warning::${escaped}`);
}

/**
 * Converts dot-notation keys to nested objects.
 * Transforms flat object with dot-separated keys into nested structure.
 *
 * @param {Record<string, any>} variables - Flat object with dot-notation keys.
 * @returns {Record<string, any>} - Nested object structure.
 */
export function dotToNested(variables) {
    const nested = {};
    for (const [key, value] of Object.entries(variables)) {
        const parts = key.split('.');
        let cursor = nested;
        for (let i = 0; i < parts.length - 1; i++) {
            cursor[parts[i]] ??= {};
            cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = value;
    }
    return nested;
}

export class EnvConfig {
    /** @type {string} */
    template;
    /** @type {string} */
    path;

    constructor(template, path) {
        this.template = template;
        this.path = path;
    }
}

/**
 * Reads _ci_environment.json at the given path and returns the list of config entries.
 *
 * @param {string} envFilePath - Path to the environment JSON file.
 * @returns {EnvConfig[]}
 */
export function getConfigList(envFilePath) {
    if (!fs.existsSync(envFilePath)) {
        return [];
    }

    const raw = fs.readFileSync(envFilePath, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.configs)) {
        return [];
    }

    return data.configs.map(entry => new EnvConfig(entry.stub, entry.path));
}

/**
 * Reads _ci_environment.json at the given path and returns the token_fallbacks object.
 * Keys are token names, values are their fallback values (literals or "$otherKey" references).
 *
 * @param {string} envFilePath - Path to the environment JSON file.
 * @returns {Record<string, string>}
 */
export function getTokenFallbacks(envFilePath) {
    if (!fs.existsSync(envFilePath)) {
        return {};
    }

    const raw = fs.readFileSync(envFilePath, 'utf8');
    const data = JSON.parse(raw);

    return data.token_fallbacks ?? {};
}

/**
 * Rewrites the deprecated whole-value "$name" reference syntax to "$(name)".
 * Any other value is returned untouched.
 *
 * @param {string} key - Name of the fallback the value belongs to, used for the warning.
 * @param {any} fallback - The fallback value.
 * @returns {any}
 */
function normalizeLegacyReference(key, fallback) {
    if (typeof fallback !== 'string' || fallback.length < 2) {
        return fallback;
    }

    // "$(name)" is the current syntax and "$$(" is an escaped literal, neither is legacy
    if (!fallback.startsWith('$') || fallback.startsWith('$(') || fallback.startsWith('$$')) {
        return fallback;
    }

    const reference = fallback.slice(1);
    warn(
        `Token fallback "${key}" uses the deprecated "$name" reference syntax. `
        + `Use "$(${reference})" instead — the old syntax will be removed in v11.`
    );

    return `$(${reference})`;
}

/**
 * Applies token fallbacks to a variables object.
 * Fallbacks are only used for tokens the variables do not already define. Fallback values
 * written in the deprecated "$name" syntax are rewritten to "$(name)" so that a single
 * reference syntax reaches resolveReferences().
 *
 * @param {Record<string, string>} variables
 * @param {Record<string, string>} fallbacks
 * @returns {Record<string, string>}
 */
export function applyFallbacks(variables, fallbacks) {
    const result = {...variables};

    for (const [key, fallback] of Object.entries(fallbacks)) {
        if (Object.hasOwn(result, key)) {
            continue;
        }

        result[key] = normalizeLegacyReference(key, fallback);
    }

    return result;
}

/**
 * Resolves a single value, replacing every "$(name)" reference in it.
 *
 * A value that is nothing but one reference yields the referenced value as-is, so its type is
 * preserved. A reference embedded in a larger string is stringified. "$$(" produces a literal "$(".
 *
 * @param {any} value - The value to resolve.
 * @param {(key: string) => any} resolveKey - Resolves another token by name.
 * @returns {any}
 */
function resolveValue(value, resolveKey) {
    if (typeof value !== 'string') {
        return value;
    }

    const whole = value.match(WHOLE_REFERENCE_PATTERN);
    if (whole) {
        return resolveKey(whole[1]);
    }

    const pattern = /\$\$\(|\$\(([^)]+)\)/g;

    return value.replace(pattern, (match, key) => key === undefined ? '$(' : String(resolveKey(key)));
}

/**
 * Resolves "$(name)" references across all variables.
 *
 * References may point at any other token regardless of declaration order, may be chained, and may
 * appear anywhere inside a value. An unknown target or a circular chain throws.
 *
 * @param {Record<string, any>} variables
 * @returns {Record<string, any>}
 */
export function resolveReferences(variables) {
    const resolved = {};
    const visiting = new Set();

    const resolveKey = (key) => {
        if (Object.hasOwn(resolved, key)) {
            return resolved[key];
        }

        if (visiting.has(key)) {
            throw new Error(`Circular token reference detected: ${[...visiting, key].join(' -> ')}`);
        }

        // hasOwn rather than "in", so that a reference cannot reach Object.prototype members
        if (!Object.hasOwn(variables, key)) {
            throw new Error(`Referenced variable "${key}" is not found.`);
        }

        visiting.add(key);
        resolved[key] = resolveValue(variables[key], resolveKey);
        visiting.delete(key);

        return resolved[key];
    };

    const result = {};
    for (const key of Object.keys(variables)) {
        result[key] = resolveKey(key);
    }

    return result;
}

/**
 * Prepares the environment by reading configs, merging variables with fallbacks,
 * and processing all configurations.
 *
 * @param {string} workingDirectory - The working directory path.
 * @param {string} envFilePath - Path to the environment JSON file.
 * @param {Record<string, string | number>} variables - JSON object with variables to use.
 * @returns {Promise<void>}
 */
export async function prepareEnvironment(workingDirectory, envFilePath, variables) {
    // Get all configs to process
    const configs = getConfigList(envFilePath);

    // Get fallback variables from the environment file
    const fallbacks = getTokenFallbacks(envFilePath);

    // Prepare variables by merging provided variables with fallbacks
    const preparedVariables = applyFallbacks(variables, fallbacks);

    // Resolve "$(name)" references, in both the provided variables and the fallbacks
    const resolvedVariables = resolveReferences(preparedVariables);

    // Convert dot-notation keys to nested objects for nunjucks
    const nested = dotToNested(resolvedVariables);

    // Process all configs
    for (const config of configs) {
        await processConfig(workingDirectory, config.template, config.path, nested);
    }
}

/**
 * Processes a single config entry using nunjucks templating.
 *
 * @param {string} workingDirectory - The working directory path.
 * @param {string} templatePath - Path to the config template file
 * @param {string} configPath - Path to the output config file
 * @param {Record<string, string|number>} variables - The prepared variables.
 * @returns {Promise<void>}
 */
export async function processConfig(workingDirectory, templatePath, configPath, variables) {
    try {
        const nunjucksModule = await import('nunjucks');
        const nunjucks = nunjucksModule.default;

        // Configure nunjucks
        nunjucks.configure({ autoescape: false });

        // Resolve the template file path relative to the working directory
        const resolvedTemplatePath = path.resolve(workingDirectory, templatePath);
        const resolvedConfigPath = path.resolve(workingDirectory, configPath);

        // Check if template file exists
        if (!fs.existsSync(resolvedTemplatePath)) {
            throw new Error(`Template file not found: ${resolvedTemplatePath}`);
        }

        // Read the template file
        const templateContent = fs.readFileSync(resolvedTemplatePath, 'utf8');

        // Render the template with variables
        const rendered = nunjucks.renderString(templateContent, variables);

        // Ensure output directory exists
        const outputDir = path.dirname(resolvedConfigPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        // Write the rendered content to the output file
        fs.writeFileSync(resolvedConfigPath, rendered, 'utf8');

        console.log(`Processed config: ${templatePath} -> ${configPath}`);
    } catch (error) {
        throw new Error(`Failed to process config ${templatePath}: ${error.message}`);
    }
}
