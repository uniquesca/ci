export class CiPhpVersion {
    version = "8.2";
    extensions = "";

    constructor(input) {
        const copy = {...input};
        Object.assign(this, copy);
    }
};