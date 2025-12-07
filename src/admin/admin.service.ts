import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { Admin } from './entities/admin.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { Location } from '../products/entities/location.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import * as bcrypt from 'bcrypt';
import { ApiResponse } from 'src/common/responses/api-response';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Op, Sequelize } from 'sequelize';

interface MonthlyData {
  month: string;
  count: number;
  income: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin) private readonly adminModel: typeof Admin,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Booking) private readonly bookingModel: typeof Booking,
    @InjectModel(Farmhouse) private readonly farmhouseModel: typeof Farmhouse,
    @InjectModel(PriceOption) private readonly priceOptionModel: typeof PriceOption,
    private jwtService: JwtService,
  ) { }

  // **Admin Register API**
  async registerAdmin(registerAdminDto: RegisterAdminDto) {
    const { firstName, lastName, email, password } = registerAdminDto;

    try {
      // Check if admin already exists
      const existingAdmin = await this.adminModel.findOne({ where: { email } });
      if (existingAdmin) {
        return new ApiResponse(true, 'Admin with this email already exists', null);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin
      const admin = await this.adminModel.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        status: 'active',
      } as any);

      // Generate JWT access_token
      const access_token = this.generateaccess_token(admin);

      // Remove password from admin data
      const adminData: any = admin.toJSON();
      delete adminData.password;

      return new ApiResponse(
        false,
        'Success',
        adminData,
        access_token, // will be used as token
      );
    } catch (error) {
      return new ApiResponse(true, 'Error during admin registration', error.message);
    }
  }

  // **Admin Login API**
  async loginAdmin(loginAdminDto: LoginAdminDto) {
    const { email, password } = loginAdminDto;

    try {
      if (!email || !password) {
        return new ApiResponse(true, 'Email and password are required', null);
      }

      const admin = await this.adminModel.findOne({ where: { email } });

      if (!admin) {
        return new ApiResponse(true, 'Invalid credentials', null);
      }

      if (!admin.password) {
        return new ApiResponse(true, 'Admin account has no password set', null);
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return new ApiResponse(true, 'Invalid credentials', null);
      }

      if (admin.status !== 'active') {
        return new ApiResponse(true, 'Admin account is inactive', null);
      }

      const access_token = this.generateaccess_token(admin);

      const adminData: any = admin.toJSON();
      delete adminData.password;

      // Add role static data
      adminData.role = 'admin';

      return new ApiResponse(false, 'Success', adminData, access_token);

    } catch (error: any) {
      return new ApiResponse(true, error?.message || 'Error during admin login', null);
    }
  }


  // **Get All Users API**
  async getAllUsers(query: any) {
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = query.search || '';
      const loginType = query.loginType || '';
      const sort = query.sort?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const whereCondition: any = {};

      if (search) {
        whereCondition[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { mobileNo: { [Op.like]: `%${search}%` } },
        ];
      }

      if (loginType) {
        whereCondition.loginType = loginType;
      }

      const { count, rows } = await this.userModel.findAndCountAll({
        where: whereCondition,
        attributes: [
          'id', 'name', 'email', 'mobileNo',
          'loginType', 'profileImage',
          'createdAt', 'updatedAt',
        ],
        order: [['createdAt', sort]],
        limit,
        offset,
      });

      return new ApiResponse(false, 'Users fetched successfully', {
        users: rows,
        pagination: {
          totalUsers: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      });

    } catch (error) {
      return new ApiResponse(true, 'Error fetching users', error.message);
    }
  }


  // **Get Admin Profile API**
  async getProfile(adminId: number) {
    try {
      const admin = await this.adminModel.findByPk(adminId, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'],
      });

      if (!admin) {
        return new ApiResponse(true, 'Admin not found', null);
      }

      return new ApiResponse(false, 'Success', admin);
    } catch (error) {
      return new ApiResponse(true, 'Error fetching admin profile', error.message);
    }
  }

  // **Bulk Delete Users API**
  async bulkDeleteUsers(bulkDeleteDto: BulkDeleteUsersDto) {
    const { userIds } = bulkDeleteDto;

    try {
      if (!userIds || userIds.length === 0) {
        return new ApiResponse(true, 'No user IDs provided', null);
      }

      // Delete users
      const deletedCount = await this.userModel.destroy({
        where: {
          id: userIds,
        },
      });

      if (deletedCount === 0) {
        return new ApiResponse(true, 'No users found to delete', null);
      }

      return new ApiResponse(false, `Successfully deleted ${deletedCount} user(s)`, { deletedCount });
    } catch (error) {
      return new ApiResponse(true, 'Error deleting users', error.message);
    }
  }

  // **Private Helper: Generate JWT access_token**
  private generateaccess_token(admin: Admin) {
    const payload = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: 'admin',
    };

    return this.jwtService.sign(payload);
  }

  async updateProfile(adminId: number, updateAdminDto: UpdateAdminDto) {
    try {
      const admin = await this.adminModel.findByPk(adminId);

      if (!admin) {
        return new ApiResponse(true, 'Admin not found', null);
      }

      const { firstName, lastName, email, password } = updateAdminDto;

      // If email is being updated → Check already exists
      if (email && email !== admin.email) {
        const existingEmail = await this.adminModel.findOne({ where: { email } });
        if (existingEmail && existingEmail.id !== adminId) {
          return new ApiResponse(true, 'Email already exists', null);
        }
        admin.email = email;
      }

      // Hash password if updating
      if (password) {
        admin.password = await bcrypt.hash(password, 10);
      }

      // Update other fields
      if (firstName) admin.firstName = firstName;
      if (lastName) admin.lastName = lastName;

      await admin.save();

      const adminData: any = admin.toJSON();
      delete adminData.password;

      return new ApiResponse(false, 'Profile updated successfully', adminData);

    } catch (error: any) {
      const errorMessage = error?.message || 'Error updating profile';
      return new ApiResponse(true, errorMessage, null);
    }
  }

  // **Get User Details API (Admin only)**
  async getUserDetails(userId: number) {
    try {
      // Fetch user data
      const user = await this.userModel.findByPk(userId, {
        attributes: [
          'id', 'name', 'email', 'mobileNo',
          'loginType', 'createdAt', 'updatedAt',
        ],
      });

      if (!user) {
        return new ApiResponse(true, 'User not found', null);
      }

      // Fetch all bookings for this user with farm and location details
      const bookings = await this.bookingModel.findAll({
        where: { userId },
        include: [
          {
            model: Farmhouse,
            as: 'farmhouse',
            attributes: ['id', 'name', 'slug'],
            include: [
              {
                model: Location,
                as: 'location',
                attributes: ['address', 'city', 'state'],
              },
            ],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      // Calculate payment statistics
      let totalPaymentReceived = 0;
      let totalPaymentPending = 0;

      const bookingDetails = bookings.map((booking: any) => {
        const bookingJson = booking.toJSON();
        const finalPrice = parseFloat(bookingJson.finalPrice) || 0;

        // Calculate payments based on payment status
        if (bookingJson.paymentStatus === 'paid') {
          totalPaymentReceived += finalPrice;
        } else if (bookingJson.paymentStatus === 'partial' || bookingJson.paymentStatus === 'incomplete') {
          totalPaymentPending += finalPrice;
        }

        // Format location
        const location = bookingJson.farmhouse?.location
          ? `${bookingJson.farmhouse.location.city}, ${bookingJson.farmhouse.location.state}`
          : 'N/A';

        return {
          bookingId: bookingJson.id,
          farmName: bookingJson.farmhouse?.name || 'N/A',
          farmLocation: location,
          bookingDate: bookingJson.bookingDate,
          bookingEndDate: bookingJson.bookingEndDate,
          bookingType: bookingJson.bookingType,
          numberOfPersons: bookingJson.numberOfPersons,
          originalPrice: parseFloat(bookingJson.originalPrice) || 0,
          discountAmount: parseFloat(bookingJson.discountAmount) || 0,
          finalPrice: finalPrice,
          paymentStatus: bookingJson.paymentStatus,
          createdAt: bookingJson.createdAt,
        };
      });

      const totalPaymentAmount = totalPaymentReceived + totalPaymentPending;

      const userDetails = {
        userId: user.id,
        name: user.name,
        email: user.email,
        mobileNo: user.mobileNo,
        loginType: user.loginType,
        profileImage: user.profileImage,
        totalFarmBookings: bookings.length,
        totalPaymentReceived: parseFloat(totalPaymentReceived.toFixed(2)),
        totalPaymentPending: parseFloat(totalPaymentPending.toFixed(2)),
        totalPaymentAmount: parseFloat(totalPaymentAmount.toFixed(2)),
        bookings: bookingDetails,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return new ApiResponse(false, 'User details fetched successfully', userDetails);

    } catch (error: any) {
      const errorMessage = error?.message || 'Error fetching user details';
      return new ApiResponse(true, errorMessage, null);
    }
  }

  // **Admin Analytics Dashboard API**
  async getAnalytics() {
    try {
      // Get total counts
      const totalUsers = await this.userModel.count();
      const totalFarmhouses = await this.farmhouseModel.count();
      const totalBookings = await this.bookingModel.count({
        where: { paymentStatus: { [Op.ne]: 'cancel' } },
      });

      // Get total income
      const incomeResult: any = await this.bookingModel.findOne({
        attributes: [[Sequelize.fn('SUM', Sequelize.col('finalPrice')), 'totalIncome']],
        where: { paymentStatus: 'paid' },
        raw: true,
      });
      const totalIncome = parseFloat(incomeResult?.totalIncome || 0);

      // Get current month date year
      const now = new Date();
      const monthNum = now.getMonth() + 1;
      const yearNum = now.getFullYear();
      const startYear = monthNum <= 11 ? yearNum - 1 : yearNum;
      const endYear = monthNum <= 11 ? yearNum : yearNum + 1;
      const dateYear = `${startYear}-${endYear}`;

      // Get monthly orders and income (all 12 months)
      const monthlyOrders = await this.getMonthlyOrders();
      const monthlyIncome = await this.getMonthlyIncome();

      const analytics = {
        totalUsers,
        totalFarmhouses,
        totalBookings,
        totalIncome,
        dateYear,
        monthlyOrders,
        monthlyIncome,
      };

      return new ApiResponse(false, 'Analytics fetched successfully', analytics);
    } catch (error: any) {
      const errorMessage = error?.message || 'Error fetching analytics';
      return new ApiResponse(true, errorMessage, null);
    }
  }

  private async getMonthlyOrders(): Promise<any[]> {
    try {
      // Get all bookings and group by month in application code
      const bookings = await this.bookingModel.findAll({
        where: { paymentStatus: { [Op.ne]: 'cancel' } },
        attributes: ['bookingDate'],
        raw: true,
      });

      // Create last 12 months map (from 12 months ago to current month)
      const monthlyMap = new Map<string, number>();
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(monthKey, 0);
      }

      // Count bookings per month
      bookings.forEach((booking: any) => {
        const date = new Date(booking.bookingDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
        }
      });

      // Convert to array format
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const resultArray = Array.from(monthlyMap.entries()).map(([monthKey, count]) => {
        const [year, month] = monthKey.split('-');
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const monthName = monthNames[monthNum - 1];
        
        return {
          month: monthName,
          count,
        };
      });

      // Add dateYear only to the last item
      if (resultArray.length > 0) {
        const lastEntry = resultArray[resultArray.length - 1];
        const lastMonthKey = Array.from(monthlyMap.keys())[monthlyMap.size - 1];
        const [year, month] = lastMonthKey.split('-');
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const startYear = monthNum <= 11 ? yearNum - 1 : yearNum;
        const endYear = monthNum <= 11 ? yearNum : yearNum + 1;
        (lastEntry as any).dateYear = `${startYear}-${endYear}`;
      }

      return resultArray;
    } catch (error) {
      return [];
    }
  }

  private async getMonthlyOrdersMySql(): Promise<any[]> {
    try {
      // This is now handled in getMonthlyOrders with application-level logic
      return [];
    } catch (error) {
      return [];
    }
  }

  private async getMonthlyIncome(): Promise<any[]> {
    try {
      // Get all paid bookings and group by month in application code
      const bookings = await this.bookingModel.findAll({
        where: { paymentStatus: 'paid' },
        attributes: ['bookingDate', 'finalPrice'],
        raw: true,
      });

      // Create last 12 months map (from 12 months ago to current month)
      const monthlyMap = new Map<string, number>();
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(monthKey, 0);
      }

      // Sum income per month
      bookings.forEach((booking: any) => {
        const date = new Date(booking.bookingDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + parseFloat(booking.finalPrice || 0));
        }
      });

      // Convert to array format
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const resultArray = Array.from(monthlyMap.entries()).map(([monthKey, income]) => {
        const [year, month] = monthKey.split('-');
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const monthName = monthNames[monthNum - 1];
        
        return {
          month: monthName,
          income: parseFloat(income.toFixed(2)),
        };
      });

      // Add dateYear only to the last item
      if (resultArray.length > 0) {
        const lastEntry = resultArray[resultArray.length - 1];
        const lastMonthKey = Array.from(monthlyMap.keys())[monthlyMap.size - 1];
        const [year, month] = lastMonthKey.split('-');
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const startYear = monthNum <= 11 ? yearNum - 1 : yearNum;
        const endYear = monthNum <= 11 ? yearNum : yearNum + 1;
        (lastEntry as any).dateYear = `${startYear}-${endYear}`;
      }

      return resultArray;
    } catch (error) {
      return [];
    }
  }

  private async getMonthlyIncomeMySql(): Promise<any[]> {
    try {
      // This is now handled in getMonthlyIncome with application-level logic
      return [];
    } catch (error) {
      return [];
    }
  }
}
