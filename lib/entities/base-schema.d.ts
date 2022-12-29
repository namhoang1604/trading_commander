import { BaseEntity } from 'typeorm';
export declare abstract class BaseSchema extends BaseEntity {
    id: number;
    createdDate: Date;
    updatedDate: Date;
}
