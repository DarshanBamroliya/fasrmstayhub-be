import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Farmhouse } from './farmhouse.entity';

@Table({ tableName: 'price_options', timestamps: true })
export class PriceOption extends Model<PriceOption> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Farmhouse)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  farmhouseId: number;

  @Column({
    type: DataType.ENUM('REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'),
    allowNull: false,
  })
  category: 'REGULAR_12HR' | 'REGULAR_24HR' | 'WEEKEND_12HR' | 'WEEKEND_24HR';

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  maxPeople: number;

  @BelongsTo(() => Farmhouse, { foreignKey: 'farmhouseId', as: 'farmhouse' })
  farmhouse: Farmhouse;
}

