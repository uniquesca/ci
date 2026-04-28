import fs from 'fs';

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
 * Applies token fallbacks to a variables object.
 * Mutates a copy of variables and returns it.
 *
 * @param {Record<string, string>} variables
 * @param {Record<string, string>} fallbacks
 * @returns {Record<string, string>}
 */
export function applyFallbacks(variables, fallbacks) {
    const result = { ...variables };

    for (const [key, fallback] of Object.entries(fallbacks)) {
        if (key in result) {
            continue;
        }

        if (typeof fallback === 'string' && fallback.startsWith('$')) {
            const reference = fallback.slice(1);
            if (!(reference in result)) {
                throw new Error(`Referenced variable "${reference}" is not found.`);
            }
            result[key] = result[reference];
        } else {
            result[key] = fallback;
        }
    }

    return result;
}
