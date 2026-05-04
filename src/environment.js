import fs from 'fs';
import path from 'path';

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

/**
 * Prepares the environment by reading configs, merging variables with fallbacks,
 * and processing all configurations.
 *
 * @param {string} workingDirectory - The working directory path.
 * @param {string} envFilePath - Path to the environment JSON file.
 * @param {Record<string, number>} variables - JSON object with variables to use.
 * @returns {void}
 */
export function prepareEnvironment(workingDirectory, envFilePath, variables) {
    // Get all configs to process
    const configs = getConfigList(envFilePath);

    // Get fallback variables from the environment file
    const fallbacks = getTokenFallbacks(envFilePath);

    // Prepare variables by merging provided variables with fallbacks
    const preparedVariables = applyFallbacks(variables, fallbacks);

    // Process all configs
    for (const config of configs) {
        processConfig(workingDirectory, config, preparedVariables);
    }
}

/**
 * Checks if nunjucks is installed.
 *
 * @returns {boolean}
 */
function isNunjucksInstalled() {
    try {
        require.resolve('nunjucks');
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
 * @returns {void}
 */
async function processConfig(workingDirectory, config, variables) {
    if (!isNunjucksInstalled()) {
        throw new Error('nunjucks is not installed');
    }

    try {
        const nunjucks = await import('nunjucks');

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
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the rendered content to the output file
        fs.writeFileSync(outputPath, rendered, 'utf8');

        console.log(`Processed config: ${config.template} -> ${config.path}`);
    } catch (error) {
        throw new Error(`Failed to process config ${config.template}: ${error.message}`);
    }
}
