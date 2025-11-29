import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginMobileDto } from './dto/login-mobile.dto';
import { firebaseAuth } from '../common/firebase/firebase-admin';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';

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
}
