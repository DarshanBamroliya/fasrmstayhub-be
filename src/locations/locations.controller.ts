import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationApiDto } from './dto/create-location.dto';
import { ApiResponse as CustomApiResponse } from 'src/common/responses/api-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Locations')
@Controller('api/locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    // Create Location (Admin only)
    @UseGuards(JwtAuthGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @Post()
    @ApiOperation({ summary: 'Create a new location (Admin only)' })
    @ApiResponse({ status: 201, description: 'Location created successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async create(
        @Body() CreateLocationApiDto: CreateLocationApiDto,
    ): Promise<CustomApiResponse<any>> {
        return this.locationsService.create(CreateLocationApiDto);
    }

    // Get All Locations (Public)
    @Public()
    @Get()
    @ApiOperation({ summary: 'Get all locations with unique cities (Public)' })
    @ApiResponse({ status: 200, description: 'Locations fetched successfully.' })
    async findAll(): Promise<CustomApiResponse<any>> {
        return this.locationsService.findAll();
    }

    // Get All Cities (Public)
    @Public()
    @Get('cities')
    @ApiOperation({ summary: 'Get all unique cities (Public)' })
    @ApiResponse({ status: 200, description: 'Cities fetched successfully.' })
    async getCities(): Promise<CustomApiResponse<any>> {
        return this.locationsService.getCities();
    }

    // Get All Properties Grouped by Location (Public)
    @Public()
    @Get('properties')
    @ApiOperation({ summary: 'Get all properties grouped by location (Public)' })
    @ApiResponse({ status: 200, description: 'Properties by location fetched successfully.' })
    async getPropertiesByLocation(): Promise<CustomApiResponse<any>> {
        return this.locationsService.getPropertiesByLocation();
    }

    // Get All Properties for a City (Public)
    @Public()
    @Get('properties/:city')
    @ApiOperation({ summary: 'Get all properties for a specific city (Public)' })
    @ApiResponse({ status: 200, description: 'Properties for city fetched successfully.' })
    async getPropertiesByCity(
        @Param('city') city: string,
    ): Promise<CustomApiResponse<any>> {
        return this.locationsService.getPropertiesByCity(city);
    }
}
