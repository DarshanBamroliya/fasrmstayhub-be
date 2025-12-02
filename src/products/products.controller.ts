import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateFarmhouseDto } from './dto/create-farmhouse.dto';
import { UpdateFarmhouseDto } from './dto/update-farmhouse.dto';
import { QueryFarmhouseDto } from './dto/query-farmhouse.dto';
import { AddAmenityDto } from './dto/add-amenity.dto';
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

@ApiTags('Products (Farmhouses)')
@Controller('api/farmhouse')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // Create Farmhouse (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new farmhouse (Admin only)' })
  @ApiResponse({ status: 201, description: 'Farmhouse created successfully.' })
  @ApiResponse({ status: 400, description: 'Farmhouse with this slug already exists.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createFarmhouseDto: CreateFarmhouseDto): Promise<CustomApiResponse<any>> {
    return this.productsService.create(createFarmhouseDto);
  }

  // Get All Farmhouses (Public) - Only shows farms with status = true
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all farmhouses (Public) - Only shows active farms' })
  @ApiResponse({ status: 200, description: 'Farmhouses fetched successfully.' })
  async findAll(@Query() queryDto: QueryFarmhouseDto): Promise<CustomApiResponse<any>> {
    return this.productsService.findAll(queryDto);
  }

  // Get All Farmhouses for Admin - Shows all farms regardless of status
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all farmhouses for admin (shows all including inactive)' })
  @ApiResponse({ status: 200, description: 'Farmhouses fetched successfully.' })
  async findAllForAdmin(@Query() queryDto: QueryFarmhouseDto): Promise<CustomApiResponse<any>> {
    return this.productsService.findAllForAdmin(queryDto);
  }

  // Update Farmhouse Status (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update farmhouse status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Farmhouse status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: boolean },
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.updateStatus(id, body.status);
  }

  // Get Farmhouse by ID (Public)
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get farmhouse by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Farmhouse fetched successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CustomApiResponse<any>> {
    return this.productsService.findById(id);
  }

  // Update Farmhouse (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update farmhouse (Admin only)' })
  @ApiResponse({ status: 200, description: 'Farmhouse updated successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFarmhouseDto: UpdateFarmhouseDto,
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.update(id, updateFarmhouseDto);
  }

  // Delete Farmhouse (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete farmhouse (Admin only)' })
  @ApiResponse({ status: 200, description: 'Farmhouse deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<CustomApiResponse<any>> {
    return this.productsService.remove(id);
  }

  // Upload Images (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10, multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload images and videos for farmhouse (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Images and videos uploaded successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: MulterFile[],
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.uploadImages(id, files);
  }

  // Add Amenities (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/amenities')
  @ApiOperation({ summary: 'Add amenities to farmhouse (Admin only)' })
  @ApiResponse({ status: 200, description: 'Amenities added successfully.' })
  @ApiResponse({ status: 404, description: 'Farmhouse not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addAmenities(
    @Param('id', ParseIntPipe) id: number,
    @Body() amenities: AddAmenityDto[],
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.addAmenities(id, amenities);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':farmhouseId/images/:imageId')
  @ApiOperation({ summary: 'Delete a specific image from farmhouse (Admin only)' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  async deleteImage(
    @Param('farmhouseId', ParseIntPipe) farmhouseId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.deleteImage(farmhouseId, imageId);
  }


  // Delete Specific Amenity (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':farmhouseId/amenities/:amenityId')
  @ApiOperation({ summary: 'Delete amenity from farmhouse (Admin only)' })
  @ApiResponse({ status: 200, description: 'Amenity deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Amenity not found.' })
  async deleteAmenity(
    @Param('farmhouseId', ParseIntPipe) farmhouseId: number,
    @Param('amenityId', ParseIntPipe) amenityId: number,
  ): Promise<CustomApiResponse<any>> {
    return this.productsService.deleteAmenity(farmhouseId, amenityId);
  }
}

