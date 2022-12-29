"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyJson = exports.round = void 0;
function round(value, decimalPlaces = 6) {
    return Number(Math.round(parseFloat(value + 'e' + decimalPlaces)) + 'e-' + decimalPlaces);
}
exports.round = round;
function stringifyJson(object) {
    const stringify = Object.entries(object).reduce((acc, [k, v], idx) => {
        if (idx === 0) {
            return `""${k}"":${v}`;
        }
        return acc + ',' + `""${k}"":${v}`;
    }, '');
    return `"{${stringify}"}`;
}
exports.stringifyJson = stringifyJson;
