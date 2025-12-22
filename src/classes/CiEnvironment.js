import core from "@actions/core";
import fs from "fs";
import {CiPhpJob} from "./CiPhpJob.js";

export class CiEnvironment {
    configs = {};
    token_fallbacks = {};

    // Array of CiJob classes
    job_matrix = [
        new CiPhpJob({
            os: "ubuntu-latest",
            php: {
                version: "8.2",
                extensions: "xdebug"
            },
            default: true,
            locked: false
        })
    ];

    constructor(input) {
        const copy = {...input};

        if (copy.job_matrix) {
            copy.job_matrix = copy.job_matrix.map(jobInfo => new CiPhpJob(jobInfo));
        }

        if (copy.configs) {
            copy.configs = copy.configs.map(config => new CiConfigInfo(config));
        }

        Object.assign(this, copy);
    }

    static fromEnvironmentFile() {
        let input = {};
        if (fs.existsSync('_ci_environment.json')) {
            const envString = fs.readFileSync('_ci_environment.json', 'utf8');
            input = JSON.parse(envString);
            core.info('Found environment file _ci_environment.json');
        }

        return new CiEnvironment(input);
    }
};