import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  Default,
  CreatedAt,
  UpdatedAt,
  AllowNull,
} from 'sequelize-typescript';

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  // Optional (can be null if not set)
  @AllowNull(true)
  @Column(DataType.STRING)
  declare name: string;

  // Optional
  @AllowNull(true)
  @Column(DataType.STRING)
  declare email: string;


  // Optional
  @AllowNull(true)
  @Column(DataType.STRING)
  declare mobileNo: string;

  // Required: google / phone
  @AllowNull(false)
  @Default('phone')
  @Column(DataType.ENUM('google', 'phone'))
  declare loginType: 'google' | 'phone';

  // Optional
  @AllowNull(true)
  @Default(0)
  @Column(DataType.INTEGER)
  declare totalOrders: number;

  // Required
  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isNewCustomer: boolean;

  // Optional JSON Array
  @AllowNull(true)
  @Default([])
  @Column(DataType.JSON)
  declare orderIds: number[];

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileImage: string;

  // Saved farms - array of product IDs
  @AllowNull(true)
  @Default([])
  @Column(DataType.JSON)
  declare savedFarms: number[];

  // Booking history - array of booking objects
  @AllowNull(true)
  @Default([])
  @Column(DataType.JSON)
  declare bookingHistory: any[];

  // Flag to check if user has booked any farm
  @AllowNull(true)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isAnyFarmBooked: boolean;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
