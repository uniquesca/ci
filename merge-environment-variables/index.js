import core from "@actions/core";

let variables1 = core.getInput('variables1');
variables1 = JSON.parse(variables1);

let variables2 = core.getInput('variables2');
variables2 = JSON.parse(variables2);

variables1 = Object.assign(variables1, variables2);
core.setOutput('variables', JSON.stringify(variables1));
