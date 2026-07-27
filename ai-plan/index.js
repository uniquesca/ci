import core from '@actions/core';
import { generatePlan } from '../src/ai-plan.js';

async function main() {
    try {
        // Get input parameters
        const task = core.getInput('task', { required: true });
        const apiKey = core.getInput('api_key');

        // Fail early with a clear message if the API key is missing
        if (!apiKey) {
            core.setFailed('❌ api_key is not set — pass it from a secret in the calling workflow');
            process.exit(1);
        }

        // Keep the key out of the logs, including any error message quoting it
        core.setSecret(apiKey);

        // Ask the AI agent to produce the plan
        core.info('⏩ Asking the AI agent to plan the task...');
        const { machine, humanReadable } = await generatePlan(task, { apiKey });

        // Emit both plan forms
        core.setOutput('plan', humanReadable);
        core.setOutput('plan_json', JSON.stringify(machine));

        core.info('✅ Plan generated successfully');
    } catch (error) {
        core.setFailed(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main();
