import core from "@actions/core";
import {CiEnvironment} from "../src/classes/CiEnvironment.js";
import {CiJob} from "../src/classes/CiJob.js";
import {CiPhpVersion} from "../src/classes/CiPhpVersion.js";

try {
    const env = CiEnvironment.fromEnvironmentFile();
    let job;
    for (let key in env.job_matrix) {
        if (env.job_matrix[key].default) {
            job = env.job_matrix[key];
            break;
        }
    }
    if (!job) {
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
