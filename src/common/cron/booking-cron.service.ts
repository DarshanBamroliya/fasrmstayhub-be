// booking-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Booking } from 'src/booking/entities/booking.entity';
import { Farmhouse } from 'src/products/entities/farmhouse.entity';

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(
    @InjectModel(Booking)
    private bookingModel: typeof Booking,
  ) {}

  /**
   * Run every 5 minutes to auto-update booking statuses
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoUpdateBookingStatus() {
    this.logger.log('🚀 Starting auto update of booking statuses...');

    try {
      const now = new Date();
      
      // Find bookings that need status update
      const bookings = await this.bookingModel.findAll({
        where: {
          [Op.or]: [
            // Bookings where nextStatusCheckAt has passed
            {
              nextStatusCheckAt: { 
                [Op.lte]: now,
                [Op.ne]: null 
              }
            },
            // Bookings without nextStatusCheckAt (legacy data)
            {
              nextStatusCheckAt: null,
              bookingStatus: { [Op.in]: ['upcoming', 'current'] }
            }
          ]
        },
        include: [{ model: Farmhouse, as: 'farmhouse' }]
      });

      this.logger.log(`📊 Found ${bookings.length} bookings to check`);

      let updatedCount = 0;
      for (const booking of bookings) {
        const oldStatus = booking.bookingStatus;
        const oldFarmStatus = booking.farmStatus;
        
        const changed = await booking.updateStatus();
        
        if (changed) {
          await booking.save();
          updatedCount++;
          
          this.logger.log(`✅ Updated booking ${booking.id}:`);
          this.logger.log(`   Status: ${oldStatus} → ${booking.bookingStatus}`);
          this.logger.log(`   Farm Status: ${oldFarmStatus} → ${booking.farmStatus}`);
          this.logger.log(`   Next Check: ${booking.nextStatusCheckAt}`);
        }
      }

      this.logger.log(`🎉 Auto update completed. Updated ${updatedCount} bookings.`);
    } catch (error) {
      this.logger.error('❌ Error in auto update:', error);
    }
  }

  /**
   * Run at midnight for comprehensive update
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyComprehensiveUpdate() {
    this.logger.log('🌙 Starting daily comprehensive booking update...');
    
    try {
      const result = await Booking.updateAllStatuses();
      this.logger.log(`📈 Daily update: ${result.updated}/${result.total} bookings updated`);
    } catch (error) {
      this.logger.error('❌ Error in daily update:', error);
    }
  }

  /**
   * Run every hour to check expired bookings
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredBookings() {
    this.logger.log('⏰ Checking for expired bookings...');
    
    try {
      const now = new Date();
      
      // Find bookings that should be expired
      const bookings = await this.bookingModel.findAll({
        where: {
          bookingStatus: { [Op.in]: ['upcoming', 'current'] },
          [Op.or]: [
            // Check based on bookingDate + 24 hours for 24HR bookings
            {
              bookingType: { [Op.like]: '%24HR%' },
              bookingDate: { 
                [Op.lte]: new Date(now.getTime() - 24 * 60 * 60 * 1000)
              }
            },
            // Check based on bookingDate for 12HR bookings
            {
              bookingType: { [Op.like]: '%12HR%' },
              bookingDate: { 
                [Op.lte]: new Date(now.getTime() - 12 * 60 * 60 * 1000)
              }
            }
          ]
        },
        include: [{ model: Farmhouse, as: 'farmhouse' }]
      });

      for (const booking of bookings) {
        const checkOutTime = booking.calculateCheckOutTime();
        if (now > checkOutTime) {
          const oldStatus = booking.bookingStatus;
          await booking.update({
            bookingStatus: 'expired',
            farmStatus: 'available',
            nextStatusCheckAt: null
          });
          await booking.save();
          
          this.logger.log(`⏳ Force expired booking ${booking.id}: ${oldStatus} → expired`);
        }
      }
    } catch (error) {
      this.logger.error('❌ Error checking expired bookings:', error);
    }
  }

  /**
   * Manual force update (for admin use)
   */
  async forceUpdateAll(): Promise<{ 
    message: string; 
    updated: number; 
    total: number;
  }> {
    this.logger.log('🔧 Manual force update requested');
    
    try {
      const result = await Booking.updateAllStatuses();
      
      return {
        message: `Successfully updated ${result.updated} out of ${result.total} bookings`,
        updated: result.updated,
        total: result.total
      };
    } catch (error) {
      this.logger.error('❌ Error in force update:', error);
      throw error;
    }
  }

  /**
   * Update single booking status
   */
  async updateSingleBooking(bookingId: number): Promise<{
    success: boolean;
    oldStatus: string;
    newStatus: string;
    message: string;
  }> {
    try {
      const booking = await this.bookingModel.findByPk(bookingId, {
        include: [{ model: Farmhouse, as: 'farmhouse' }]
      });

      if (!booking) {
        return {
          success: false,
          oldStatus: '',
          newStatus: '',
          message: 'Booking not found'
        };
      }

      const oldStatus = booking.bookingStatus;
      const changed = await booking.updateStatus();
      
      if (changed) {
        await booking.save();
        return {
          success: true,
          oldStatus,
          newStatus: booking.bookingStatus,
          message: `Booking status updated from ${oldStatus} to ${booking.bookingStatus}`
        };
      } else {
        return {
          success: true,
          oldStatus,
          newStatus: oldStatus,
          message: `No change needed. Status remains ${oldStatus}`
        };
      }
    } catch (error) {
      this.logger.error(`❌ Error updating booking ${bookingId}:`, error);
      throw error;
    }
  }
}