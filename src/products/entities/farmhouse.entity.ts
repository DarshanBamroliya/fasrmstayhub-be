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
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  slug: string;

  @Column({
    type: DataType.ENUM('HIGH', 'MEDIUM', 'LOW'),
    allowNull: false,
    defaultValue: 'MEDIUM',
  })
  priority: 'HIGH' | 'MEDIUM' | 'LOW';

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  maxPersons: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  bedrooms: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.TIME,
    allowNull: false,
  })
  checkInFrom: string;

  @Column({
    type: DataType.TIME,
    allowNull: false,
  })
  checkOutTo: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  status: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  isRecomanded: boolean;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  isAmazing: boolean;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;

  // Relations
  @HasOne(() => Location, { foreignKey: 'farmhouseId', as: 'location' })
  location: Location;

  @HasMany(() => PriceOption, { foreignKey: 'farmhouseId', as: 'priceOptions' })
  priceOptions: PriceOption[];

  @HasMany(() => HouseRule, { foreignKey: 'farmhouseId', as: 'houseRules' })
  houseRules: HouseRule[];

  @HasMany(() => FarmhouseImage, { foreignKey: 'farmhouseId', as: 'images' })
  images: FarmhouseImage[];

  @HasMany(() => FarmhouseAmenity, { foreignKey: 'farmhouseId', as: 'farmhouseAmenities' })
  farmhouseAmenities: FarmhouseAmenity[];
}

