import core from "@actions/core";
import fs from "fs";
import process from "process";
import {CiEnvironment} from "../src/classes/CiEnvironment.js";
import {CiEnvVariableMapper} from "../src/classes/CiEnvVariableMapper.js";

let workingDir = core.getInput('working_directory');
if (workingDir) {
    process.chdir(workingDir);
}

// Retrieving environment from the file
const env = CiEnvironment.fromEnvironmentFile();

// Checking config file path - firstly from intput, then - from environment file
let config = core.getInput('env_file');
if (!config || config == '') {
    config = env.env_file;
}
if (!config || config == '') {
    core.info("Environment file not found, exiting.");
    process.exit();
}

// Copying stub file if exists - firstly from intput, then - from environment file
let configStub = core.getInput('env_file_stub');
if (!configStub || configStub == '') {
    configStub = env.env_file_stub;
}
if (configStub !== '' && fs.existsSync(configStub)) {
    fs.copyFileSync(configStub, config);
    core.info("Copied config stub " + configStub + " into " + config);
}

// Preparing replacements
const variables = core.getInput('env_variables');
let variablesParsed = JSON.parse(variables);
if (!variablesParsed) {
    variablesParsed = {};
}
const envMapper = new CiEnvVariableMapper(variablesParsed, env);
variablesParsed = envMapper.map();

let configContent = fs.readFileSync(config, 'utf8');

for (const key of Object.keys(variablesParsed)) {
    let value = variablesParsed[key];
    // Process was simplified, no need for the below part
    const patternRegex = '\\$?\\{{1,2}' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}{1,2}';
    const regex = new RegExp(patternRegex, 'g');
    configContent = configContent.replaceAll(regex, value);
}

core.debug('Processed environment file content:');
core.debug(configContent);

fs.writeFileSync(config, configContent);

