import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking) private readonly bookingModel: typeof Booking,
    @InjectModel(Farmhouse) private readonly farmhouseModel: typeof Farmhouse,
    @InjectModel(PriceOption) private readonly priceOptionModel: typeof PriceOption,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

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

  // Calculate available dates based on booking (not stored in DB)
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
    
    // Start date is always booked
    bookedDates.push(start.toISOString().split('T')[0]);
    
    if (is24Hour) {
      // For 24HR bookings: end date (checkout day) is available
      if (end.getTime() !== start.getTime()) {
        availableDates.push(end.toISOString().split('T')[0]);
      }
    } else {
      // For 12HR bookings: next day after start date is available
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      availableDates.push(nextDay.toISOString().split('T')[0]);
    }
    
    return {
      bookedDates,
      availableDates,
    };
  }

  // Validate and calculate checkout time and end date based on booking type
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

      // Parse time from string (format: HH:MM)
      const [hours, minutes] = bookingTimeFrom.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { isValid: false, error: 'Invalid booking time format. Use HH:MM format' };
      }

      let checkoutDate = new Date(bookingDateOnly);
      let checkoutHours = hours;
      let checkoutMinutes = minutes;

      if (is24Hour) {
        // For 24-hour booking: checkout is next day at the same time
        checkoutDate.setDate(checkoutDate.getDate() + 1);
      } else if (is12Hour) {
        // For 12-hour booking: checkout is same day, 12 hours later
        checkoutHours = hours + 12;
        if (checkoutHours >= 24) {
          checkoutHours -= 24;
          checkoutDate.setDate(checkoutDate.getDate() + 1);
        } else {
          // For 12HR bookings, end date is same as start date (unless checkout crosses midnight)
          // Keep checkoutDate as the same day
        }
      }

      // Format checkout time as HH:MM
      const calculatedCheckoutTime = `${checkoutHours.toString().padStart(2, '0')}:${checkoutMinutes.toString().padStart(2, '0')}`;

      // For 12HR bookings, ensure end date is same as start date (unless checkout time crosses midnight)
      if (is12Hour && checkoutHours < hours) {
        // Checkout crossed midnight, so end date is next day
        // checkoutDate is already set correctly
      } else if (is12Hour) {
        // Checkout is same day, so end date should be same as start date
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

    // Check if number of persons exceeds maxPeople
    if (numberOfPersons > priceOption.maxPeople) {
      throw new BadRequestException(`Maximum ${priceOption.maxPeople} persons allowed for this booking type`);
    }

    return parseFloat(priceOption.price.toString());
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
        farmStatus = 'available',
        bookingData,
      } = createBookingDto;

      // Check if user exists (by userId or reqUser)
      let finalUserId: number | null = null;
      let finalIsLoggedIn = false;
      
      // If userId is provided, check if user exists
      if (userId) {
        const existingUser = await this.userModel.findByPk(userId);
        if (existingUser) {
          finalUserId = userId;
          finalIsLoggedIn = true; // User exists, so they are logged in
        }
      }
      
      // If reqUser is provided, use that
      if (!finalUserId && reqUser && reqUser.id) {
        finalUserId = reqUser.id;
        finalIsLoggedIn = true;
      }
      
      // If user doesn't exist, create new user with isLoggedIn: false
      if (!finalUserId) {
        if (!customerName || (!customerMobile && !customerEmail)) {
          return new ApiResponse(true, 'Customer name and at least one of mobile/email are required', null);
        }
        
        const user = await this.findOrCreateUser(customerName, customerMobile, customerEmail);
        finalUserId = user.id;
        finalIsLoggedIn = false; // New user created, not logged in
      }
      
      // Override with provided isLoggedIn if explicitly set
      if (isLoggedIn !== undefined && isLoggedIn !== null) {
        finalIsLoggedIn = isLoggedIn;
      }
      
      const loggedIn = finalIsLoggedIn;

      // Check if farmhouse exists
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId, {
        include: [
          {
            model: PriceOption,
            as: 'priceOptions',
          },
        ],
      });
      
      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      // Check if farmhouse is available
      if (farmhouse.status === false) {
        return new ApiResponse(true, 'Farmhouse is not available', null);
      }

      // Validate and calculate checkout time and end date based on booking type
      const timeValidation = this.validateAndCalculateCheckoutTime(
        bookingDate,
        bookingTimeFrom,
        bookingType
      );

      if (!timeValidation.isValid) {
        return new ApiResponse(true, timeValidation.error || 'Invalid booking time', null);
      }

      // Use calculated checkout time if provided, otherwise use the provided one
      const finalBookingTimeTo = timeValidation.calculatedCheckoutTime || bookingTimeTo || '22:00';
      let bookingEndDate = timeValidation.calculatedEndDate || new Date(bookingDate);
      
      // For 12HR bookings, if checkout doesn't cross midnight, end date should be same as start date
      const is24Hour = bookingType.includes('24HR');
      if (!is24Hour) {
        const startDate = new Date(bookingDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(bookingEndDate);
        endDate.setHours(0, 0, 0, 0);
        
        // Check if checkout time crosses midnight
        const [checkoutHour] = finalBookingTimeTo.split(':').map(Number);
        const [checkinHour] = bookingTimeFrom.split(':').map(Number);
        
        // If checkout hour is less than check-in hour, it crossed midnight
        if (checkoutHour >= checkinHour) {
          // Same day checkout, end date = start date
          bookingEndDate = new Date(startDate);
        }
      }

      // Check if dates are already booked (only for 24HR bookings)
      if (is24Hour) {
        const startDate = new Date(bookingDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(bookingEndDate);
        endDate.setHours(23, 59, 59, 999);

        // Check for overlapping bookings on the start date
        const existingBooking = await this.bookingModel.findOne({
          where: {
            farmhouseId,
            bookingDate: {
              [Op.between]: [startDate, endDate],
            },
            paymentStatus: { [Op.ne]: 'cancel' },
            bookingType: { [Op.like]: '%24HR%' },
          },
        });

        if (existingBooking) {
          return new ApiResponse(true, 'This date is already booked', null);
        }
      } else {
        // For 12HR bookings, check only the booking date
        const existingBooking = await this.bookingModel.findOne({
          where: {
            farmhouseId,
            bookingDate: new Date(bookingDate),
            paymentStatus: { [Op.ne]: 'cancel' },
          },
        });

        if (existingBooking) {
          return new ApiResponse(true, 'This date is already booked', null);
        }
      }

      // Get price from farm's price options if not provided, otherwise use provided price
      let finalPrice = originalPrice;
      if (!originalPrice || originalPrice === 0) {
        finalPrice = await this.getPriceFromFarm(farmhouseId, bookingType, numberOfPersons);
      }

      // Calculate discount
      const discountAmount = this.calculateDiscount(finalPrice, loggedIn);
      const finalPriceAfterDiscount = finalPrice - discountAmount;

      // Calculate hours from booking type
      const bookingHours = this.calculateHoursFromBookingType(bookingType);

      // Calculate available dates (not stored in DB, just for response)
      const availableDates = this.calculateAvailableDates(
        new Date(bookingDate),
        bookingEndDate,
        bookingType
      );

      // Generate invoice token
      const invoiceToken = this.generateInvoiceToken();

      // Create booking
      const booking = await this.bookingModel.create({
        userId: finalUserId,
        farmhouseId,
        customerName: loggedIn ? null : customerName,
        customerMobile: loggedIn ? null : customerMobile,
        customerEmail: loggedIn ? null : customerEmail,
        bookingDate: new Date(bookingDate),
        bookingEndDate: bookingEndDate,
        bookingTimeFrom,
        bookingTimeTo: finalBookingTimeTo,
        bookingHours,
        numberOfPersons,
        bookingType,
        originalPrice: finalPrice,
        discountAmount,
        finalPrice: finalPriceAfterDiscount,
        isLoggedIn: finalIsLoggedIn, // Always set to boolean value
        paymentStatus,
        farmStatus: is24Hour ? 'unavailable' : 'available', // Mark as unavailable only for 24HR bookings
        bookingData,
        invoiceToken,
      } as any);

      // Update user booking history
      await this.updateUserBookingHistory(finalUserId, farmhouseId, bookingDate, bookingType, finalPriceAfterDiscount);

      // Update farmhouse most visited status
      await this.updateMostVisitedStatus(farmhouseId);

      // Fetch complete booking with relations
      const createdBooking = await this.findById(booking.id);

      return new ApiResponse(false, 'Booking created successfully', {
        ...createdBooking.data,
        invoiceToken, // Return token for immediate access
        availableDates, // Available dates (not stored in DB)
      });
    } catch (error) {
      // Provide more detailed error messages
      let errorMessage = 'Error creating booking';
      let errorData: any = null;
      
      if (error.name === 'SequelizeValidationError') {
        // Get unique error messages (avoid duplicates)
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
      }
      
      return new ApiResponse(true, errorMessage, errorData);
    }
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

      // Get existing booking history or initialize
      const bookingHistory: any[] = (user as any).bookingHistory || [];

      // Add new booking entry
      bookingHistory.push({
        farmhouseId,
        bookingDate,
        bookingType,
        rent,
        bookedAt: new Date().toISOString(),
      });

      // Update user
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
      // Count bookings for this farmhouse
      const bookingCount = await this.bookingModel.count({
        where: {
          farmhouseId,
          paymentStatus: { [Op.ne]: 'cancel' },
        },
      });

      // Get all farmhouses and their booking counts
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

      // Find the farmhouse with most bookings
      const maxCount = Math.max(...farmhouseCounts.map(f => f.count));
      const mostVisitedFarmId = farmhouseCounts.find(f => f.count === maxCount)?.id;

      // Update all farmhouses
      for (const farm of allFarmhouses) {
        await farm.update({
          isMostVisited: farm.id === mostVisitedFarmId && maxCount > 0,
        } as any);
      }
    } catch (error) {
      console.error('Error updating most visited status:', error);
    }
  }

  // Get booking by ID
  async findById(id: number) {
    try {
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
            attributes: ['id', 'name', 'slug', 'farmNo'],
          },
        ],
      });

      if (!booking) {
        return new ApiResponse(true, 'Booking not found', null);
      }

      // Format booking with all requested details
      const bookingData = booking.toJSON();
      const startDate = new Date(bookingData.bookingDate);
      startDate.setHours(0, 0, 0, 0);
      
      // For end date, if it exists use it, otherwise use start date
      let endDate = startDate;
      if (bookingData.bookingEndDate) {
        endDate = new Date(bookingData.bookingEndDate);
        endDate.setHours(0, 0, 0, 0);
      } else {
        // If no end date, for 12HR it's same day, for 24HR it's next day
        const is24Hour = bookingData.bookingType?.includes('24HR');
        if (is24Hour) {
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
        }
      }

      const formattedBooking = {
        id: bookingData.id,
        user: {
          id: bookingData.user?.id || null,
          name: bookingData.user?.name || bookingData.customerName || 'N/A',
          email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
          mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
        },
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
        paymentStatus: bookingData.paymentStatus,
        discountAmount: parseFloat(bookingData.discountAmount?.toString() || '0'),
        finalTotal: parseFloat(bookingData.finalPrice?.toString() || '0'),
        originalPrice: parseFloat(bookingData.originalPrice?.toString() || '0'),
        bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
        bookingType: bookingData.bookingType,
        invoiceToken: bookingData.invoiceToken,
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
      const bookings = await this.bookingModel.findAll({
        where: {
          userId,
        },
        include: [
          {
            model: Farmhouse,
            as: 'farmhouse',
            attributes: ['id', 'name', 'slug', 'farmNo'],
          },
        ],
        order: [['bookingDate', 'DESC']],
      });

      // Format bookings with all requested details
      const formattedBookings = bookings.map((booking: any) => {
        const bookingData = booking.toJSON();
        const startDate = new Date(bookingData.bookingDate);
        startDate.setHours(0, 0, 0, 0);
        
        // For end date, if it exists use it, otherwise calculate based on booking type
        let endDate = startDate;
        if (bookingData.bookingEndDate) {
          endDate = new Date(bookingData.bookingEndDate);
          endDate.setHours(0, 0, 0, 0);
        } else {
          // If no end date, for 12HR it's same day, for 24HR it's next day
          const is24Hour = bookingData.bookingType?.includes('24HR');
          if (is24Hour) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
          }
        }

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
          paymentStatus: bookingData.paymentStatus,
          discountAmount: parseFloat(bookingData.discountAmount?.toString() || '0'),
          finalTotal: parseFloat(bookingData.finalPrice?.toString() || '0'),
          originalPrice: parseFloat(bookingData.originalPrice?.toString() || '0'),
          bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
          bookingType: bookingData.bookingType,
          invoiceToken: bookingData.invoiceToken,
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
    // If no date → return all active farms directly
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
            ? `/uploads/farm-product/${farmData.images[0].imagePath}`
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

    // 🟦 If date exists → check availability based on booking type
    const date = new Date(bookingDate);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
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

    // Get all bookings that could affect availability for this date
    // For 24HR bookings: check if booking date or end date overlaps with requested date
    // For 12HR bookings: only check if booking date matches
    const bookings = await this.bookingModel.findAll({
      where: {
        paymentStatus: { [Op.ne]: 'cancel' },
        [Op.or]: [
          // 24HR bookings: check if start date or end date overlaps
          {
            bookingType: { [Op.like]: '%24HR%' },
            [Op.or]: [
              {
                bookingDate: {
                  [Op.gte]: date,
                  [Op.lt]: nextDay,
                },
              },
              {
                bookingEndDate: {
                  [Op.gte]: date,
                  [Op.lt]: nextDay,
                },
              },
              {
                bookingDate: { [Op.lte]: date },
                bookingEndDate: { [Op.gte]: nextDay },
              },
            ],
          },
          // 12HR bookings: only check exact date match (same day)
          {
            bookingType: { [Op.like]: '%12HR%' },
            bookingDate: {
              [Op.gte]: date,
              [Op.lt]: nextDay,
            },
          },
        ],
      },
      attributes: ['farmhouseId', 'bookingType', 'bookingDate', 'bookingEndDate', 'bookingTimeFrom', 'bookingTimeTo'],
    });

    // Filter out farms that are booked
    // For 24HR bookings: mark as unavailable if date overlaps
    // For 12HR bookings: mark as unavailable if exact date matches
    const bookedFarmhouseIds = new Set<number>();
    
    bookings.forEach((booking: any) => {
      const bookingData = booking.toJSON();
      const is24Hour = bookingData.bookingType?.includes('24HR');
      
      // Normalize dates for comparison
      const bookingStartDate = new Date(bookingData.bookingDate);
      bookingStartDate.setHours(0, 0, 0, 0);
      const bookingDateStr = bookingStartDate.toISOString().split('T')[0];
      const requestedDateStr = dateStr;
      
      if (is24Hour) {
        // For 24HR bookings, mark start date as unavailable
        if (bookingDateStr === requestedDateStr) {
          bookedFarmhouseIds.add(bookingData.farmhouseId);
        }
        
        // If end date exists and is different from start date, check if requested date is the end date
        if (bookingData.bookingEndDate) {
          const bookingEndDate = new Date(bookingData.bookingEndDate);
          bookingEndDate.setHours(0, 0, 0, 0);
          const bookingEndDateStr = bookingEndDate.toISOString().split('T')[0];
          
          // If the requested date is the end date (checkout day) and different from start
          if (bookingEndDateStr === requestedDateStr && bookingDateStr !== requestedDateStr) {
            // Check if current time is past checkout time
            const [checkoutHour, checkoutMinute] = (bookingData.bookingTimeTo || '12:00').split(':').map(Number);
            const now = new Date();
            const checkoutTime = new Date(date);
            checkoutTime.setHours(checkoutHour, checkoutMinute, 0, 0);
            
            // If it's before checkout time, still unavailable
            if (now < checkoutTime) {
              bookedFarmhouseIds.add(bookingData.farmhouseId);
            }
          }
        }
      } else {
        // For 12HR bookings, mark unavailable if exact date matches
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
            ? `/uploads/farm-product/${farmData.images[0].imagePath}`
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


  // Get farm availability (all bookings)
  async getFarmAvailability(farmhouseId: number) {
    try {
      // First, check if farmhouse exists and get its details
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId, {
        include: [
          {
            model: Location,
            as: 'location',
          },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            separate: true,
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
            limit: 1,
          },
          {
            model: PriceOption,
            as: 'priceOptions',
          },
        ],
      });

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      // Get ALL bookings for this farm (past, current, and future)
      const bookings = await this.bookingModel.findAll({
        where: {
          farmhouseId,
          paymentStatus: { [Op.ne]: 'cancel' },
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'mobileNo'],
            required: false,
          },
        ],
        attributes: [
          'id',
          'userId',
          'customerName',
          'customerMobile',
          'customerEmail',
          'bookingDate',
          'bookingEndDate',
          'bookingTimeFrom',
          'bookingTimeTo',
          'bookingHours',
          'numberOfPersons',
          'bookingType',
          'originalPrice',
          'discountAmount',
          'finalPrice',
          'paymentStatus',
          'farmStatus',
          'isLoggedIn',
          'invoiceToken',
          'createdAt',
          'updatedAt',
        ],
        order: [['bookingDate', 'DESC']],
      });

      // Format all bookings with complete details
      const bookedDates = bookings.map((booking: any) => {
        const bookingData = booking.toJSON();
        const startDate = new Date(bookingData.bookingDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = bookingData.bookingEndDate ? new Date(bookingData.bookingEndDate) : startDate;
        endDate.setHours(0, 0, 0, 0);

        return {
          id: bookingData.id,
          user: {
            id: bookingData.user?.id || null,
            name: bookingData.user?.name || bookingData.customerName || 'N/A',
            email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
            mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
          },
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          checkInTime: bookingData.bookingTimeFrom,
          checkOutTime: bookingData.bookingTimeTo,
          bookingHours: bookingData.bookingHours,
          numberOfPersons: bookingData.numberOfPersons,
          bookingType: bookingData.bookingType,
          paymentStatus: bookingData.paymentStatus,
          farmStatus: bookingData.farmStatus,
          originalPrice: parseFloat(bookingData.originalPrice?.toString() || '0'),
          discountAmount: parseFloat(bookingData.discountAmount?.toString() || '0'),
          finalPrice: parseFloat(bookingData.finalPrice?.toString() || '0'),
          isLoggedIn: bookingData.isLoggedIn || false,
          invoiceToken: bookingData.invoiceToken,
          createdAt: bookingData.createdAt,
          updatedAt: bookingData.updatedAt,
        };
      });

      // Format farmhouse data
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
            ? `/uploads/farm-product/${farmhouseData.images[0].imagePath}`
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

  // Get invoice by token
  async getInvoiceByToken(token: string) {
    try {
      const booking = await this.bookingModel.findOne({
        where: {
          invoiceToken: token,
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'mobileNo'],
          },
          {
            model: Farmhouse,
            as: 'farmhouse',
            include: [
              {
                model: Location,
                as: 'location',
              },
            ],
          },
        ],
      });

      if (!booking) {
        return new ApiResponse(true, 'Invoice not found', null);
      }

      const bookingData: any = booking.toJSON();

      // Format invoice data
      const invoice = {
        invoiceToken: bookingData.invoiceToken,
        bookingId: bookingData.id,
        bookingDate: bookingData.bookingDate,
        bookingTimeFrom: bookingData.bookingTimeFrom,
        bookingTimeTo: bookingData.bookingTimeTo,
        bookingHours: bookingData.bookingHours,
        numberOfPersons: bookingData.numberOfPersons,
        bookingType: bookingData.bookingType,
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

  // Get all bookings with filters (for admin)
  async findAll(queryDto: QueryBookingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        farmhouseId,
        userId,
        paymentStatus,
        dateFrom,
        dateTo,
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

      if (dateFrom || dateTo) {
        where.bookingDate = {};
        if (dateFrom) {
          where.bookingDate[Op.gte] = new Date(dateFrom);
        }
        if (dateTo) {
          where.bookingDate[Op.lte] = new Date(dateTo);
        }
      }

      const { count, rows } = await this.bookingModel.findAndCountAll({
        where,
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
            attributes: ['id', 'name', 'slug', 'farmNo'],
          },
        ],
        order: [['bookingDate', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

      // Format bookings with all requested details
      const formattedBookings = rows.map((booking: any) => {
        const bookingData = booking.toJSON();
        const startDate = new Date(bookingData.bookingDate);
        const endDate = bookingData.bookingEndDate ? new Date(bookingData.bookingEndDate) : startDate;

        return {
          id: bookingData.id,
          user: {
            id: bookingData.user?.id || null,
            name: bookingData.user?.name || bookingData.customerName || 'N/A',
            email: bookingData.user?.email || bookingData.customerEmail || 'N/A',
            mobileNo: bookingData.user?.mobileNo || bookingData.customerMobile || 'N/A',
          },
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
          paymentStatus: bookingData.paymentStatus,
          discountAmount: parseFloat(bookingData.discountAmount?.toString() || '0'),
          finalTotal: parseFloat(bookingData.finalPrice?.toString() || '0'),
          originalPrice: parseFloat(bookingData.originalPrice?.toString() || '0'),
          bookingHours: bookingData.bookingHours || this.calculateHoursFromBookingType(bookingData.bookingType),
          bookingType: bookingData.bookingType,
          invoiceToken: bookingData.invoiceToken,
          createdAt: bookingData.createdAt,
          updatedAt: bookingData.updatedAt,
        };
      });

      return new ApiResponse(false, 'Bookings fetched successfully', {
        bookings: formattedBookings,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching bookings', error.message);
    }
  }

  // Get farm statistics (for admin)
  async getFarmStatistics(farmhouseId: number) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId);
      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      // Get all bookings for this farm
      const allBookings = await this.bookingModel.findAll({
        where: {
          farmhouseId,
          paymentStatus: { [Op.ne]: 'cancel' },
        },
      });

      // Calculate statistics
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

      // Prepare update data
      const updateData: any = { ...updateBookingDto };

      // If price is being updated, recalculate discount
      if (updateBookingDto.originalPrice !== undefined) {
        const isLoggedIn = updateBookingDto.isLoggedIn ?? booking.isLoggedIn ?? false;
        const discountAmount = this.calculateDiscount(updateBookingDto.originalPrice, Boolean(isLoggedIn));
        const finalPrice = updateBookingDto.originalPrice - discountAmount;
        
        updateData.discountAmount = discountAmount;
        updateData.finalPrice = finalPrice;
      }

      await booking.update(updateData);

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

      // Update most visited status after deletion
      await this.updateMostVisitedStatus(booking.farmhouseId);

      return new ApiResponse(false, 'Booking deleted successfully', null);
    } catch (error) {
      return new ApiResponse(true, 'Error deleting booking', error.message);
    }
  }
}

