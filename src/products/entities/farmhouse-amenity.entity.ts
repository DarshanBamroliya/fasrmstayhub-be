import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Farmhouse } from './farmhouse.entity';
import { Amenity } from './amenity.entity';
import { AmenityCategory } from './amenity-category.entity';

@Table({ tableName: 'farmhouse_amenities', timestamps: false })
export class FarmhouseAmenity extends Model<FarmhouseAmenity> {
  @PrimaryKey
  @ForeignKey(() => Farmhouse)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  farmhouseId: number;

  @PrimaryKey
  @ForeignKey(() => Amenity)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  amenityId: number;

  @ForeignKey(() => AmenityCategory)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  categoryId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  quantity: number;

  @BelongsTo(() => Farmhouse, { foreignKey: 'farmhouseId', as: 'farmhouse' })
  farmhouse: Farmhouse;

  @BelongsTo(() => Amenity, { foreignKey: 'amenityId', as: 'amenity' })
  amenity: Amenity;

  @BelongsTo(() => AmenityCategory, { foreignKey: 'categoryId', as: 'category' })
  category: AmenityCategory;
}

