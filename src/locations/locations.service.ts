import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Location } from '../products/entities/location.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { ApiResponse } from 'src/common/responses/api-response';

@Injectable()
export class LocationsService {
    constructor(
        @InjectModel(Location) private readonly locationModel: typeof Location,
        @InjectModel(Farmhouse) private readonly farmhouseModel: typeof Farmhouse,
        @InjectModel(FarmhouseImage) private readonly farmhouseImageModel: typeof FarmhouseImage,
        @InjectModel(PriceOption) private readonly priceOptionModel: typeof PriceOption,
    ) { }

    // Create a new location (Admin only)
    async create(CreateLocationDto: CreateLocationDto) {
        try {
            // Check if location with same city and state already exists
            // Build a where clause that only includes nearby when provided,
            // to avoid passing null (which breaks TS typing for Sequelize where)
            const where: any = {
                city: CreateLocationDto.city,
                state: CreateLocationDto.state,
            };
            if (CreateLocationDto.nearby) {
                where.nearby = CreateLocationDto.nearby;
            }

            const existingLocation = await this.locationModel.findOne({ where });

            if (existingLocation) {
                return new ApiResponse(
                    true,
                    'Location with this city and state already exists',
                    null,
                );
            }

            // Create location with explicit null values for optional fields
            const location = await this.locationModel.create({
                city: CreateLocationDto.city,
                state: CreateLocationDto.state,
                nearby: CreateLocationDto.nearby || null,
                address: null,
                latitude: null,
                longitude: null,
                farmhouseId: null, // Standalone location, not tied to a farmhouse
            } as any);

            return new ApiResponse(false, 'Location created successfully', {
                id: location.id,
                nearby: location.nearby,
                city: location.city,
                state: location.state,
            });
        } catch (error) {
            return new ApiResponse(true, 'Error creating location', error.message);
        }
    }

    // Get all unique locations (Public)
    async findAll() {
        try {
            // Fetch all locations without GROUP BY to avoid ONLY_FULL_GROUP_BY errors
            const locations = await this.locationModel.findAll({
                attributes: ['city', 'state', 'nearby'],
                order: [['city', 'ASC']],
            });

            // Derive unique cities
            const cities = Array.from(new Set(locations.map((loc: any) => loc.city)));

            return new ApiResponse(false, 'Locations fetched successfully', {
                locations: locations.map((loc: any) => ({
                    nearby: loc.nearby,
                    city: loc.city,
                    state: loc.state,
                })),
                cities: Array.from(new Set(locations.map((loc: any) => loc.city))),
                total: locations.length,
            });
        } catch (error) {
            return new ApiResponse(true, 'Error fetching locations', error.message);
        }
    }

    // Get all unique cities only (Public)
    async getCities() {
        try {
            const uniqueCities = await this.locationModel.findAll({
                attributes: ['city'],
                group: ['city'],
                order: [['city', 'ASC']],
            });

            const cities = uniqueCities.map((loc: any) => loc.city);

            return new ApiResponse(false, 'Cities fetched successfully', {
                cities,
                total: cities.length,
            });
        } catch (error) {
            return new ApiResponse(true, 'Error fetching cities', error.message);
        }
    }

