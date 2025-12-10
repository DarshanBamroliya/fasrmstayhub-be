import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Delete,
  Param,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ApiResponse as CustomApiResponse } from 'src/common/responses/api-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { memoryStorage } from 'multer';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for videos
  },
  fileFilter: (req: any, file: MulterFile, cb: any) => {
    // Allow images and videos
    if (
      file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/) ||
      file.mimetype.match(/\/(mp4|mov|avi|wmv|flv|webm|mkv)$/)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
};

@ApiTags('Settings')
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get app settings (Public)' })
  @ApiResponse({ status: 200, description: 'Settings fetched successfully.' })
  async getSettings(): Promise<CustomApiResponse<any>> {
    return this.settingsService.getSettings();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Put()
  @ApiOperation({ summary: 'Update app settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto): Promise<CustomApiResponse<any>> {
    return this.settingsService.updateSettings(updateSettingsDto);
  }

  // Upload Hero Slider Images/Videos (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('hero-sliders')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload hero slider images and videos (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Hero slider files uploaded successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadHeroSliders(
    @UploadedFiles() files: MulterFile[],
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.uploadHeroSliders(files);
  }

  // Upload Login Dialog Image (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('login-dialog-image')
  @UseInterceptors(FilesInterceptor('image', 1, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload login dialog image (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login dialog image uploaded successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadLoginDialogImage(
    @UploadedFiles() files: MulterFile[],
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.uploadLoginDialogImage(files[0]);
  }

  // Upload App Logo (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('logo')
  @UseInterceptors(FilesInterceptor('logo', 1, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload app logo (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
        },
        mode: {
          type: 'string',
          enum: ['light', 'dark'],
          description: 'Logo mode: light or dark',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadLogo(
    @UploadedFiles() files: MulterFile[],
    @Body() body: { mode: 'light' | 'dark' },
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.uploadLogo(files[0], body.mode);
  }

  // Delete Hero Slider Image (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete('hero-sliders/:imageName')
  @ApiOperation({ summary: 'Delete hero slider image (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hero slider image deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteHeroSlider(
    @Param('imageName') imageName: string,
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.deleteHeroSlider(imageName);
  }
}

