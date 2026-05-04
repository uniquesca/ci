import fs from 'fs';
import path from 'path';
import core from "@actions/core";

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
 * Applies token fallbacks to a variables object.
 * Mutates a copy of variables and returns it.
 *
 * @param {Record<string, string>} variables
 * @param {Record<string, string>} fallbacks
 * @returns {Record<string, string>}
 */
export function applyFallbacks(variables, fallbacks) {
    const result = {...variables};

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

/**
 * Prepares the environment by reading configs, merging variables with fallbacks,
 * and processing all configurations.
 *
 * @param {string} workingDirectory - The working directory path.
 * @param {string} envFilePath - Path to the environment JSON file.
 * @param {Record<string, number>} variables - JSON object with variables to use.
 * @returns {Promise<void>}
 */
export async function prepareEnvironment(workingDirectory, envFilePath, variables) {
    // Check if nunjucks is installed
    const nunjucksAvailable = await isNunjucksInstalled();
    if (!nunjucksAvailable) {
        throw new Error('nunjucks is not installed. Please install it using: npm install nunjucks');
    }

    // Get all configs to process
    const configs = getConfigList(envFilePath);

    // Get fallback variables from the environment file
    const fallbacks = getTokenFallbacks(envFilePath);

    // Prepare variables by merging provided variables with fallbacks
    const preparedVariables = applyFallbacks(variables, fallbacks);

    // Convert dot-notation keys to nested objects for nunjucks
    const nested = dotToNested(preparedVariables);

    console.log(preparedVariables);

    // Process all configs
    for (const config of configs) {
        await processConfig(workingDirectory, config, nested);
    }
}

/**
 * Checks if nunjucks is installed.
 *
 * @returns {Promise<boolean>}
 */
async function isNunjucksInstalled() {
    try {
        await import('nunjucks');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Processes a single config entry using nunjucks templating.
 *
 * @param {string} workingDirectory - The working directory path.
 * @param {EnvConfig} config - The config to process.
 * @param {Record<string, string|number>} variables - The prepared variables.
 * @returns {Promise<void>}
 */
async function processConfig(workingDirectory, config, variables) {
    try {
        const nunjucksModule = await import('nunjucks');
        const nunjucks = nunjucksModule.default;

        // Resolve the template file path relative to the working directory
        const templatePath = path.join(workingDirectory, config.template);
        const outputPath = path.join(workingDirectory, config.path);

        // Check if template file exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }

        // Read the template file
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        // Render the template with variables
        const rendered = nunjucks.renderString(templateContent, variables);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        // Write the rendered content to the output file
        fs.writeFileSync(outputPath, rendered, 'utf8');

        console.log(`Processed config: ${config.template} -> ${config.path}`);
    } catch (error) {
        throw new Error(`Failed to process config ${config.template}: ${error.message}`);
    }
}
