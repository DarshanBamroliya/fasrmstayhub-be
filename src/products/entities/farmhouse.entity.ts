import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { Location } from './location.entity';
import { PriceOption } from './price-option.entity';
import { HouseRule } from './house-rule.entity';
import { FarmhouseImage } from './farmhouse-image.entity';
import { FarmhouseAmenity } from './farmhouse-amenity.entity';

@Table({ tableName: 'farmhouses', timestamps: true })
export class Farmhouse extends Model<Farmhouse> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare slug: string;

  @Column({
    type: DataType.ENUM('HIGH', 'MEDIUM', 'LOW'),
    allowNull: false,
    defaultValue: 'MEDIUM',
  })
  declare priority: 'HIGH' | 'MEDIUM' | 'LOW';

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare maxPersons: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare bedrooms: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.TIME,
    allowNull: false,
  })
  declare checkInFrom: string;

  @Column({
    type: DataType.TIME,
    allowNull: false,
  })
  declare checkOutTo: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare status: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isRecomanded: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isAmazing: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    comment: 'Most visited farm based on booking count',
  })
  declare isMostVisited: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare farmNo: string;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;

  // Relations
  @HasOne(() => Location, { foreignKey: 'farmhouseId', as: 'location' })
  declare location: Location;

  @HasMany(() => PriceOption, { foreignKey: 'farmhouseId', as: 'priceOptions' })
  declare priceOptions: PriceOption[];

  @HasMany(() => HouseRule, { foreignKey: 'farmhouseId', as: 'houseRules' })
  declare houseRules: HouseRule[];

  @HasMany(() => FarmhouseImage, { foreignKey: 'farmhouseId', as: 'images' })
  declare images: FarmhouseImage[];

  @HasMany(() => FarmhouseAmenity, { foreignKey: 'farmhouseId', as: 'farmhouseAmenities' })
  declare farmhouseAmenities: FarmhouseAmenity[];
}

