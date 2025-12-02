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

@Table({ tableName: 'locations', timestamps: true })
export class Location extends Model<Location> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Farmhouse)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare farmhouseId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare address: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare city: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare state: string;

  @Column({
    type: DataType.DECIMAL(10, 8),
    allowNull: true,
  })
  declare latitude: number;

  @Column({
    type: DataType.DECIMAL(11, 8),
    allowNull: true,
  })
  declare longitude: number;

  @BelongsTo(() => Farmhouse, { foreignKey: 'farmhouseId', as: 'farmhouse' })
  declare farmhouse: Farmhouse;
}

