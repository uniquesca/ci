import core from "@actions/core";
import {CiEnvironment} from "../src/classes/CiEnvironment.js";

try {
    const env = CiEnvironment.fromEnvironmentFile();
    for (let key in env.job_matrix) {
        // Add php xdebug extension as it's necessary for coverage
        if (env.job_matrix[key].php.extensions.indexOf("xdebug") === -1) {
            env.job_matrix[key].php.extensions = env.job_matrix[key].php.extensions + ' xdebug';
        }
    }
    core.setOutput("matrix", JSON.stringify(env.job_matrix));
} catch (error) {
    core.setFailed(error.message);
}
