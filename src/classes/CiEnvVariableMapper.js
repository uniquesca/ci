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
        const result = {};
        for (const key in this.variables) {
            core.debug("Processing variable: " + key);
            if (this.environment.token_mappings.hasOwnProperty(key)) {
                result[this.environment.token_mappings[key]] = this.variables[key];
                core.debug("Mapping found: " + this.environment.token_mappings[key]);
            } else {
                result[key] = this.variables[key];
                core.debug("Mapping not found.");
            }
        }
        return result;
    }
}
