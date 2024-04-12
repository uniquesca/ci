import core from "@actions/core";
import fs from "fs";
import {CiPhpJob} from "./CiPhpJob.js";

export class CiEnvironment {
    env_file = '';
    env_file_stub = '';
    token_mappings = {};


    // Array of CiJob classes
    job_matrix = [
        new CiPhpJob({
            os: "ubuntu-latest",
            php: {
                version: "8.1",
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