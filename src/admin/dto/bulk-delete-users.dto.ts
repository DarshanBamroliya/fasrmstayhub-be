import { IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteUsersDto {
    @ApiProperty({ 
        example: [1, 2, 3], 
        description: 'Array of user IDs to delete',
        type: [Number]
    })
    @IsArray()
    @IsNumber({}, { each: true })
    userIds: number[];
}

