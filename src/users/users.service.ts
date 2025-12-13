import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ApiResponse } from 'src/common/responses/api-response';
import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginMobileDto } from './dto/login-mobile.dto';
import { firebaseAuth } from '../common/firebase/firebase-admin';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { Location } from '../products/entities/location.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';

interface OtpStorage {
  otp: string;
  expiresAt: Date;
  mobileNo: string;
}

@Injectable()
export class UsersService {
  // In-memory OTP storage (in production, use Redis or database)
  // Key: mobileNo -> OTP data
  private otpStorage: Map<string, OtpStorage> = new Map();
  // Reverse lookup: OTP -> mobileNo (for OTP-only verification)
  private otpToMobileMap: Map<string, string> = new Map();

  constructor(
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Farmhouse) private farmhouseModel: typeof Farmhouse,
    private jwtService: JwtService,
  ) { }

  private generateToken(user: User) {
    const payload = {
      id: user.id,
      email: user.email || '', // Include email (empty for mobile users)
      role: 'user', // User role for regular users
    };

    return {
      token: this.jwtService.sign(payload),
      user,
    };
  }

  private generateOtp(): string {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private storeOtp(mobileNo: string, otp: string): void {
    // Store OTP with 5 minutes expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    // Remove old OTP mapping if exists
    const oldStorage = this.otpStorage.get(mobileNo);
    if (oldStorage) {
      this.otpToMobileMap.delete(oldStorage.otp);
    }
    
    // Store OTP by mobile number
    this.otpStorage.set(mobileNo, {
      otp,
      expiresAt,
      mobileNo,
    });
    
    // Store reverse lookup: OTP -> mobileNo
    this.otpToMobileMap.set(otp, mobileNo);
  }

  private validateOtp(mobileNo: string | null | undefined, otp: string): { valid: boolean; mobileNo?: string } {
    let targetMobileNo: string | undefined = mobileNo || undefined;
    
    // If mobileNo not provided, look it up from OTP
    if (!targetMobileNo) {
      targetMobileNo = this.otpToMobileMap.get(otp);
      if (!targetMobileNo) {
        return { valid: false };
      }
    }
    
    const stored = this.otpStorage.get(targetMobileNo);
    
    if (!stored) {
      return { valid: false };
    }

    // Check if OTP has expired
    if (new Date() > stored.expiresAt) {
      this.otpStorage.delete(targetMobileNo);
      this.otpToMobileMap.delete(otp);
      return { valid: false };
    }

    // Check if OTP matches
    if (stored.otp !== otp) {
      return { valid: false };
    }

    // Remove OTP after successful validation
    this.otpStorage.delete(targetMobileNo);
    this.otpToMobileMap.delete(otp);
    
    return { valid: true, mobileNo: targetMobileNo };
  }

  async loginWithGoogle(dto: LoginGoogleDto) {
    const decoded = await firebaseAuth.verifyIdToken(dto.idToken).catch(() => {
      throw new BadRequestException('Invalid Google token');
    });

    const {
      email,
      name,
      picture,
      given_name,
      family_name,
    } = decoded;

    if (!email)
      throw new BadRequestException('Email not found in Google account');

    let user = await this.userModel.findOne({ where: { email } });

    if (!user) {
      user = await this.userModel.create({
        email,
        name: name || given_name || 'User',
        profileImage: picture || '',
        loginType: 'google',
      } as any);
    }

    return this.generateToken(user);
  }

  async loginWithMobile(dto: LoginMobileDto) {
    // Generate OTP
    const otp = this.generateOtp();
    
    // Store OTP with expiration
    this.storeOtp(dto.mobileNo, otp);

    try {
      // Find or create user
      let user = await this.userModel.findOne({
        where: { mobileNo: dto.mobileNo },
      });

      if (!user) {
        // Create new user
        user = await this.userModel.create({
          mobileNo: dto.mobileNo,
          email: '',
          name: dto.name,
          loginType: 'phone',
        } as any);
      } else {
        // Update existing user's name if provided
        if (dto.name) {
          user.name = dto.name;
          await user.save();
        }
      }

      // In development, return OTP for testing
      // In production, remove the otp field and send via SMS service
      return {
        msg: 'OTP sent successfully',
        otp: otp, // Remove this in production
      };
    } catch (error: any) {
      // If error is about missing 'name' column, sync the database schema
      if (error.message && error.message.includes("Unknown column 'name'")) {
        // Force sync to add missing columns
        await this.userModel.sequelize?.sync({ alter: true });
        
        // Retry the operation
        let user = await this.userModel.findOne({
          where: { mobileNo: dto.mobileNo },
        });

        if (!user) {
          user = await this.userModel.create({
            mobileNo: dto.mobileNo,
            email: '',
            name: dto.name,
            loginType: 'phone',
          } as any);
        } else {
          if (dto.name) {
            user.name = dto.name;
            await user.save();
          }
        }

        return {
          msg: 'OTP sent successfully',
          otp: otp,
        };
      }
      throw error;
    }
  }

  async verifyOtp(otp: string, mobileNo?: string) {
    // Validate OTP (mobileNo is optional - will be looked up from OTP if not provided)
    const validation = this.validateOtp(mobileNo, otp);
    
    if (!validation.valid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Get mobile number from validation result (either provided or looked up)
    const verifiedMobileNo = validation.mobileNo!;

    // Find user
    const user = await this.userModel.findOne({ where: { mobileNo: verifiedMobileNo } });
    if (!user) {
      throw new BadRequestException('User not found. Please login again.');
    }

    // Generate and return token
    return this.generateToken(user);
  }

  async myProfile(userId: number) {
    return this.userModel.findByPk(userId);
  }

  async saveFarm(userId: number, productId: number) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get current saved farms array
      const savedFarms: number[] = (user.savedFarms as number[]) || [];

      // Check if productId already exists
      if (savedFarms.includes(productId)) {
        // Remove it (toggle off)
        const updatedFarms = savedFarms.filter(id => id !== productId);
        await user.update({ savedFarms: updatedFarms } as any);
        return {
          success: true,
          message: 'Farm removed from saved list',
          savedFarms: updatedFarms,
        };
      } else {
        // Add it (toggle on)
        const updatedFarms = [...savedFarms, productId];
        await user.update({ savedFarms: updatedFarms } as any);
        return {
          success: true,
          message: 'Farm saved successfully',
          savedFarms: updatedFarms,
        };
      }
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error saving farm');
    }
  }

  async getSavedFarms(userId: number) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const savedFarms: number[] = (user.savedFarms as number[]) || [];
      
      if (savedFarms.length === 0) {
        return {
          success: true,
          savedFarms: [],
          count: 0,
        };
      }

      // Fetch full farm details
      const farms = await this.farmhouseModel.findAll({
        where: {
          id: savedFarms,
          status: true, // Only return active farms
        },
        include: [
          {
            model: Location,
            as: 'location',
          },
          {
            model: PriceOption,
            as: 'priceOptions',
          },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
          },
        ],
      });

      // Transform data
      const farmsData = farms.map((farmhouse: any) => {
        const farmhouseData = farmhouse.toJSON();
        return {
          id: farmhouseData.id,
          name: farmhouseData.name,
          slug: farmhouseData.slug,
          maxPersons: farmhouseData.maxPersons,
          bedrooms: farmhouseData.bedrooms,
          isRecomanded: farmhouseData.isRecomanded,
          isAmazing: farmhouseData.isAmazing,
          farmNo: farmhouseData.farmNo,
          description: farmhouseData.description,
          images: farmhouseData.images?.map((img: any) => ({
            id: img.id,
            imagePath: `uploads/farm-product/${img.imagePath}`,
            isMain: img.isMain,
            ordering: img.ordering,
          })) || [],
          location: farmhouseData.location || null,
          rent: farmhouseData.priceOptions?.map((price: any) => ({
            id: price.id,
            category: price.category,
            price: price.price,
            maxPeople: price.maxPeople,
          })) || [],
        };
      });
      
      return {
        success: true,
        savedFarms: farmsData,
        count: farmsData.length,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error fetching saved farms');
    }
  }

  async getBookedFarms(userId: number) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get booking history from user
      const bookingHistory: any[] = (user.bookingHistory as any[]) || [];
      
      if (bookingHistory.length === 0) {
        return {
          success: true,
          bookedFarms: [],
          count: 0,
        };
      }

      // Get unique farmhouse IDs from booking history
      const farmhouseIds = [...new Set(bookingHistory.map(b => b.farmhouseId))];

      // Fetch farm details
      const farms = await this.farmhouseModel.findAll({
        where: {
          id: farmhouseIds,
        },
        include: [
          {
            model: Location,
            as: 'location',
          },
          {
            model: PriceOption,
            as: 'priceOptions',
          },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
          },
        ],
      });

      // Map farms with booking history
      const bookedFarmsData = farms.map((farmhouse: any) => {
        const farmhouseData = farmhouse.toJSON();
        const farmBookings = bookingHistory.filter(b => b.farmhouseId === farmhouseData.id);
        
        return {
          id: farmhouseData.id,
          name: farmhouseData.name,
          slug: farmhouseData.slug,
          maxPersons: farmhouseData.maxPersons,
          bedrooms: farmhouseData.bedrooms,
          isRecomanded: farmhouseData.isRecomanded,
          isAmazing: farmhouseData.isAmazing,
          farmNo: farmhouseData.farmNo,
          description: farmhouseData.description,
          images: farmhouseData.images?.map((img: any) => ({
            id: img.id,
            imagePath: `uploads/farm-product/${img.imagePath}`,
            isMain: img.isMain,
            ordering: img.ordering,
          })) || [],
          location: farmhouseData.location || null,
          rent: farmhouseData.priceOptions?.map((price: any) => ({
            id: price.id,
            category: price.category,
            price: price.price,
            maxPeople: price.maxPeople,
          })) || [],
          bookings: farmBookings.map((booking: any) => ({
            bookingDate: booking.bookingDate,
            bookingType: booking.bookingType,
            rent: booking.rent,
            bookedAt: booking.bookedAt,
          })),
          totalBookings: farmBookings.length,
        };
      });
      
      return {
        success: true,
        bookedFarms: bookedFarmsData,
        count: bookedFarmsData.length,
        totalBookings: bookingHistory.length,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Error fetching booked farms');
    }
  }

  // Admin helper: create a new user (requires controller to protect with admin token)
  async createUser(dto: any, createdBy?: number) {
    try {
      const { email, mobile, name } = dto;

      if (!email && !mobile) {
        return new ApiResponse(true, 'Either email or mobile is required', null);
      }

      const whereConditions: any[] = [];
      if (email) whereConditions.push({ email });
      if (mobile) whereConditions.push({ mobileNo: mobile });

      const existing = await this.userModel.findOne({
        where: { [Op.or]: whereConditions },
      });

      if (existing) {
        return new ApiResponse(true, 'User with provided email/mobile already exists', null);
      }

      const payload: any = { name };
      if (email) payload.email = email;
      if (mobile) payload.mobileNo = mobile;
      if (createdBy) payload.createdBy = createdBy;
      
      // Set loginType to 'admin' when created by admin
      payload.loginType = 'admin';

      const user = await this.userModel.create(payload as any);

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email || null,
        mobile: user.mobileNo || null,
        loginType: user.loginType,
      };

      return new ApiResponse(false, 'User created successfully', safeUser);
    } catch (err: any) {
      return new ApiResponse(true, 'Error creating user', err.message);
    }
  }
}
