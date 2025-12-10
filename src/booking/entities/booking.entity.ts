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
  BeforeSave,
  BeforeUpdate,
  BeforeCreate,
  AfterFind,
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
  declare bookingEndDate: Date | null;

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
  declare bookingHours: number | null;

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
    type: DataType.ENUM('upcoming', 'current', 'expired'),
    allowNull: false,
    defaultValue: 'upcoming',
    comment: 'Booking status based on current time',
  })
  declare bookingStatus: 'upcoming' | 'current' | 'expired';

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Partial paid amount (for partial payments)',
  })
  declare partialPaidAmount: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Remaining amount (for partial payments)',
  })
  declare remainingAmount: number | null;

  // Add these to the JSON columns if you prefer storing in JSON
  @Column({
    type: DataType.JSON,
    allowNull: true,
    comment: 'Partial payment details',
  })
  declare partialPaymentDetails: any;

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
  declare invoiceToken: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'Next time to check and update booking status',
  })
  declare nextStatusCheckAt: Date | null;

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

  // =================== Helper Methods ===================

  /**
   * Calculate check-out time based on booking type and farmhouse times
   */
  // Replace the existing calculateCheckOutTime method with this:

  public calculateCheckOutTime(): Date {
    if (!this.bookingDate) {
      return new Date();
    }

    const checkIn = new Date(this.bookingDate);
    const checkOut = new Date(checkIn);

    // Get farmhouse check-out time or use default
    let checkOutTime = this.bookingTimeTo;
    if (!checkOutTime && this.farmhouse) {
      checkOutTime = this.farmhouse.checkOutTo || '22:00';
    }

    // Parse time (handle both "HH:MM" and "HH:MM:SS" formats)
    const timeParts = (checkOutTime || '22:00').split(':');
    const hours = parseInt(timeParts[0]) || 22;
    const minutes = parseInt(timeParts[1]) || 0;

    if (this.bookingType?.includes('24HR')) {
      // 24HR: next day at check-out time
      checkOut.setDate(checkOut.getDate() + 1);
      checkOut.setHours(hours, minutes, 0, 0);
    } else {
      // 12HR: same day at check-out time
      // Add 12 hours to check-in time
      checkOut.setHours(checkIn.getHours() + 12);
      checkOut.setMinutes(checkIn.getMinutes(), 0, 0);

      // If checkOutTime is provided, use it
      if (checkOutTime) {
        checkOut.setHours(hours, minutes, 0, 0);
      }
    }

    return checkOut;
  }

  /**
   * Calculate booking status based on current time
   */
  public calculateBookingStatus(): 'upcoming' | 'current' | 'expired' {
    const now = new Date();

    if (!this.bookingDate) {
      return 'upcoming';
    }

    const checkIn = new Date(this.bookingDate);
    const checkOut = this.calculateCheckOutTime();

    if (now < checkIn) {
      return 'upcoming';
    } else if (now >= checkIn && now <= checkOut) {
      return 'current';
    } else {
      return 'expired';
    }
  }

  /**
   * Calculate next status check time
   */
  public calculateNextStatusCheckAt(): Date | null {
    const status = this.bookingStatus;

    if (status === 'upcoming') {
      // Check again at check-in time
      return new Date(this.bookingDate);
    } else if (status === 'current') {
      // Check again at check-out time
      return this.calculateCheckOutTime();
    } else {
      // Expired - no need to check
      return null;
    }
  }

  /**
   * Update status and related fields
   */
  public async updateStatus(): Promise<boolean> {
    const oldStatus = this.bookingStatus;
    const newStatus = this.calculateBookingStatus();

    if (oldStatus !== newStatus) {
      this.bookingStatus = newStatus;
      this.nextStatusCheckAt = this.calculateNextStatusCheckAt();

      // Update farm status based on booking status
      if (newStatus === 'expired' && this.farmStatus === 'unavailable') {
        this.farmStatus = 'available';
      } else if (newStatus === 'current' && this.farmStatus === 'available') {
        this.farmStatus = 'unavailable';
      }

      return true; // Status changed
    }

    return false; // Status not changed
  }

  // =================== Hooks ===================

  @BeforeCreate
  @BeforeUpdate
  static async autoUpdateStatus(instance: Booking) {
    // Update status before saving
    await instance.updateStatus();

    // Ensure nextStatusCheckAt is set
    if (!instance.nextStatusCheckAt) {
      instance.nextStatusCheckAt = instance.calculateNextStatusCheckAt();
    }
  }

  @AfterFind
  static async checkAndUpdateStatus(instances: Booking | Booking[] | null) {
    if (!instances) return;

    // If raw query, skip
    if ((instances as any).length === 0) return;

    if (Array.isArray(instances)) {
      for (const instance of instances) {
        if (instance instanceof Booking) {
          await instance.checkAndUpdateIfNeeded();
        }
      }
    } else {
      if (instances instanceof Booking) {
        await instances.checkAndUpdateIfNeeded();
      }
    }
  }


  /**
   * Check if status needs update and update if needed
   */
  private async checkAndUpdateIfNeeded(): Promise<void> {
    const now = new Date();

    // If nextStatusCheckAt is in the past, update status
    if (this.nextStatusCheckAt && this.nextStatusCheckAt <= now) {
      const changed = await this.updateStatus();
      if (changed) {
        await this.save();
      }
    }
  }

  /**
   * Static method to update all bookings status
   */
  static async updateAllStatuses(): Promise<{ updated: number; total: number }> {
    const allBookings = await Booking.findAll({
      include: [{ model: Farmhouse, as: 'farmhouse' }]
    });

    let updated = 0;
    for (const booking of allBookings) {
      const changed = await booking.updateStatus();
      if (changed) {
        await booking.save();
        updated++;
      }
    }

    return { updated, total: allBookings.length };
  }
}