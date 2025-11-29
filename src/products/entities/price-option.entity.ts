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
    type: DataType.ENUM('REGULAR', 'WEEKEND', 'COUPLE'),
    allowNull: false,
  })
  category: 'REGULAR' | 'WEEKEND' | 'COUPLE';

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  hours: number;

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

