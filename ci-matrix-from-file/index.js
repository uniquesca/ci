import core from "@actions/core";
import fs from "fs";

try {
    const file = core.getInput('matrix_file');
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file);
        if (JSON.parse(content)) {
            core.setOutput("matrix", content);
        } else {
            core.setFailed('Matrix file does not seem to be valid JSON.');
        }
    } else {
        core.setFailed('Matrix file ' + file + ' does not exist.');
    }
} catch (error) {
    core.setFailed(error.message);
}
