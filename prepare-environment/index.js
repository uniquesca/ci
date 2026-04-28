import core from '@actions/core';
import fs from 'fs';
import path from 'path';
import process from 'process';
import nunjucks from 'nunjucks';
import {getConfigList, getTokenFallbacks, applyFallbacks} from '../src/environment.js';

const ENV_FILE = '_ci_environment.json';

// Change working directory if specified
const workingDir = core.getInput('working_directory') || '.';
process.chdir(workingDir);

// Exit early if no environment file present
if (!fs.existsSync(ENV_FILE)) {
    core.info('No CI environment file — skipping action.');
    process.exit(0);
}

// Parse input variables
let variables;
try {
    variables = JSON.parse(core.getInput('env_variables', { required: true }));
} catch (e) {
    core.setFailed('❌ env_variables is not valid JSON');
    process.exit(1);
}

// Apply token fallbacks
const fallbacks = getTokenFallbacks(ENV_FILE);
try {
    variables = applyFallbacks(variables, fallbacks);
} catch (e) {
    core.setFailed(`Error: ${e.message}`);
    process.exit(1);
}

// Convert dot-notation keys to nested objects for nunjucks
core.info('⏩ Converting dot notation to nested objects...');
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

// Configure nunjucks
nunjucks.configure('.', { autoescape: false, throwOnUndefined: false });

// Process each config template
const configs = getConfigList(ENV_FILE);
for (const config of configs) {
    core.info(`⏩ Nunjucks: processing ${config.template} -> ${config.path}`);

    if (!fs.existsSync(config.template)) {
        core.warning(`Template file not found: ${config.template} — skipping.`);
        continue;
    }

    const rendered = nunjucks.renderString(fs.readFileSync(config.template, 'utf8'), nested);
    fs.mkdirSync(path.dirname(config.path), { recursive: true });
    fs.writeFileSync(config.path, rendered, 'utf8');
}

