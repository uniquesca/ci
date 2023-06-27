import core from "@actions/core";
import fs from "fs";
import {CiJob} from "./CiJob.js";


export class CiEnvironment {
    env_file = '';
    env_file_stub = '';
    token_mappings = {};


    // Array of CiJob classes
    job_matrix = [
        new CiJob({
            os: "ubuntu-latest",
            php: {
                version: "8.1",
                extensions: "xdebug"
            }
        })
    ];

    constructor(input) {
        const copy = {...input};

        if (copy.job_matrix) {
            copy.job_matrix = copy.job_matrix.map(jobInfo => new CiJob(jobInfo));
        }

        Object.assign(this, copy);
    }

    static fromEnvironmentFile() {
        let input = {};
        if (fs.existsSync('_ci_environment.json')) {
            const envString = fs.readFileSync('_ci_environment.json');
            input = JSON.parse(envString);
            core.info('Found environment file _ci_environment.json');
        }

        return new CiEnvironment(input);
    }
};