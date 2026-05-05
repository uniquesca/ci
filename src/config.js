import { prepareEnvironment } from './environment.js';
import fs from 'fs';

/**
 * Parses command line arguments into a key-value object.
 *
 * @returns {Record<string, string>}
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const result = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];

            if (nextArg && !nextArg.startsWith('--')) {
                result[key] = nextArg;
                i++;
            } else {
                result[key] = true;
            }
        }
    }

    return result;
}

/**
 * Validates that all required arguments are present.
 *
 * @param {Record<string, string>} args
 * @throws {Error}
 */
function validateArguments(args) {
    const required = ['var-file'];

    for (const requiredArg of required) {
        if (!(requiredArg in args)) {
            throw new Error(`Missing required argument: --${requiredArg}`);
        }
    }
}

/**
 * Parses a JSON file and returns the variables object.
 *
 * @param {string} varFilePath
 * @returns {Record<string, string>}
 * @throws {Error}
 */
function readVariablesFromFile(varFilePath) {
    try {
        if (!fs.existsSync(varFilePath)) {
            throw new Error(`Variables file does not exist: ${varFilePath}`);
        }

        const fileContent = fs.readFileSync(varFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Variables file must contain a JSON object');
        }

        return parsed;
    } catch (error) {
        throw new Error(`Failed to read variables file: ${error.message}`);
    }
}

/**
 * Main entry point for the config preparation script.
 */
async function main() {
    try {
        // Parse command line arguments
        const args = parseArguments();

        // Validate required arguments
        validateArguments(args);

        const workingDirectory = args['working-dir'] || '.';
        const envFilePath = args['env-file'] || '_ci_environment.json';
        const varFilePath = args['var-file'];

        // Validate that working directory exists
        if (!fs.existsSync(workingDirectory)) {
            throw new Error(`Working directory does not exist: ${workingDirectory}`);
        }

        // Validate that environment file exists
        if (!fs.existsSync(envFilePath)) {
            throw new Error(`Environment file does not exist: ${envFilePath}`);
        }

        // Read variables from JSON file
        const variables = readVariablesFromFile(
            workingDirectory + '/' + varFilePath
        );

        console.log(`Preparing environment with the following parameters:`);
        console.log(`  Working Directory: ${workingDirectory}`);
        console.log(`  Environment File: ${envFilePath}`);
        console.log(`  Variables File: ${varFilePath}`);

        // Invoke prepareEnvironment
        await prepareEnvironment(workingDirectory, envFilePath, variables);

        console.log('Environment preparation completed successfully');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main();