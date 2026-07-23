import core from '@actions/core';
import process from 'process';
import path from 'path';
import {dotToNested, processConfig} from '../src/environment.js';

async function main() {
    try {
        const workingDir = path.resolve(core.getInput('working_directory') || '.');
        const source = core.getInput('source', { required: true });
        const destination = core.getInput('destination', { required: true });
        const variablesInput = core.getInput('variables', { required: true });

        let variables;
        try {
            variables = JSON.parse(variablesInput);
        } catch (error) {
            core.setFailed(`❌ variables is not valid JSON: ${error.message}`);
            process.exit(1);
        }

        // Convert dot-notation keys to nested objects for nunjucks
        const nested = dotToNested(variables);

        core.info(`⏩ Rendering config: ${source} -> ${destination}`);
        await processConfig(workingDir, source, destination, nested);

        core.info('✅ Config rendered successfully');
    } catch (error) {
        core.setFailed(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

main();