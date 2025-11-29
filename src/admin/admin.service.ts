import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { Admin } from './entities/admin.entity';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ApiResponse } from 'src/common/responses/api-response';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin) private readonly adminModel: typeof Admin,
    @InjectModel(User) private readonly userModel: typeof User,
    private jwtService: JwtService,
  ) {}

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

      // Generate JWT token
      const token = this.generateToken(admin);

      // Remove password from admin data
      const adminData: any = admin.toJSON();
      delete adminData.password;

      return new ApiResponse(false, 'Success', adminData, token);
    } catch (error) {
      return new ApiResponse(true, 'Error during admin registration', error.message);
    }
  }

  // **Admin Login API**
  async loginAdmin(loginAdminDto: LoginAdminDto) {
    const { email, password } = loginAdminDto;

    try {
      // Validate input
      if (!email || !password) {
        return new ApiResponse(true, 'Email and password are required', null);
      }

      // Check if admin exists
      const admin = await this.adminModel.findOne({ where: { email } });

      if (!admin) {
        return new ApiResponse(true, 'Invalid credentials', null);
      }

      // Check if password exists in database
      if (!admin.password) {
        return new ApiResponse(true, 'Admin account has no password set', null);
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return new ApiResponse(true, 'Invalid credentials', null);
      }

      // Check if admin is active
      if (admin.status !== 'active') {
        return new ApiResponse(true, 'Admin account is inactive', null);
      }

      // Generate JWT token
      const token = this.generateToken(admin);

      // Remove password from admin data
      const adminData: any = admin.toJSON();
      delete adminData.password;

      return new ApiResponse(false, 'Success', adminData, token);
    } catch (error: any) {
      // Better error handling
      const errorMessage = error?.message || 'Error during admin login';
      return new ApiResponse(true, errorMessage, null);
    }
  }

  // **Get All Users API**
  async getAllUsers() {
    try {
      const users = await this.userModel.findAll({
        attributes: ['id', 'name', 'email', 'mobileNo', 'loginType', 'profileImage', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
      });

      return new ApiResponse(false, 'Users fetched successfully', users);
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

  // **Private Helper: Generate JWT Token**
  private generateToken(admin: Admin) {
    const payload = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: 'admin',
    };

    return this.jwtService.sign(payload);
  }
}
