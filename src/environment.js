import fs from 'fs';
import path from 'path';

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

    const references = {};
    for (const [key, fallback] of Object.entries(fallbacks)) {
        if (key in result) {
            continue;
        }

        if (typeof fallback === 'string' && fallback.startsWith('$')) {
            references[key] = fallback;
        } else {
            result[key] = fallback;
        }
    }

    for (const [refKey, reference] of Object.entries(references)) {
        const referenceVal = reference.slice(1);
        if (!(referenceVal in result)) {
            throw new Error(`Referenced variable "${referenceVal}" is not found.`);
        }
        result[refKey] = result[referenceVal];
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

    // Convert dot-notation keys to nested objects for nunjucks
    const nested = dotToNested(preparedVariables);

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
