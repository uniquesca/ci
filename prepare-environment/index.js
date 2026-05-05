import core from '@actions/core';
import fs from 'fs';
import process from 'process';
import path from 'path';
import { prepareEnvironment } from '../src/environment.js';

const ENV_FILE = '_ci_environment.json';

async function main() {
    try {
        // Get input parameters
        const workingDir = path.resolve(core.getInput('working_directory') || '.');
        const envVariablesInput = core.getInput('env_variables', { required: true });

        // Prepare environment file path
        const envFile = path.resolve(workingDir + '/' + ENV_FILE);

        // Exit early if no environment file present
        if (!fs.existsSync(envFile)) {
            core.info('No CI environment file — skipping action.');
            process.exit(0);
        }

        // Parse input variables
        let variables;
        try {
            variables = JSON.parse(envVariablesInput);
        } catch (e) {
            core.setFailed('❌ env_variables is not valid JSON');
            process.exit(1);
        }

        // Invoke prepareEnvironment
        core.info('⏩ Preparing environment and processing configs...');
        await prepareEnvironment(workingDir, envFile, variables);

        core.info('✅ Environment preparation completed successfully');
    } catch (error) {
        core.setFailed(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main();

