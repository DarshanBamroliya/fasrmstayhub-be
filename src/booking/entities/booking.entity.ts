import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Farmhouse } from '../../products/entities/farmhouse.entity';

@Table({ tableName: 'bookings', timestamps: true })
export class Booking extends Model<Booking> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'User ID if logged in, null if manual booking',
  })
  declare userId: number | null;

  @ForeignKey(() => Farmhouse)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare farmhouseId: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Customer name (for manual bookings)',
  })
  declare customerName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Customer mobile (for manual bookings)',
  })
  declare customerMobile: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Customer email (for manual bookings)',
  })
  declare customerEmail: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    comment: 'Booking start date (check-in date)',
  })
  declare bookingDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'Booking end date (check-out date)',
  })
  declare bookingEndDate: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Booking time from (check-in time)',
  })
  declare bookingTimeFrom: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Booking time to (check-out time)',
  })
  declare bookingTimeTo: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Calculated hours based on booking type',
  })
  declare bookingHours: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    comment: 'Number of persons',
  })
  declare numberOfPersons: number;

  @Column({
    type: DataType.ENUM('REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'),
    allowNull: false,
  })
  declare bookingType: 'REGULAR_12HR' | 'REGULAR_24HR' | 'WEEKEND_12HR' | 'WEEKEND_24HR';

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Original price before discount',
  })
  declare originalPrice: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Discount amount',
  })
  declare discountAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Final price after discount',
  })
  declare finalPrice: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    comment: 'Whether user was logged in at booking time',
  })
  declare isLoggedIn: boolean | null;

  @Column({
    type: DataType.ENUM('paid', 'partial', 'incomplete', 'cancel'),
    allowNull: false,
    defaultValue: 'incomplete',
  })
  declare paymentStatus: 'paid' | 'partial' | 'incomplete' | 'cancel';

  @Column({
    type: DataType.ENUM('available', 'unavailable'),
    allowNull: false,
    defaultValue: 'available',
    comment: 'Farm status at booking time',
  })
  declare farmStatus: 'available' | 'unavailable';

  @Column({
    type: DataType.JSON,
    allowNull: true,
    comment: 'Additional booking data for invoice',
  })
  declare bookingData: any;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
    comment: 'Invoice token for user access',
  })
  declare invoiceToken: string;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;

  // Relations
  @BelongsTo(() => User, { foreignKey: 'userId', as: 'user' })
  declare user: User;

  @BelongsTo(() => Farmhouse, { foreignKey: 'farmhouseId', as: 'farmhouse' })
  declare farmhouse: Farmhouse;
}

