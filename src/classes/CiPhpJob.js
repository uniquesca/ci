import {CiPhpVersion} from "./CiPhpVersion.js";

export class CiPhpJob {
    os = "ubuntu-latest";
    php = new CiPhpVersion({
        version: "8.1",
        extensions: ""
    });
    default = false; // Will be used as a default environment in various CI tasks
    locked = false; // Affects Composer - it will use install if locked, update otherwise

    constructor(input) {
        const copy = {...input};

        if (copy.php) {
            copy.php = new CiPhpVersion(copy.php);
        }

        Object.assign(this, copy);
    }
};