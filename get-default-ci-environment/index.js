import core from "@actions/core";
import {CiEnvironment} from "../src/classes/CiEnvironment.js";
import {CiJob} from "../src/classes/CiJob.js";
import {CiPhpVersion} from "../src/classes/CiPhpVersion.js";

try {
    const env = CiEnvironment.fromEnvironmentFile();

    let job;
    if (env.job_matrix.length === 1) {
        // If there is only one job, using it as default
        job = env.job_matrix[0];
    } else {
        // Trying to find job market as default
        for (let key in env.job_matrix) {
            if (env.job_matrix[key].default) {
                job = env.job_matrix[key];
                break;
            }
        }
    }

    if (!job) {
        // If no job found, creating default one
        job = new CiJob({
            os: "ubuntu-latest",
            php: new CiPhpVersion({
                version: "8.1",
                extensions: "xdebug"
            }),
            default: true
        });
    } else {
        // Add php xdebug extension as it's necessary for coverage
        if (job.php.extensions.indexOf("xdebug") === -1) {
            job.extensions = env.job_matrix[key].php.extensions + ' xdebug';
        }
    }
    core.setOutput("env", JSON.stringify([job]));
} catch (error) {
    core.setFailed(error.message);
}
