import {CiPhpVersion} from "./CiPhpVersion.js";

export class CiConfigInfo {
    stub = "";
    path = "";

    constructor(input) {
        const copy = {...input};
        Object.assign(this, copy);
    }
};