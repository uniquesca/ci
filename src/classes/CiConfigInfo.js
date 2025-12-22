import {CiPhpVersion} from "./CiPhpVersion.js";

export class CiConfigInfo {
    stub: string;
    path: string;

    constructor(input) {
        const copy = {...input};
        Object.assign(this, copy);
    }
};