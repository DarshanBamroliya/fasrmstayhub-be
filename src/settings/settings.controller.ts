import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
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
  constructor(private readonly settingsService: SettingsService) { }

  // ============================================
  // GET APIs - Public
  // ============================================

  @Public()
  @Get('logo')
  @ApiOperation({ summary: 'Get app logo (Public)' })
  @ApiResponse({ status: 200, description: 'Logo fetched successfully.' })
  async getLogo(): Promise<CustomApiResponse<any>> {
    return this.settingsService.getLogo();
  }

  @Public()
  @Get('login-image')
  @ApiOperation({ summary: 'Get login dialog image (Public)' })
  @ApiResponse({ status: 200, description: 'Login image fetched successfully.' })
  async getLoginImage(): Promise<CustomApiResponse<any>> {
    return this.settingsService.getLoginImage();
  }

  @Public()
  @Get('hero-sliders')
  @ApiOperation({ summary: 'Get hero slider images (Public)' })
  @ApiResponse({ status: 200, description: 'Hero sliders fetched successfully.' })
  async getHeroSliders(): Promise<CustomApiResponse<any>> {
    return this.settingsService.getHeroSliders();
  }

  // ============================================
  // POST APIs - Admin Only
  // ============================================

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('logo')
  @UseInterceptors(FilesInterceptor('logo', 1, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload app logo (replaces existing) (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadLogo(
    @UploadedFiles() files: MulterFile[],
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.uploadLogo(files[0]);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('login-image')
  @UseInterceptors(FilesInterceptor('image', 1, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload login dialog image (replaces existing) (Admin only)' })
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
  async uploadLoginImage(
    @UploadedFiles() files: MulterFile[],
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.uploadLoginImage(files[0]);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('hero-sliders')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload hero slider images/videos (adds to existing) (Admin only)' })
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

  // ============================================
  // DELETE APIs - Admin Only
  // ============================================

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete('hero-sliders/:id')
  @ApiOperation({ summary: 'Delete hero slider image by ID (Admin only)' })
  @ApiParam({ name: 'id', type: 'integer', description: 'Hero slider image ID' })
  @ApiResponse({ status: 200, description: 'Hero slider image deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Hero slider not found.' })
  async deleteHeroSlider(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CustomApiResponse<any>> {
    return this.settingsService.deleteHeroSlider(id);
  }
}
