import {CiPhpVersion} from "./CiPhpVersion.js";

export class CiJob {
    os = "ubuntu-latest";
    php = new CiPhpVersion({
        version: "8.1",
        extensions: ""
    });

    constructor(input) {
        const copy = {...input};

        if (copy.php) {
            copy.php = new CiPhpVersion(copy.php);
        }

        Object.assign(this, copy);
    }
};