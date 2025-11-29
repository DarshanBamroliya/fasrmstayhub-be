import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Default,
} from 'sequelize-typescript';
import { Farmhouse } from './farmhouse.entity';

@Table({ tableName: 'farmhouse_images', timestamps: true })
export class FarmhouseImage extends Model<FarmhouseImage> {
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
    type: DataType.STRING,
    allowNull: false,
  })
  imagePath: string;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  isMain: boolean;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  ordering: number;

  @BelongsTo(() => Farmhouse, { foreignKey: 'farmhouseId', as: 'farmhouse' })
  farmhouse: Farmhouse;
}

