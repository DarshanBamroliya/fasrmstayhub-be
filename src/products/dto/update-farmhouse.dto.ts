import { PartialType } from '@nestjs/swagger';
import { CreateFarmhouseDto } from './create-farmhouse.dto';

export class UpdateFarmhouseDto extends PartialType(CreateFarmhouseDto) {}

