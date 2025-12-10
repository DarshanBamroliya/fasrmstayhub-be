import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { Booking } from './entities/booking.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import { Location } from '../products/entities/location.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';
import { User } from '../users/entities/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { ApiResponse } from 'src/common/responses/api-response';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { BookingCronService } from 'src/common/cron/booking-cron.service';

interface PartialPaymentResponse {
  paidAmount: number;
  remainingAmount: number;
  totalAmount: number;
  notes?: string;
  updatedAt?: string;
}

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking) private readonly bookingModel: typeof Booking,
    @InjectModel(Farmhouse) private readonly farmhouseModel: typeof Farmhouse,
    @InjectModel(PriceOption) private readonly priceOptionModel: typeof PriceOption,
    @InjectModel(User) private readonly userModel: typeof User,
    @Inject(BookingCronService)
    private readonly bookingCronService: BookingCronService, // ✅ Add cron service
  ) { }

  // =================== PRIVATE HELPER METHODS ===================

  // Calculate discount based on price
  private calculateDiscount(price: number, isLoggedIn: boolean): number {
    if (!isLoggedIn) {
      return 0;
    }

    if (price >= 1000 && price < 3000) {
      return 100;
    } else if (price >= 3000 && price < 5000) {
      return 200;
    } else if (price >= 5000 && price < 8000) {
      return 300;
    } else if (price >= 8000) {
      return 499;
    }

    return 0;
  }

  // Generate invoice token
  private generateInvoiceToken(): string {
    return `INV-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Find or create user by phone/email
  private async findOrCreateUser(
    customerName: string,
    customerMobile?: string,
    customerEmail?: string
  ): Promise<User> {
    // Validate: At least one of mobile or email is required
    if (!customerMobile && !customerEmail) {
      throw new BadRequestException('At least one of mobile or email is required');
    }

    // Try to find existing user by mobile or email
    let user: User | null = null;

    if (customerMobile) {
      user = await this.userModel.findOne({ where: { mobileNo: customerMobile } });
    }

    if (!user && customerEmail) {
      user = await this.userModel.findOne({ where: { email: customerEmail } });
    }

    // If user doesn't exist, create new one
    if (!user) {
      user = await this.userModel.create({
        name: customerName,
        mobileNo: customerMobile || '',
        email: customerEmail || '',
        loginType: customerMobile ? 'phone' : 'google',
      } as any);
    } else {
      // Update name if provided
      if (customerName && !user.name) {
        await user.update({ name: customerName } as any);
      }
    }

    return user;
  }

  // Calculate hours from booking type
  private calculateHoursFromBookingType(bookingType: string): number {
    if (bookingType.includes('12HR')) {
      return 12;
    } else if (bookingType.includes('24HR')) {
      return 24;
    }
    return 12; // Default
  }

  // === Booking time helpers ===
  private calculateCheckIn(selectedDate: string | Date): Date {
    const d = typeof selectedDate === 'string' ? new Date(selectedDate) : new Date(selectedDate as Date);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  private calculateCheckOut(checkIn: Date, bookingType: string): Date {
    const out = new Date(checkIn);
    if (bookingType.includes('24HR')) {
      out.setDate(out.getDate() + 1);
      out.setHours(9, 0, 0, 0);
    } else {
      out.setHours(21, 0, 0, 0);
    }
    return out;
  }

  private calculateNextAvailableDate(checkOut: Date, bookingType: string): Date {
    const next = new Date(checkOut);
    next.setHours(0, 0, 0, 0);
    if (bookingType.includes('24HR')) {
      next.setDate(next.getDate() + 2);
    } else {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private deriveCheckInFromRecord(booking: any): Date {
    const bd = booking.bookingDate ? new Date(booking.bookingDate) : null;
    const base = bd ? new Date(bd) : new Date();
    if (booking.bookingTimeFrom) {
      const [h, m] = (booking.bookingTimeFrom || '09:00').split(':').map(Number);
      base.setHours(h, m, 0, 0);
    } else {
      base.setHours(9, 0, 0, 0);
    }
    return base;
  }

  private deriveCheckOutFromRecord(booking: any): Date {
    if (booking.bookingEndDate) {
      const ed = new Date(booking.bookingEndDate);
      if (booking.bookingTimeTo) {
        const [h, m] = (booking.bookingTimeTo || '09:00').split(':').map(Number);
        ed.setHours(h, m, 0, 0);
      } else {
        if (booking.bookingType && booking.bookingType.includes('24HR')) {
          ed.setHours(9, 0, 0, 0);
        } else {
          ed.setHours(21, 0, 0, 0);
        }
      }
      return ed;
    }

    const ci = this.deriveCheckInFromRecord(booking);
    return this.calculateCheckOut(ci, booking.bookingType || 'REGULAR_12HR');
  }

  private isOverlapping(existing: any, newCheckIn: Date, newCheckOut: Date): boolean {
    const exCI = this.deriveCheckInFromRecord(existing);
    const exCO = this.deriveCheckOutFromRecord(existing);
    return newCheckIn < exCO && newCheckOut > exCI;
  }

  private calculateAvailableDates(
    startDate: Date,
    endDate: Date,
    bookingType: string
  ): { bookedDates: string[]; availableDates: string[] } {
    const bookedDates: string[] = [];
    const availableDates: string[] = [];

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const is24Hour = bookingType.includes('24HR');

    bookedDates.push(start.toISOString().split('T')[0]);

    if (is24Hour) {
      if (end.getTime() !== start.getTime()) {
        availableDates.push(end.toISOString().split('T')[0]);
      }
    } else {
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      availableDates.push(nextDay.toISOString().split('T')[0]);
    }

    return { bookedDates, availableDates };
  }

  private validateAndCalculateCheckoutTime(
    bookingDate: string,
    bookingTimeFrom: string,
    bookingType: string
  ): { isValid: boolean; error?: string; calculatedCheckoutTime?: string; calculatedEndDate?: Date } {
    try {
      const bookingDateTime = new Date(`${bookingDate}T${bookingTimeFrom}`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookingDateOnly = new Date(bookingDate);
      bookingDateOnly.setHours(0, 0, 0, 0);

      const isToday = bookingDateOnly.getTime() === today.getTime();
      const is24Hour = bookingType.includes('24HR');
      const is12Hour = bookingType.includes('12HR');

      if (!is24Hour && !is12Hour) {
        return { isValid: false, error: 'Invalid booking type' };
      }

      const [hours, minutes] = bookingTimeFrom.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { isValid: false, error: 'Invalid booking time format. Use HH:MM format' };
      }

      let checkoutDate = new Date(bookingDateOnly);
      let checkoutHours = hours;
      let checkoutMinutes = minutes;

      if (is24Hour) {
        checkoutDate.setDate(checkoutDate.getDate() + 1);
      } else if (is12Hour) {
        checkoutHours = hours + 12;
        if (checkoutHours >= 24) {
          checkoutHours -= 24;
          checkoutDate.setDate(checkoutDate.getDate() + 1);
        }
      }

      const calculatedCheckoutTime = `${checkoutHours.toString().padStart(2, '0')}:${checkoutMinutes.toString().padStart(2, '0')}`;

      if (is12Hour && checkoutHours < hours) {
        // Checkout crossed midnight
      } else if (is12Hour) {
        checkoutDate = new Date(bookingDateOnly);
      }

      return {
        isValid: true,
        calculatedCheckoutTime,
        calculatedEndDate: checkoutDate,
      };
    } catch (error) {
      return { isValid: false, error: 'Error validating booking time: ' + error.message };
    }
  }

  // Get price from farm's price options
  private async getPriceFromFarm(
    farmhouseId: number,
    bookingType: string,
    numberOfPersons: number
  ): Promise<number> {
    const priceOption = await this.priceOptionModel.findOne({
      where: {
        farmhouseId,
        category: bookingType,
      },
    });

    if (!priceOption) {
      throw new BadRequestException(`Price option not found for booking type: ${bookingType}`);
    }

    if (numberOfPersons > priceOption.maxPeople) {
      throw new BadRequestException(`Maximum ${priceOption.maxPeople} persons allowed for this booking type`);
    }

    return parseFloat(priceOption.price.toString());
  }

  // === Farmhouse time helpers ===

  private calculateCheckOutWithFarmhouseTime(checkIn: Date, bookingType: string, farmhouseCheckOutTo: string = '22:00'): Date {
    const out = new Date(checkIn);

    // Parse check-out time
    const [hours, minutes] = farmhouseCheckOutTo.split(':').map(Number);

    if (bookingType.includes('24HR')) {
      // 24HR: next day at check-out time
      out.setDate(out.getDate() + 1);
      out.setHours(hours || 10, minutes || 0, 0, 0);
    } else {
      // 12HR: same day, use check-out time
      out.setHours(hours || 22, minutes || 0, 0, 0);
    }

    return out;
  }

  private isOverlappingWithFarmhouseTimes(existing: any, newCheckIn: Date, newCheckOut: Date, farmhouse: any): boolean {
    const exCI = this.deriveCheckInFromRecordWithFarmhouse(existing, farmhouse);
    const exCO = this.deriveCheckOutFromRecordWithFarmhouse(existing, farmhouse);
    return newCheckIn < exCO && newCheckOut > exCI;
  }

  private deriveCheckInFromRecordWithFarmhouse(booking: any, farmhouse: any): Date {
    const bd = booking.bookingDate ? new Date(booking.bookingDate) : null;
    const base = bd ? new Date(bd) : new Date();

    if (booking.bookingTimeFrom) {
      const [h, m] = (booking.bookingTimeFrom || '09:00').split(':').map(Number);
      base.setHours(h, m, 0, 0);
    } else {
      const checkInTime = farmhouse?.checkInFrom || '10:00';
      const [h, m] = checkInTime.split(':').map(Number);
      base.setHours(h || 10, m || 0, 0, 0);
    }
    return base;
  }

  private deriveCheckOutFromRecordWithFarmhouse(booking: any, farmhouse: any): Date {
    if (booking.bookingEndDate) {
      const ed = new Date(booking.bookingEndDate);
      if (booking.bookingTimeTo) {
        const [h, m] = (booking.bookingTimeTo || '09:00').split(':').map(Number);
        ed.setHours(h, m, 0, 0);
      } else {
        if (booking.bookingType && booking.bookingType.includes('24HR')) {
          const checkOutTime = farmhouse?.checkInFrom || '10:00';
          const [h, m] = checkOutTime.split(':').map(Number);
          ed.setHours(h || 10, m || 0, 0, 0);
        } else {
          const checkOutTime = farmhouse?.checkOutTo || '22:00';
          const [h, m] = checkOutTime.split(':').map(Number);
          ed.setHours(h || 22, m || 0, 0, 0);
        }
      }
      return ed;
    }

    const ci = this.deriveCheckInFromRecordWithFarmhouse(booking, farmhouse);
    return this.calculateCheckOutWithFarmhouseTime(ci, booking.bookingType || 'REGULAR_12HR', farmhouse?.checkOutTo);
  }

  // Update user booking history
  private async updateUserBookingHistory(
    userId: number,
    farmhouseId: number,
    bookingDate: string,
    bookingType: string,
    rent: number
  ) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) return;

      const bookingHistory: any[] = (user as any).bookingHistory || [];
      bookingHistory.push({
        farmhouseId,
        bookingDate,
        bookingType,
        rent,
        bookedAt: new Date().toISOString(),
      });

      await user.update({
        bookingHistory: bookingHistory,
        isAnyFarmBooked: true,
      } as any);
    } catch (error) {
      console.error('Error updating user booking history:', error);
    }
  }

  // Update most visited status
  private async updateMostVisitedStatus(farmhouseId: number) {
    try {
      const bookingCount = await this.bookingModel.count({
        where: {
          farmhouseId,
          paymentStatus: { [Op.ne]: 'cancel' },
        },
      });

      const allFarmhouses = await this.farmhouseModel.findAll();
      const farmhouseCounts = await Promise.all(
        allFarmhouses.map(async (farm) => ({
          id: farm.id,
          count: await this.bookingModel.count({
            where: {
              farmhouseId: farm.id,
              paymentStatus: { [Op.ne]: 'cancel' },
            },
          }),
        }))
      );

      const maxCount = Math.max(...farmhouseCounts.map(f => f.count));
      const mostVisitedFarmId = farmhouseCounts.find(f => f.count === maxCount)?.id;

      for (const farm of allFarmhouses) {
        await farm.update({
          isMostVisited: farm.id === mostVisitedFarmId && maxCount > 0,
        } as any);
      }
    } catch (error) {
      console.error('Error updating most visited status:', error);
    }
  }

  // =================== AUTO STATUS UPDATE METHODS ===================

  /**
   * Check and auto-update booking status if needed
   * This runs automatically on every API call
   */
  private async checkAndAutoUpdateStatus(): Promise<void> {
    try {
      // Check for bookings that need status update
      const now = new Date();
      const bookingsToUpdate = await this.bookingModel.findAll({
        where: {
          nextStatusCheckAt: {
            [Op.lte]: now,
            [Op.ne]: null
          },
          bookingStatus: { [Op.in]: ['upcoming', 'current'] }
        },
        include: [{ model: Farmhouse, as: 'farmhouse' }]
      });

      for (const booking of bookingsToUpdate) {
        try {
          // Use the entity's updateStatus method
          const changed = await (booking as any).updateStatus();
          if (changed) {
            await booking.save();
            console.log(`✅ Auto-updated booking ${booking.id} status`);
          }
        } catch (error) {
          console.error(`❌ Error auto-updating booking ${booking.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in auto status update check:', error);
    }
  }

  // Create booking
  async create(createBookingDto: CreateBookingDto, reqUser?: any) {
    try {
      const {
        farmhouseId,
        userId,
        customerName,
        customerMobile,
        customerEmail,
        bookingDate,
        bookingTimeFrom,
        bookingTimeTo,
        numberOfPersons,
        bookingType,
        originalPrice,
        isLoggedIn = false,
        paymentStatus = 'incomplete',
        paidAmount = 0,
        remainingAmount: providedRemainingAmount,
        farmStatus = 'available',
        bookingData,
      } = createBookingDto;

      // Validate partial payment
      if (paymentStatus === 'partial') {
        if (!paidAmount || paidAmount <= 0) {
          return new ApiResponse(true, 'For partial payment, paid amount is required', null);
        }

        if (paidAmount >= (originalPrice || 0)) {
          return new ApiResponse(true, 'For partial payment, paid amount must be less than total price', null);
        }
      }

      // Check if user exists
      let finalUserId: number | null = null;
      let finalIsLoggedIn = false;

      if (userId) {
        const existingUser = await this.userModel.findByPk(userId);
        if (existingUser) {
          finalUserId = userId;
          finalIsLoggedIn = true;
        }
      }

      if (!finalUserId && reqUser && reqUser.id) {
        finalUserId = reqUser.id;
        finalIsLoggedIn = true;
      }

      if (!finalUserId) {
        if (!customerName || (!customerMobile && !customerEmail)) {
          return new ApiResponse(true, 'Customer name and at least one of mobile/email are required', null);
        }

        const user = await this.findOrCreateUser(customerName, customerMobile, customerEmail);
        finalUserId = user.id;
        finalIsLoggedIn = false;
      }

      if (isLoggedIn !== undefined && isLoggedIn !== null) {
        finalIsLoggedIn = isLoggedIn;
      }

      const loggedIn = finalIsLoggedIn;

      // Check farmhouse
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId, {
        include: [{ model: PriceOption, as: 'priceOptions' }],
      });

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      if (farmhouse.status === false) {
        return new ApiResponse(true, 'Farmhouse is not available', null);
      }

      // =================== FIX TIMEZONE ISSUE ===================

      // Get farmhouse check-in/check-out times
      const farmhouseCheckInFrom = farmhouse.checkInFrom || '10:00';
      const farmhouseCheckOutTo = farmhouse.checkOutTo || '22:00';

      // Parse booking date string
      let bookingDateStr: string;

      if (typeof bookingDate === 'string') {
        bookingDateStr = bookingDate;
      } else if (bookingDate && typeof bookingDate === 'object') {
        // Type guard for Date object
        const dateObj = bookingDate as any;
        if (dateObj.toISOString) {
          bookingDateStr = dateObj.toISOString().split('T')[0];
        } else {
          // Fallback to current date
          bookingDateStr = new Date().toISOString().split('T')[0];
        }
      } else {
        bookingDateStr = new Date().toISOString().split('T')[0];
      }

      // Create check-in date
      const [year, month, day] = bookingDateStr.split('-').map(Number);
      const checkInDate = new Date(year, month - 1, day);

      // Parse farmhouse check-in time
      const [checkInHours, checkInMinutes] = farmhouseCheckInFrom.split(':').map(Number);

      // Set check-in time (local time)
      checkInDate.setHours(checkInHours || 10, checkInMinutes || 0, 0, 0);

      const newCheckIn = checkInDate;
      const newCheckOut = this.calculateCheckOutWithFarmhouseTime(newCheckIn, bookingType, farmhouseCheckOutTo);

      // Format times for database
      const finalBookingTimeFrom = farmhouseCheckInFrom;
      const finalBookingTimeTo = (() => {
        const h = newCheckOut.getHours().toString().padStart(2, '0');
        const m = newCheckOut.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      })();

      // Check overlapping bookings
      const existingBookings = await this.bookingModel.findAll({
        where: { farmhouseId, paymentStatus: { [Op.ne]: 'cancel' } },
      });

      for (const ex of existingBookings) {
        if (this.isOverlappingWithFarmhouseTimes(ex, newCheckIn, newCheckOut, farmhouse)) {
          return new ApiResponse(true, 'Farmhouse already booked for this time', null);
        }
      }

      // Calculate price
      let finalPrice = originalPrice;
      if (!originalPrice || originalPrice === 0) {
        finalPrice = await this.getPriceFromFarm(farmhouseId, bookingType, numberOfPersons);
      }

      const discountAmount = this.calculateDiscount(finalPrice, loggedIn);
      const finalPriceAfterDiscount = finalPrice - discountAmount;
      const bookingHours = this.calculateHoursFromBookingType(bookingType);

      // Calculate available dates
      const availableDates = this.calculateAvailableDates(newCheckIn, newCheckOut, bookingType);

      // Generate invoice token
      const invoiceToken = this.generateInvoiceToken();

      // Calculate initial booking status
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const checkInOnlyDate = new Date(newCheckIn);
      checkInOnlyDate.setHours(0, 0, 0, 0);

      const checkOutOnlyDate = new Date(newCheckOut);
      checkOutOnlyDate.setHours(0, 0, 0, 0);

      let initialBookingStatus: 'upcoming' | 'current' | 'expired' = 'upcoming';

      if (checkInOnlyDate > today) {
        initialBookingStatus = 'upcoming';
      } else if (checkInOnlyDate <= today && checkOutOnlyDate >= today) {
        initialBookingStatus = 'current';
      } else if (checkOutOnlyDate < today) {
        initialBookingStatus = 'expired';
      }

      // Calculate next status check time
      let nextStatusCheckAt: Date | null = null;
      if (initialBookingStatus === 'upcoming') {
        nextStatusCheckAt = newCheckIn;
      } else if (initialBookingStatus === 'current') {
        nextStatusCheckAt = newCheckOut;
      }

      // Calculate remaining amount for partial payment
      let finalRemainingAmount = providedRemainingAmount;
      if (paymentStatus === 'partial' && finalRemainingAmount === undefined) {
        finalRemainingAmount = finalPriceAfterDiscount - paidAmount;
      }

      // Prepare booking data
      const bookingDataToCreate: any = {
        userId: finalUserId,
        farmhouseId,
        customerName: loggedIn ? null : customerName,
        customerMobile: loggedIn ? null : customerMobile,
        customerEmail: loggedIn ? null : customerEmail,
        bookingDate: newCheckIn,
        bookingEndDate: newCheckOut,
        bookingTimeFrom: finalBookingTimeFrom,
        bookingTimeTo: finalBookingTimeTo,
        bookingHours,
        numberOfPersons,
        bookingType,
        originalPrice: finalPrice,
        discountAmount,
        finalPrice: finalPriceAfterDiscount,
        isLoggedIn: finalIsLoggedIn,
        paymentStatus,
        farmStatus: paymentStatus === 'cancel' ? 'available' : 'unavailable',
        bookingStatus: initialBookingStatus,
        nextStatusCheckAt,
        invoiceToken,
      };

      // Add partial payment columns if payment is partial
      if (paymentStatus === 'partial') {
        bookingDataToCreate.partialPaidAmount = paidAmount;
        bookingDataToCreate.remainingAmount = finalRemainingAmount;
        bookingDataToCreate.partialPaymentDetails = {
          paidAmount,
          remainingAmount: finalRemainingAmount,
          updatedAt: new Date().toISOString()
        };
      }

      interface PaymentHistoryItem {
        status: 'paid' | 'partial' | 'incomplete' | 'cancel';
        amount: number;
        partialDetails?: {
          paidAmount: number;
          remainingAmount: number;
          updatedAt: string;
        };
        updatedAt: string;
      }

      interface PartialPaymentDetails {
        paidAmount: number;
        remainingAmount: number;
        updatedAt: string;
      }

      interface BookingDataWithHistory {
        paymentHistory?: PaymentHistoryItem[];
        lastPaymentUpdate?: string;
        partialPaymentDetails?: PartialPaymentDetails;
        [key: string]: any; // For other properties in bookingData
      }
      // Prepare bookingData with payment history
      const baseBookingData: BookingDataWithHistory = bookingData || {};
      const paymentHistory: PaymentHistoryItem[] = baseBookingData.paymentHistory || [];

      // Add initial payment record
      const initialPayment: PaymentHistoryItem = {
        status: paymentStatus,
        amount: finalPriceAfterDiscount,
        updatedAt: new Date().toISOString(),
      };

      if (paymentStatus === 'partial' && finalRemainingAmount !== undefined) {
        initialPayment.partialDetails = {
          paidAmount,
          remainingAmount: finalRemainingAmount,
          updatedAt: new Date().toISOString()
        };
      }

      paymentHistory.push(initialPayment);

      // Set bookingData with payment history
      bookingDataToCreate.bookingData = {
        ...baseBookingData,
        paymentHistory,
        lastPaymentUpdate: new Date().toISOString(),
      };

      // If partial payment, add partialPaymentDetails to bookingData
      if (paymentStatus === 'partial' && finalRemainingAmount !== undefined) {
        bookingDataToCreate.bookingData.partialPaymentDetails = {
          paidAmount,
          remainingAmount: finalRemainingAmount,
          updatedAt: new Date().toISOString()
        };
      }

      // Create booking
      const booking = await this.bookingModel.create(bookingDataToCreate);

      // Update user history
      await this.updateUserBookingHistory(
        finalUserId,
        farmhouseId,
        checkInOnlyDate.toISOString().split('T')[0],
        bookingType,
        finalPriceAfterDiscount
      );

      // Update most visited status
      await this.updateMostVisitedStatus(farmhouseId);

      // Get created booking with proper date formatting
      const createdBooking = await this.findById(booking.id);

      if (!createdBooking) {
        return new ApiResponse(true, 'Failed to retrieve created booking', null);
      }

      // Add partial payment details to response if applicable
      const responseData: any = {
        ...createdBooking.data,
        invoiceToken,
        availableDates,
      };

      if (paymentStatus === 'partial' && finalRemainingAmount !== undefined) {
        responseData.partialPayment = {
          paidAmount,
          remainingAmount: finalRemainingAmount,
          totalAmount: finalPriceAfterDiscount,
          updatedAt: new Date().toISOString()
        };
      }

      return new ApiResponse(
        false,
        'Booking created successfully' + (paymentStatus === 'partial' ? ` (₹${paidAmount} paid, ₹${finalRemainingAmount} remaining)` : ''),
        responseData
      );
    } catch (error: any) {
      let errorMessage = 'Error creating booking';
      let errorData: any = null;

      if (error.name === 'SequelizeValidationError') {
        const uniqueErrors = new Map<string, string>();
        error.errors?.forEach((err: any) => {
          if (!uniqueErrors.has(err.path)) {
            uniqueErrors.set(err.path, err.message);
          }
        });
        const validationErrors = Array.from(uniqueErrors.values()).join(', ');
        errorMessage = `Validation error: ${validationErrors}`;
        errorData = Array.from(uniqueErrors.entries()).map(([path, message]) => ({
          path,
          message,
        }));
      } else if (error.name === 'SequelizeUniqueConstraintError') {
        errorMessage = 'A booking with this information already exists';
        errorData = error.message;
      } else if (error.message) {
        errorMessage = error.message;
        errorData = error.message;
      } else {
        errorData = error;
      }

      return new ApiResponse(true, errorMessage, errorData);
    }
  }

  private getBookingDatesFromRecord(booking: any): {
    checkInDate: Date;
    checkOutDate: Date;
  } {
    let checkInDate: Date;
    let checkOutDate: Date;

    // Get check-in date - handle both Date object and string
    if (booking.bookingDate) {
      if (typeof booking.bookingDate === 'string') {
        // Parse string date (YYYY-MM-DD)
        const [year, month, day] = booking.bookingDate.split('-').map(Number);
        checkInDate = new Date(year, month - 1, day);
      } else if (booking.bookingDate instanceof Date) {
        checkInDate = new Date(booking.bookingDate);
      } else {
        const today = new Date();
        checkInDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      }
    } else {
      const today = new Date();
      checkInDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    // Get check-out date
    if (booking.bookingEndDate) {
      if (typeof booking.bookingEndDate === 'string') {
        const [year, month, day] = booking.bookingEndDate.split('-').map(Number);
        checkOutDate = new Date(year, month - 1, day);
      } else if (booking.bookingEndDate instanceof Date) {
        checkOutDate = new Date(booking.bookingEndDate);
      } else {
        // Calculate based on booking type
        checkOutDate = new Date(checkInDate);
        if (booking.bookingType?.includes('24HR')) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
      }
    } else {
      // Calculate check-out based on booking type
      checkOutDate = new Date(checkInDate);
      if (booking.bookingType?.includes('24HR')) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }
    }

    return { checkInDate, checkOutDate };
  }

  private calculateDateBasedStatus(
    checkInDate: Date,
    checkOutDate: Date,
    currentBookingStatus?: string
  ): 'upcoming' | 'current' | 'expired' {
    const today = new Date();
    // Set today to beginning of day (local time)
    today.setHours(0, 0, 0, 0);

    // Ensure dates are at beginning of day
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);

    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);

    // If check-in is in future
    if (checkIn > today) {
      return 'upcoming';
    }

    // If check-in is today or in past AND check-out is in future or today
    if (checkIn <= today && checkOut >= today) {
      return 'current';
    }

    // If check-out is in past
    if (checkOut < today) {
      return 'expired';
    }

    // Fallback to current database status
    return currentBookingStatus as any || 'upcoming';
  }

  async findById(id: number) {
    try {
      // ✅ Auto-check status before fetching
      await this.checkAndAutoUpdateStatus();

      const booking = await this.bookingModel.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'mobileNo'],
            required: false,
          },
          {
            model: Farmhouse,
            as: 'farmhouse',
            attributes: ['id', 'name', 'slug', 'farmNo', 'checkInFrom', 'checkOutTo'],
          },
        ],
      });

      if (!booking) {
        return new ApiResponse(true, 'Booking not found', null);
      }

      const bookingData = booking.toJSON();
      const farmhouseData = bookingData.farmhouse;

      // Get dates using the helper method
      const { checkInDate, checkOutDate } = this.getBookingDatesFromRecord(bookingData);

      // Calculate date-based status
      const dateBasedStatus = this.calculateDateBasedStatus(
        checkInDate,
        checkOutDate,
        bookingData.bookingStatus
      );

      // Calculate payment amounts using safe parser
      const totalAmount = this.safeParseNumber(bookingData.finalPrice);
      const paidAmount = this.safeParseNumber(bookingData.partialPaidAmount);
      const remainingAmount = this.safeParseNumber(bookingData.remainingAmount, totalAmount);

      // Calculate final remaining amount
      const finalRemainingAmount = bookingData.remainingAmount !== undefined
        ? remainingAmount
        : Math.max(0, totalAmount - paidAmount);

      // Create partial payment object if payment status is partial
      let partialPayment: PartialPaymentResponse | null = null;
      if (bookingData.paymentStatus === 'partial') {
        partialPayment = {
          paidAmount: paidAmount,
          remainingAmount: finalRemainingAmount,
          totalAmount: totalAmount,
          notes: 'Partial payment details',
        };

        // Check if there are notes in bookingData or partialPaymentDetails
        if (bookingData.bookingData?.partialPaymentDetails?.notes) {
          partialPayment.notes = bookingData.bookingData.partialPaymentDetails.notes;
        }
      } else if (bookingData.paymentStatus === 'paid') {
        partialPayment = {
          paidAmount: totalAmount,
          remainingAmount: 0,
          totalAmount: totalAmount,
          notes: 'Full payment received',
        };
      }

      // Format dates for display (YYYY-MM-DD)
      const startDateStr = checkInDate.toISOString().split('T')[0];
      const endDateStr = checkOutDate.toISOString().split('T')[0];

      const formattedBooking = {
        id: bookingData.id,
        user: {
          id: bookingData.user?.id || null,
          name: bookingData.user?.name || bookingData.customerName || 'N/A',
          email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
          mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
        },
        farmhouse: {
          id: farmhouseData?.id,
          name: farmhouseData?.name,
          slug: farmhouseData?.slug,
          farmNo: farmhouseData?.farmNo,
          checkInFrom: farmhouseData?.checkInFrom || '10:00',
          checkOutTo: farmhouseData?.checkOutTo || '22:00',
        },
        startDate: startDateStr,
        endDate: endDateStr,
        checkInTime: bookingData.bookingTimeFrom,
        checkOutTime: bookingData.bookingTimeTo,
        numberOfPersons: bookingData.numberOfPersons,
        paymentStatus: bookingData.paymentStatus || 'incomplete',
        bookingStatus: dateBasedStatus,
        discountAmount: this.safeParseNumber(bookingData.discountAmount),
        finalTotal: totalAmount,
        originalPrice: this.safeParseNumber(bookingData.originalPrice),
        bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
        bookingType: bookingData.bookingType || 'REGULAR_12HR',
        invoiceToken: bookingData.invoiceToken,
        nextStatusCheckAt: bookingData.nextStatusCheckAt,
        // Add payment details
        paidAmount: paidAmount,
        remainingAmount: finalRemainingAmount,
        partialPayment: partialPayment,
        createdAt: bookingData.createdAt,
        updatedAt: bookingData.updatedAt,
      };

      return new ApiResponse(false, 'Booking fetched successfully', formattedBooking);
    } catch (error) {
      return new ApiResponse(true, 'Error fetching booking', error.message);
    }
  }

  // Get user orders (if logged in)
  async getUserOrders(userId: number) {
    try {
      // ✅ Auto-check status before fetching
      await this.checkAndAutoUpdateStatus();

      const bookings = await this.bookingModel.findAll({
        where: { userId },
        include: [
          {
            model: Farmhouse,
            as: 'farmhouse',
            attributes: ['id', 'name', 'slug', 'farmNo'],
          },
        ],
        order: [['bookingDate', 'DESC']],
      });

      const formattedBookings = bookings.map((booking: Booking) => {
        const bookingData = booking.toJSON();

        // Get dates for status calculation
        const { checkInDate, checkOutDate } = this.getBookingDatesFromRecord(bookingData);

        // ✅ Calculate date-based status
        const dateBasedStatus = this.calculateDateBasedStatus(
          checkInDate,
          checkOutDate,
          bookingData.bookingStatus
        );

        // Calculate payment amounts using safe parser
        const totalAmount = this.safeParseNumber(bookingData.finalPrice);
        const paidAmount = this.safeParseNumber(bookingData.partialPaidAmount);
        const remainingAmount = this.safeParseNumber(bookingData.remainingAmount, totalAmount);

        // Calculate final remaining amount
        const finalRemainingAmount = bookingData.remainingAmount !== undefined
          ? remainingAmount
          : Math.max(0, totalAmount - paidAmount);

        // Create partial payment object if payment status is partial
        let partialPayment: PartialPaymentResponse | null = null;
        if (bookingData.paymentStatus === 'partial') {
          partialPayment = {
            paidAmount: paidAmount,
            remainingAmount: finalRemainingAmount,
            totalAmount: totalAmount,
            notes: 'Partial payment details',
          };

          // Check if there are notes in bookingData
          if (bookingData.bookingData?.partialPaymentDetails?.notes) {
            partialPayment.notes = bookingData.bookingData.partialPaymentDetails.notes;
          }
        } else if (bookingData.paymentStatus === 'paid') {
          partialPayment = {
            paidAmount: totalAmount,
            remainingAmount: 0,
            totalAmount: totalAmount,
            notes: 'Full payment received',
          };
        }

        // Format dates for display
        const startDate = new Date(checkInDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(checkOutDate);
        endDate.setHours(0, 0, 0, 0);

        return {
          id: bookingData.id,
          farmhouse: {
            id: bookingData.farmhouse?.id,
            name: bookingData.farmhouse?.name,
            slug: bookingData.farmhouse?.slug,
            farmNo: bookingData.farmhouse?.farmNo,
          },
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          checkInTime: bookingData.bookingTimeFrom,
          checkOutTime: bookingData.bookingTimeTo,
          numberOfPersons: bookingData.numberOfPersons,
          paymentStatus: bookingData.paymentStatus || 'incomplete',
          bookingStatus: dateBasedStatus,
          discountAmount: this.safeParseNumber(bookingData.discountAmount),
          finalTotal: totalAmount,
          originalPrice: this.safeParseNumber(bookingData.originalPrice),
          bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
          bookingType: bookingData.bookingType || 'REGULAR_12HR',
          invoiceToken: bookingData.invoiceToken,
          nextStatusCheckAt: bookingData.nextStatusCheckAt,
          // Add payment details
          paidAmount: paidAmount,
          remainingAmount: finalRemainingAmount,
          partialPayment: partialPayment,
          createdAt: bookingData.createdAt,
        };
      });

      return new ApiResponse(false, 'User orders fetched successfully', formattedBookings);
    } catch (error) {
      return new ApiResponse(true, 'Error fetching user orders', error.message);
    }
  }

  // Get available farms for a specific date
  async getAvailableFarms(bookingDate?: string, bookingType?: string) {
    try {
      // ✅ Auto-check status before fetching (for any active bookings)
      await this.checkAndAutoUpdateStatus();

      if (!bookingDate) {
        const allFarms = await this.farmhouseModel.findAll({
          where: { status: true },
          include: [
            { model: PriceOption, as: 'priceOptions' },
            { model: Location, as: 'location' },
            {
              model: FarmhouseImage,
              as: 'images',
              attributes: ['id', 'imagePath', 'isMain', 'ordering'],
              separate: true,
              order: [['ordering', 'ASC'], ['isMain', 'DESC']],
              limit: 1,
            },
          ],
        });

        const farms = allFarms.map((farm: any) => {
          const farmData = farm.toJSON();
          return {
            id: farmData.id,
            name: farmData.name,
            slug: farmData.slug,
            farmNo: farmData.farmNo,
            maxPersons: farmData.maxPersons,
            bedrooms: farmData.bedrooms,
            location: farmData.location
              ? {
                city: farmData.location.city,
                address: farmData.location.address,
              }
              : null,
            image: farmData.images?.[0]
              ? `uploads/farm-product/${farmData.images[0].imagePath}`
              : null,
            price: null,
            priceOptions:
              farmData.priceOptions?.map((p: any) => ({
                category: p.category,
                price: parseFloat(p.price.toString()),
                maxPeople: p.maxPeople,
              })) || [],
          };
        });

        return new ApiResponse(false, 'All farms fetched successfully', {
          bookingDate: null,
          bookingType: bookingType || 'all',
          availableFarms: farms,
          totalAvailable: farms.length,
          totalFarms: farms.length,
        });
      }

      const date = new Date(bookingDate);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);

      const allFarms = await this.farmhouseModel.findAll({
        where: { status: true },
        include: [
          { model: PriceOption, as: 'priceOptions' },
          { model: Location, as: 'location' },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            separate: true,
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
            limit: 1,
          },
        ],
      });

      const bookings = await this.bookingModel.findAll({
        where: {
          paymentStatus: { [Op.ne]: 'cancel' },
          [Op.or]: [
            {
              bookingType: { [Op.like]: '%24HR%' },
              [Op.or]: [
                { bookingDate: { [Op.gte]: date, [Op.lt]: nextDay } },
                { bookingEndDate: { [Op.gte]: date, [Op.lt]: nextDay } },
                { bookingDate: { [Op.lte]: date }, bookingEndDate: { [Op.gte]: nextDay } },
              ],
            },
            {
              bookingType: { [Op.like]: '%12HR%' },
              bookingDate: { [Op.gte]: date, [Op.lt]: nextDay },
            },
          ],
        },
        attributes: ['farmhouseId', 'bookingType', 'bookingDate', 'bookingEndDate', 'bookingTimeFrom', 'bookingTimeTo'],
      });

      const bookedFarmhouseIds = new Set<number>();

      bookings.forEach((booking: any) => {
        const bookingData = booking.toJSON();
        const is24Hour = bookingData.bookingType?.includes('24HR');

        const bookingStartDate = new Date(bookingData.bookingDate);
        bookingStartDate.setHours(0, 0, 0, 0);
        const bookingDateStr = bookingStartDate.toISOString().split('T')[0];
        const requestedDateStr = dateStr;

        if (is24Hour) {
          if (bookingDateStr === requestedDateStr) {
            bookedFarmhouseIds.add(bookingData.farmhouseId);
          }

          if (bookingData.bookingEndDate) {
            const bookingEndDate = new Date(bookingData.bookingEndDate);
            bookingEndDate.setHours(0, 0, 0, 0);
            const bookingEndDateStr = bookingEndDate.toISOString().split('T')[0];

            if (bookingEndDateStr === requestedDateStr && bookingDateStr !== requestedDateStr) {
              const [checkoutHour, checkoutMinute] = (bookingData.bookingTimeTo || '12:00').split(':').map(Number);
              const now = new Date();
              const checkoutTime = new Date(date);
              checkoutTime.setHours(checkoutHour, checkoutMinute, 0, 0);

              if (now < checkoutTime) {
                bookedFarmhouseIds.add(bookingData.farmhouseId);
              }
            }
          }
        } else {
          if (bookingDateStr === requestedDateStr) {
            bookedFarmhouseIds.add(bookingData.farmhouseId);
          }
        }
      });

      const availableFarms = allFarms
        .filter(farm => !bookedFarmhouseIds.has(farm.id))
        .map((farm: any) => {
          const farmData = farm.toJSON();
          const priceOption = farmData.priceOptions?.find(
            (p: any) => !bookingType || p.category === bookingType,
          );

          return {
            id: farmData.id,
            name: farmData.name,
            slug: farmData.slug,
            farmNo: farmData.farmNo,
            maxPersons: farmData.maxPersons,
            bedrooms: farmData.bedrooms,
            location: farmData.location
              ? {
                city: farmData.location.city,
                address: farmData.location.address,
              }
              : null,
            image: farmData.images?.[0]
              ? `uploads/farm-product/${farmData.images[0].imagePath}`
              : null,
            price: priceOption ? parseFloat(priceOption.price.toString()) : null,
            priceOptions:
              farmData.priceOptions?.map((p: any) => ({
                category: p.category,
                price: parseFloat(p.price.toString()),
                maxPeople: p.maxPeople,
              })) || [],
          };
        });

      return new ApiResponse(false, 'Available farms fetched successfully', {
        bookingDate,
        bookingType: bookingType || 'all',
        availableFarms,
        totalAvailable: availableFarms.length,
        totalFarms: allFarms.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching available farms', error.message);
    }
  }

  // Get most booked farms
  async getMostBookedFarms(query: { limit?: number; dateFrom?: string; dateTo?: string }) {
    try {
      const { limit = 10, dateFrom, dateTo } = query || {};

      const where: any = { paymentStatus: { [Op.ne]: 'cancel' } };
      if (dateFrom && dateTo) {
        where.bookingDate = { [Op.between]: [new Date(dateFrom), new Date(dateTo)] };
      } else if (dateFrom) {
        where.bookingDate = { [Op.gte]: new Date(dateFrom) };
      } else if (dateTo) {
        where.bookingDate = { [Op.lte]: new Date(dateTo) };
      }

      const rows: any[] = await (this.bookingModel as any).findAll({
        attributes: [
          'farmhouseId',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'bookingCount'],
        ],
        where,
        group: ['farmhouseId'],
        order: [[Sequelize.literal('bookingCount'), 'DESC']],
        limit: Number(limit),
        include: [
          {
            model: this.farmhouseModel,
            as: 'farmhouse',
            attributes: ['id', 'name', 'slug', 'farmNo'],
            required: true,
          },
        ],
      });

      const data = rows.map(r => {
        const json = r.toJSON ? r.toJSON() : r;
        return {
          farmhouseId: json.farmhouseId,
          bookingCount: Number(json.bookingCount || 0),
          farmhouse: json.farmhouse || null,
        };
      });

      return new ApiResponse(false, 'Most booked farms fetched', data);
    } catch (err: any) {
      return new ApiResponse(true, 'Error fetching most booked farms', err.message);
    }
  }

  // Get farm availability
  async getFarmAvailability(farmhouseId: number) {
    try {
      // ✅ Auto-check status before fetching
      await this.checkAndAutoUpdateStatus();

      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId, {
        include: [
          { model: Location, as: 'location' },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            separate: true,
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
            limit: 1,
          },
          { model: PriceOption, as: 'priceOptions' },
        ],
      });

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const bookings = await this.bookingModel.findAll({
        where: { farmhouseId, paymentStatus: { [Op.ne]: 'cancel' } },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'mobileNo'],
            required: false,
          },
        ],
        attributes: [
          'id', 'userId', 'customerName', 'customerMobile', 'customerEmail',
          'bookingDate', 'bookingEndDate', 'bookingTimeFrom', 'bookingTimeTo',
          'bookingHours', 'numberOfPersons', 'bookingType',
          'partialPaidAmount', 'remainingAmount', 'bookingData',
          'originalPrice', 'discountAmount', 'finalPrice', 'paymentStatus', 'farmStatus',
          'isLoggedIn', 'invoiceToken', 'bookingStatus', 'nextStatusCheckAt', // ✅ Add new fields
          'createdAt', 'updatedAt',
        ],
        order: [['bookingDate', 'DESC']],
      });

      const bookedDates = bookings.map((booking: any) => {
        const bookingData = booking.toJSON();

        // Get dates for status calculation
        const { checkInDate, checkOutDate } = this.getBookingDatesFromRecord(bookingData);

        // ✅ Calculate date-based status
        const dateBasedStatus = this.calculateDateBasedStatus(
          checkInDate,
          checkOutDate,
          bookingData.bookingStatus
        );

        // Payment breakdown
        const totalAmount = this.safeParseNumber(bookingData.finalPrice);
        const paidAmount = this.safeParseNumber(bookingData.partialPaidAmount);
        const remainingAmountRaw = this.safeParseNumber(bookingData.remainingAmount, totalAmount);
        const finalRemainingAmount = bookingData.remainingAmount !== undefined
          ? remainingAmountRaw
          : Math.max(0, totalAmount - paidAmount);

        let partialPayment: PartialPaymentResponse | null = null;
        if (bookingData.paymentStatus === 'partial') {
          partialPayment = {
            paidAmount,
            remainingAmount: finalRemainingAmount,
            totalAmount,
            notes: bookingData.bookingData?.partialPaymentDetails?.notes || '',
          };
        } else if (bookingData.paymentStatus === 'paid') {
          partialPayment = {
            paidAmount: totalAmount,
            remainingAmount: 0,
            totalAmount,
            notes: 'Full payment received',
          };
        }

        return {
          id: bookingData.id,
          user: {
            id: bookingData.user?.id || null,
            name: bookingData.user?.name || bookingData.customerName || 'N/A',
            email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
            mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
          },
          startDate: checkInDate.toISOString().split('T')[0],
          endDate: checkOutDate.toISOString().split('T')[0],
          checkInTime: bookingData.bookingTimeFrom,
          checkOutTime: bookingData.bookingTimeTo,
          bookingHours: bookingData.bookingHours,
          numberOfPersons: bookingData.numberOfPersons,
          bookingType: bookingData.bookingType,
          bookingStatus: dateBasedStatus, // ✅ Use date-based status
          paymentStatus: bookingData.paymentStatus,
          farmStatus: bookingData.farmStatus,
          paidAmount,
          remainingAmount: finalRemainingAmount,
          partialPayment,
          originalPrice: parseFloat(bookingData.originalPrice?.toString() || '0'),
          discountAmount: parseFloat(bookingData.discountAmount?.toString() || '0'),
          finalPrice: parseFloat(bookingData.finalPrice?.toString() || '0'),
          isLoggedIn: bookingData.isLoggedIn || false,
          invoiceToken: bookingData.invoiceToken,
          nextStatusCheckAt: bookingData.nextStatusCheckAt,
          createdAt: bookingData.createdAt,
          updatedAt: bookingData.updatedAt,
        };
      });

      const farmhouseData = farmhouse.toJSON();

      return new ApiResponse(false, 'Farm availability fetched successfully', {
        farmhouse: {
          id: farmhouseData.id,
          name: farmhouseData.name,
          slug: farmhouseData.slug,
          farmNo: farmhouseData.farmNo,
          maxPersons: farmhouseData.maxPersons,
          bedrooms: farmhouseData.bedrooms,
          description: farmhouseData.description,
          checkInFrom: farmhouseData.checkInFrom,
          checkOutTo: farmhouseData.checkOutTo,
          status: farmhouseData.status,
          location: farmhouseData.location || null,
          image: farmhouseData.images?.[0]
            ? `uploads/farm-product/${farmhouseData.images[0].imagePath}`
            : null,
          priceOptions: farmhouseData.priceOptions?.map((p: any) => ({
            id: p.id,
            category: p.category,
            price: parseFloat(p.price.toString()),
            maxPeople: p.maxPeople,
          })) || [],
        },
        bookedDates,
        totalBookings: bookings.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching farm availability', error.message);
    }
  }

  // Get farms with status
  async getFarmsWithStatus(date?: string, page: number = 1, limit: number = 0) {
    try {
      // ✅ Auto-check status before fetching
      await this.checkAndAutoUpdateStatus();

      const now = date ? new Date(date) : new Date();

      const allFarms = await this.farmhouseModel.findAll({
        include: [
          { model: Location, as: 'location' },
          { model: PriceOption, as: 'priceOptions' },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            separate: true,
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
            limit: 1,
          },
        ],
      });

      const results: any[] = [];

      for (const farm of allFarms) {
        const f = farm.toJSON();

        const bookings = await this.bookingModel.findAll({
          where: {
            farmhouseId: f.id,
            paymentStatus: { [Op.ne]: 'cancel' },
          },
          order: [['bookingDate', 'ASC']],
        });

        let bookingStatus = 'Available';
        let bookingDateLabel = 'Available';

        for (const b of bookings) {
          const bd = b.toJSON();
          const ci = this.deriveCheckInFromRecord(bd);
          const co = this.deriveCheckOutFromRecord(bd);
          const nextAvailable = this.calculateNextAvailableDate(co, bd.bookingType || 'REGULAR_12HR');

          if (now < ci) {
            bookingStatus = 'Available';
            bookingDateLabel = `${ci.toISOString()} - ${co.toISOString()}`;
            break;
          }

          if (now >= ci && now < co) {
            bookingStatus = 'Booked';
            bookingDateLabel = `${ci.toISOString()} - ${co.toISOString()}`;
            break;
          }

          if (now >= nextAvailable) {
            continue;
          }
        }

        results.push({
          id: f.id,
          name: f.name,
          slug: f.slug,
          farmNo: f.farmNo,
          status: f.status ? 'Available' : 'Inactive',
          bookingDate: bookingDateLabel,
          bookingStatus,
          location: f.location || null,
          image: f.images?.[0] ? `uploads/farm-product/${f.images[0].imagePath}` : null,
        });
      }

      return new ApiResponse(false, 'Farms with status fetched successfully', {
        total: results.length,
        farms: results,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching farms with status', error.message);
    }
  }

  // Get invoice by token
  async getInvoiceByToken(token: string) {
    try {
      // ✅ Auto-check status before fetching
      await this.checkAndAutoUpdateStatus();

      const booking = await this.bookingModel.findOne({
        where: { invoiceToken: token },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'mobileNo'],
          },
          {
            model: Farmhouse,
            as: 'farmhouse',
            include: [{ model: Location, as: 'location' }],
          },
        ],
      });

      if (!booking) {
        return new ApiResponse(true, 'Invoice not found', null);
      }

      const bookingData: any = booking.toJSON();
      const { checkInDate, checkOutDate } = this.getBookingDatesFromRecord(bookingData);

      const dateBasedStatus = this.calculateDateBasedStatus(
        checkInDate,
        checkOutDate,
        bookingData.bookingStatus
      );

      const invoice = {
        invoiceToken: bookingData.invoiceToken,
        bookingId: bookingData.id,
        bookingDate: bookingData.bookingDate,
        bookingTimeFrom: bookingData.bookingTimeFrom,
        bookingTimeTo: bookingData.bookingTimeTo,
        bookingHours: bookingData.bookingHours,
        numberOfPersons: bookingData.numberOfPersons,
        bookingType: bookingData.bookingType,
        bookingStatus: dateBasedStatus, // ✅ Add booking status
        customer: {
          name: bookingData.user?.name || bookingData.customerName,
          email: bookingData.user?.email || bookingData.customerEmail,
          mobile: bookingData.user?.mobileNo || bookingData.customerMobile,
        },
        farmhouse: {
          id: bookingData.farmhouse.id,
          name: bookingData.farmhouse.name,
          farmNo: bookingData.farmhouse.farmNo,
          location: bookingData.farmhouse.location,
        },
        pricing: {
          originalPrice: parseFloat(bookingData.originalPrice.toString()),
          discountAmount: parseFloat(bookingData.discountAmount.toString()),
          finalPrice: parseFloat(bookingData.finalPrice.toString()),
        },
        paymentStatus: bookingData.paymentStatus,
        createdAt: bookingData.createdAt,
        bookingData: bookingData.bookingData,
      };

      return new ApiResponse(false, 'Invoice fetched successfully', invoice);
    } catch (error) {
      return new ApiResponse(true, 'Error fetching invoice', error.message);
    }
  }

  private safeParseNumber(value: any, defaultValue: number = 0): number {
    try {
      if (value === null || value === undefined) {
        return defaultValue;
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      }

      // Handle BigInt or other types
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    } catch {
      return defaultValue;
    }
  }
  // Find all bookings
  async findAll(queryDto: QueryBookingDto) {
    try {
      // ✅ CRITICAL: Auto-check and update statuses before fetching
      await this.checkAndAutoUpdateStatus();

      const {
        page = 1,
        limit = 10,
        farmhouseId,
        userId,
        paymentStatus,
        dateFrom,
        dateTo,
        search,
        bookingType
      } = queryDto;

      const offset = (page - 1) * limit;

      const where: any = {};

      if (farmhouseId) {
        where.farmhouseId = farmhouseId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      if (bookingType) {
        where.bookingType = bookingType;
      }

      if (dateFrom || dateTo) {
        where.bookingDate = {};
        if (dateFrom) {
          where.bookingDate[Op.gte] = new Date(dateFrom);
        }
        if (dateTo) {
          where.bookingDate[Op.lte] = new Date(dateTo);
        }
      }

      if (search) {
        const searchNum = this.safeParseNumber(search, -1);
        if (searchNum > 0) {
          where[Op.or] = [
            { id: searchNum },
            { '$user.id$': searchNum },
            { '$farmhouse.id$': searchNum },
            { customerName: { [Op.like]: `%${search}%` } },
            { customerEmail: { [Op.like]: `%${search}%` } },
            { customerMobile: { [Op.like]: `%${search}%` } },
            { invoiceToken: { [Op.like]: `%${search}%` } },
            // Search in partial payment amounts
            Sequelize.where(
              Sequelize.fn('CAST', Sequelize.col('partialPaidAmount')),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.fn('CAST', Sequelize.col('remainingAmount')),
              { [Op.like]: `%${search}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.name')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.email')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.mobileNo')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('farmhouse.name')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('farmhouse.slug')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
          ];
        } else {
          where[Op.or] = [
            { customerName: { [Op.like]: `%${search}%` } },
            { customerEmail: { [Op.like]: `%${search}%` } },
            { customerMobile: { [Op.like]: `%${search}%` } },
            { invoiceToken: { [Op.like]: `%${search}%` } },
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.name')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.email')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('user.mobileNo')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('farmhouse.name')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('farmhouse.slug')),
              { [Op.like]: `%${search.toLowerCase()}%` }
            ),
          ];
        }
      }

      const includeConditions = [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'mobileNo'],
          required: false,
        },
        {
          model: Farmhouse,
          as: 'farmhouse',
          attributes: ['id', 'name', 'slug', 'farmNo', 'checkInFrom', 'checkOutTo'],
          required: true,
        },
      ];

      const { count, rows } = await this.bookingModel.findAndCountAll({
        where,
        include: includeConditions,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      // ✅ Format bookings with payment details
      const formattedBookings = rows.map((booking: Booking) => {
        const bookingData = booking.toJSON();
        const farmhouseData = bookingData.farmhouse;

        // Get dates for status calculation
        const { checkInDate, checkOutDate } = this.getBookingDatesFromRecord(bookingData);

        // ✅ Calculate date-based status
        const dateBasedStatus = this.calculateDateBasedStatus(
          checkInDate,
          checkOutDate,
          bookingData.bookingStatus
        );

        // Calculate payment amounts using safe parser
        const totalAmount = this.safeParseNumber(bookingData.finalPrice);
        const paidAmount = this.safeParseNumber(bookingData.partialPaidAmount);
        const remainingAmount = this.safeParseNumber(bookingData.remainingAmount, totalAmount);

        // Calculate final remaining amount
        const finalRemainingAmount = bookingData.remainingAmount !== undefined
          ? remainingAmount
          : Math.max(0, totalAmount - paidAmount);



        // Create partial payment object if payment status is partial
        let partialPayment: PartialPaymentResponse | null = null;
        if (bookingData.paymentStatus === 'partial') {
          partialPayment = {
            paidAmount: paidAmount,
            remainingAmount: finalRemainingAmount,
            totalAmount: totalAmount,
            notes: 'Partial payment details',
          };

          // Check if there are notes in bookingData or partialPaymentDetails
          if (bookingData.bookingData?.partialPaymentDetails?.notes) {
            partialPayment.notes = bookingData.bookingData.partialPaymentDetails.notes;
          }
        } else if (bookingData.paymentStatus === 'paid') {
          partialPayment = {
            paidAmount: totalAmount,
            remainingAmount: 0,
            totalAmount: totalAmount,
            notes: 'Full payment received',
          };
        }

        return {
          id: bookingData.id,
          user: {
            id: bookingData.user?.id || null,
            name: bookingData.user?.name || bookingData.customerName || 'N/A',
            email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
            mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
          },
          farmhouse: {
            id: farmhouseData?.id,
            name: farmhouseData?.name,
            slug: farmhouseData?.slug,
            farmNo: farmhouseData?.farmNo,
            checkInFrom: farmhouseData?.checkInFrom || '10:00',
            checkOutTo: farmhouseData?.checkOutTo || '22:00',
          },
          startDate: checkInDate.toISOString().split('T')[0],
          endDate: checkOutDate.toISOString().split('T')[0],
          checkInTime: bookingData.bookingTimeFrom,
          checkOutTime: bookingData.bookingTimeTo,
          numberOfPersons: bookingData.numberOfPersons,
          paymentStatus: bookingData.paymentStatus || 'incomplete',
          bookingStatus: dateBasedStatus,
          discountAmount: this.safeParseNumber(bookingData.discountAmount),
          finalTotal: totalAmount,
          originalPrice: this.safeParseNumber(bookingData.originalPrice),
          bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
          bookingType: bookingData.bookingType || 'REGULAR_12HR',
          invoiceToken: bookingData.invoiceToken,
          nextStatusCheckAt: bookingData.nextStatusCheckAt,
          // Add payment details
          paidAmount: paidAmount,
          remainingAmount: finalRemainingAmount,
          partialPayment: partialPayment,
          createdAt: bookingData.createdAt,
          updatedAt: bookingData.updatedAt,
        };
      });

      // Calculate summary statistics
      const totalRevenue = formattedBookings.reduce((sum, booking) => sum + booking.finalTotal, 0);
      const totalPaid = formattedBookings.reduce((sum, booking) => sum + booking.paidAmount, 0);
      const totalRemaining = formattedBookings.reduce((sum, booking) => sum + booking.remainingAmount, 0);

      const paymentStatusBreakdown = formattedBookings.reduce((acc, booking) => {
        const status = booking.paymentStatus || 'incomplete';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return new ApiResponse(false, 'Bookings fetched successfully', {
        bookings: formattedBookings,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        summary: {
          totalBookings: count,
          totalRevenue,
          totalPaid,
          totalRemaining,
          paymentStatusBreakdown,
        }
      });
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return new ApiResponse(true, 'Error fetching bookings', error.message);
    }
  }
  // Get farm statistics
  async getFarmStatistics(farmhouseId: number) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId);
      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const allBookings = await this.bookingModel.findAll({
        where: {
          farmhouseId,
          paymentStatus: { [Op.ne]: 'cancel' },
        },
      });

      const totalOrders = allBookings.length;
      const totalIncome = allBookings.reduce((sum, booking) => {
        return sum + parseFloat(booking.finalPrice.toString());
      }, 0);

      const paidOrders = allBookings.filter(b => b.paymentStatus === 'paid').length;
      const partialOrders = allBookings.filter(b => b.paymentStatus === 'partial').length;
      const incompleteOrders = allBookings.filter(b => b.paymentStatus === 'incomplete').length;

      return new ApiResponse(false, 'Farm statistics fetched successfully', {
        farmhouseId,
        farmhouseName: farmhouse.name,
        totalOrders,
        totalIncome,
        paidOrders,
        partialOrders,
        incompleteOrders,
        bookings: allBookings.map(b => ({
          id: b.id,
          bookingDate: b.bookingDate,
          bookingType: b.bookingType,
          originalPrice: b.originalPrice,
          discountAmount: b.discountAmount,
          finalPrice: b.finalPrice,
          paymentStatus: b.paymentStatus,
          bookingStatus: (b as any).bookingStatus, // ✅ Add booking status
          isLoggedIn: b.isLoggedIn,
        })),
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching farm statistics', error.message);
    }
  }

  // Update booking
  async update(id: number, updateBookingDto: UpdateBookingDto) {
    try {
      const booking = await this.bookingModel.findByPk(id);
      if (!booking) {
        return new ApiResponse(true, 'Booking not found', null);
      }

      const updateData: any = { ...updateBookingDto };

      if (updateBookingDto.originalPrice !== undefined) {
        const isLoggedIn = updateBookingDto.isLoggedIn ?? booking.isLoggedIn ?? false;
        const discountAmount = this.calculateDiscount(updateBookingDto.originalPrice, Boolean(isLoggedIn));
        const finalPrice = updateBookingDto.originalPrice - discountAmount;

        updateData.discountAmount = discountAmount;
        updateData.finalPrice = finalPrice;
      }

      await booking.update(updateData);

      // ✅ Auto-update status after update
      await this.checkAndAutoUpdateStatus();

      const updatedBooking = await this.findById(id);

      return new ApiResponse(false, 'Booking updated successfully', updatedBooking.data);
    } catch (error) {
      return new ApiResponse(true, 'Error updating booking', error.message);
    }
  }

  // Delete booking
  async remove(id: number) {
    try {
      const booking = await this.bookingModel.findByPk(id);
      if (!booking) {
        return new ApiResponse(true, 'Booking not found', null);
      }

      await booking.destroy();

      await this.updateMostVisitedStatus(booking.farmhouseId);

      return new ApiResponse(false, 'Booking deleted successfully', null);
    } catch (error) {
      return new ApiResponse(true, 'Error deleting booking', error.message);
    }
  }
  async updatePaymentStatus(id: number, updatePaymentStatusDto: UpdatePaymentStatusDto) {
    try {
      const { paymentStatus, paidAmount, remainingAmount, notes } = updatePaymentStatusDto;

      const booking = await this.bookingModel.findByPk(id);
      if (!booking) {
        return new ApiResponse(true, 'Booking not found', null);
      }

      const existingBookingData = booking.bookingData || {};

      // Validate partial payment
      if (paymentStatus === 'partial') {
        if (!paidAmount || paidAmount <= 0) {
          return new ApiResponse(true, 'For partial payment, paid amount is required', null);
        }

        if (paidAmount > booking.finalPrice) {
          return new ApiResponse(true, 'Paid amount cannot exceed total price', null);
        }

        if (!remainingAmount || remainingAmount < 0) {
          return new ApiResponse(true, 'Valid remaining amount is required for partial payment', null);
        }
      }

      const paymentHistory = existingBookingData.paymentHistory || [];

      // Create partial payment object if partial status
      const partialPaymentDetails = paymentStatus === 'partial' ? {
        paidAmount,
        remainingAmount,
        notes,
        updatedAt: new Date().toISOString()
      } : null;

      // Add to payment history
      paymentHistory.push({
        fromStatus: booking.paymentStatus,
        toStatus: paymentStatus,
        partialDetails: partialPaymentDetails,
        updatedAt: new Date().toISOString(),
      });

      const updateData: any = {
        paymentStatus,
        bookingData: {
          ...existingBookingData,
          paymentHistory,
          lastPaymentUpdate: new Date().toISOString(),
        },
      };

      // Store partial payment details separately if partial
      if (paymentStatus === 'partial' && partialPaymentDetails) {
        updateData.bookingData.partialPaymentDetails = partialPaymentDetails;

        // Update separate fields if they exist in your model
        if (this.bookingModel.rawAttributes.partialPaidAmount) {
          updateData.partialPaidAmount = paidAmount;
        }
        if (this.bookingModel.rawAttributes.remainingAmount) {
          updateData.remainingAmount = remainingAmount;
        }
      }

      // Update farm status based on payment status
      if (paymentStatus === 'paid') {
        updateData.farmStatus = 'unavailable';
        if (booking.userId) {
          updateData.isLoggedIn = true;
        }
      }
      else if (paymentStatus === 'partial') {
        updateData.farmStatus = 'unavailable'; // Farm is still booked for partial payment
        if (booking.userId) {
          updateData.isLoggedIn = true;
        }
      }
      else if (paymentStatus === 'cancel') {
        updateData.farmStatus = 'available';
      }

      await booking.update(updateData);

      // ✅ Auto-update status after payment update
      await this.checkAndAutoUpdateStatus();

      const updatedBooking = await this.findById(id);

      // Prepare response with payment details
      const responseData = {
        ...updatedBooking.data,
        previousStatus: booking.paymentStatus,
        newStatus: paymentStatus,
        updatedAt: new Date().toISOString(),
      };

      // Add partial payment details to response if applicable
      if (paymentStatus === 'partial' && partialPaymentDetails) {
        responseData.partialPayment = {
          paidAmount: partialPaymentDetails.paidAmount,
          remainingAmount: partialPaymentDetails.remainingAmount,
          totalAmount: parseFloat(booking.finalPrice.toString()),
          notes: partialPaymentDetails.notes || ''
        };
      }

      return new ApiResponse(
        false,
        `Payment status updated to ${paymentStatus}${paymentStatus === 'partial' ? ` (₹${paidAmount} paid)` : ''}`,
        responseData
      );
    } catch (error) {
      return new ApiResponse(true, 'Error updating payment status', error.message);
    }
  }

  // =================== ADMIN METHODS (Optional) ===================

  /**
   * Manual trigger for cron job (Admin only)
   */
  async triggerAutoUpdate(): Promise<ApiResponse<any>> {
    try {
      await this.bookingCronService.autoUpdateBookingStatus();
      return new ApiResponse(false, 'Auto update triggered successfully', {
        timestamp: new Date().toISOString(),
        message: 'Cron job executed successfully'
      });
    } catch (error) {
      return new ApiResponse(true, 'Error triggering auto update', error.message);
    }
  }

  /**
   * Get system status (for monitoring)
   */
  async getSystemStatus(): Promise<ApiResponse<any>> {
    try {
      const now = new Date();
      const totalBookings = await this.bookingModel.count();

      const upcomingBookings = await this.bookingModel.count({
        where: { bookingStatus: 'upcoming' }
      });

      const currentBookings = await this.bookingModel.count({
        where: { bookingStatus: 'current' }
      });

      const expiredBookings = await this.bookingModel.count({
        where: { bookingStatus: 'expired' }
      });

      const bookingsToUpdate = await this.bookingModel.count({
        where: {
          nextStatusCheckAt: {
            [Op.lte]: now,
            [Op.ne]: null
          },
          bookingStatus: { [Op.in]: ['upcoming', 'current'] }
        }
      });

      return new ApiResponse(false, 'System status fetched', {
        timestamp: now.toISOString(),
        totalBookings,
        upcomingBookings,
        currentBookings,
        expiredBookings,
        bookingsToUpdate,
        nextAutoUpdate: new Date(now.getTime() + 5 * 60 * 1000), // Next 5 minutes
        systemStatus: 'healthy'
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching system status', error.message);
    }
  }
}