"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionEntity = void 0;
const typeorm_1 = require("typeorm");
const base_schema_1 = require("./base-schema");
let TransactionEntity = class TransactionEntity extends base_schema_1.BaseSchema {
};
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], TransactionEntity.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransactionEntity.prototype, "transactionType", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransactionEntity.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)('double precision'),
    __metadata("design:type", Number)
], TransactionEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: {} }),
    __metadata("design:type", Object)
], TransactionEntity.prototype, "portfolio", void 0);
TransactionEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'transactions' }),
    (0, typeorm_1.Index)(['timestamp', 'transactionType', 'token', 'amount'], { unique: true })
], TransactionEntity);
exports.TransactionEntity = TransactionEntity;
