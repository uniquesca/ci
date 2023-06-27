export class CiPhpVersion {
    version = "8.1";
    extensions = "";

    constructor(input) {
        const copy = {...input};
        Object.assign(this, copy);
    }
};