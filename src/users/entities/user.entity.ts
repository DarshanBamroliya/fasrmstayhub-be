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
  name: string;

  // Optional
  @AllowNull(true)
  @Column(DataType.STRING)
  email: string;


  // Optional
  @AllowNull(true)
  @Column(DataType.STRING)
  mobileNo: string;

  // Required: google / phone
  @AllowNull(false)
  @Default('phone')
  @Column(DataType.ENUM('google', 'phone'))
  loginType: 'google' | 'phone';

  // Optional
  @AllowNull(true)
  @Default(0)
  @Column(DataType.INTEGER)
  totalOrders: number;

  // Required
  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  isNewCustomer: boolean;

  // Optional JSON Array
  @AllowNull(true)
  @Default([])
  @Column(DataType.JSON)
  orderIds: number[];

  @AllowNull(true)
  @Column(DataType.STRING)
  profileImage: string;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}