    // Get all properties grouped by location (Public)
    async getPropertiesByLocation() {
        try {
            // Get all unique cities
            const uniqueCities = await this.locationModel.findAll({
                attributes: ['city'],
                group: ['city'],
                order: [['city', 'ASC']],
            });

            const cities = uniqueCities.map((loc: any) => loc.city);

            // For each city, get all farmhouses
            const locationData = await Promise.all(
                cities.map(async (city) => {
                    // Get all farmhouses for this city
                    const farmhouses = await this.farmhouseModel.findAll({
                        where: { status: true }, // Only active farmhouses
                        include: [
                            {
                                model: Location,
                                as: 'location',
                                where: { city },
                                required: true,
                            },
                            {
                                model: FarmhouseImage,
                                as: 'images',
                                attributes: ['id', 'imagePath', 'isMain', 'ordering'],
                                separate: true,
                                order: [['ordering', 'ASC'], ['isMain', 'DESC']],
                            },
                            {
                                model: PriceOption,
                                as: 'priceOptions',
                                separate: true,
                                order: [['category', 'ASC']],
                            },
                        ],
                    });

                    // Format farmhouses data
                    const properties = farmhouses.map((farmhouse: any) => {
                        const f = farmhouse.toJSON();
                        return {
                            id: f.id,
                            name: f.name,
                            slug: f.slug,
                            maxPersons: f.maxPersons,
                            bedrooms: f.bedrooms,
                            isRecomanded: f.isRecomanded,
                            isAmazing: f.isAmazing,
                            farmNo: f.farmNo,
                            images: f.images?.map((img: any) => ({
                                id: img.id,
                                imagePath: `uploads/farm-product/${img.imagePath}`,
                                isMain: img.isMain,
                                ordering: img.ordering,
                            })) || [],
                            location: f.location
                                ? {
                                    id: f.location.id,
                                    address: f.location.address,
                                    city: f.location.city,
                                    state: f.location.state,
                                    latitude: f.location.latitude,
                                    longitude: f.location.longitude,
                                }
                                : null,
                            rent: f.priceOptions?.map((p: any) => ({
                                id: p.id,
                                category: p.category,
                                price: p.price,
                                maxPeople: p.maxPeople,
                            })) || [],
                        };
                    });

                    return {
                        city,
                        propertyCount: properties.length,
                        properties,
                    };
                })
            );

            // Filter out cities with no properties
            const locationsWithProperties = locationData.filter(
                (loc) => loc.propertyCount > 0
            );

            return new ApiResponse(false, 'Properties by location fetched successfully', {
                locations: locationsWithProperties,
                totalLocations: locationsWithProperties.length,
                totalProperties: locationsWithProperties.reduce(
                    (sum, loc) => sum + loc.propertyCount,
                    0
                ),
            });
        } catch (error) {
            return new ApiResponse(
                true,
                'Error fetching properties by location',
                error.message
            );
        }
    }

    // Get all properties for a specific city (Public)
    async getPropertiesByCity(city: string) {
        try {
            // Fetch all active farmhouses for the given city
            const farmhouses = await this.farmhouseModel.findAll({
                where: { status: true }, // Only active farmhouses
                include: [
                    {
                        model: Location,
                        as: 'location',
                        where: { city },
                        required: true,
                    },
                    {
                        model: FarmhouseImage,
                        as: 'images',
                        attributes: ['id', 'imagePath', 'isMain', 'ordering'],
                        separate: true,
                        order: [['ordering', 'ASC'], ['isMain', 'DESC']],
                    },
                    {
                        model: PriceOption,
                        as: 'priceOptions',
                        separate: true,
                        order: [['category', 'ASC']],
                    },
                ],
            });

            // Format farmhouses data
            const properties = farmhouses.map((farmhouse: any) => {
                const f = farmhouse.toJSON();
                return {
                    id: f.id,
                    name: f.name,
                    slug: f.slug,
                    maxPersons: f.maxPersons,
                    bedrooms: f.bedrooms,
                    isRecomanded: f.isRecomanded,
                    isAmazing: f.isAmazing,
                    farmNo: f.farmNo,
                    images: f.images?.map((img: any) => ({
                        id: img.id,
                        imagePath: `uploads/farm-product/${img.imagePath}`,
                        isMain: img.isMain,
                        ordering: img.ordering,
                    })) || [],
                    location: f.location
                        ? {
                            id: f.location.id,
                            address: f.location.address,
                            city: f.location.city,
                            state: f.location.state,
                            latitude: f.location.latitude,
                            longitude: f.location.longitude,
                        }
                        : null,
                    rent: f.priceOptions?.map((p: any) => ({
                        id: p.id,
                        category: p.category,
                        price: p.price,
                        maxPeople: p.maxPeople,
                    })) || [],
                };
            });

            return new ApiResponse(false, 'Properties fetched successfully', {
                city,
                propertyCount: properties.length,
                properties,
            });
        } catch (error) {
            return new ApiResponse(true, 'Error fetching properties for city', error.message);
        }
    }
}
