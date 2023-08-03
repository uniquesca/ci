import core from "@actions/core";
import {CiEnvironment} from "./CiEnvironment.js";

export class CiEnvVariableMapper {
    variables = {};
    environment = new CiEnvironment({});

    constructor(variables, environment) {
        this.variables = variables;
        this.environment = environment;
    }

    map() {
        const mappedResult = {};
        for (const key in this.environment.token_mappings) {
            core.debug("Processing variable: " + key);
            if (this.variables.hasOwnProperty(this.environment.token_mappings[key])) {
                result[key] = this.variables[this.environment.token_mappings[key]];
                core.debug("Mapping found: " + this.environment.token_mappings[this.environment.token_mappings[key]]);
            } else {
                core.debug("Mapping not found.");
            }
        }
        const result = {
            ...mappedResult,
            ...this.variables
        };
        return result;
    }
}
