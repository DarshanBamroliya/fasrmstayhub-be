import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { Farmhouse } from './entities/farmhouse.entity';
import { Location } from './entities/location.entity';
import { PriceOption } from './entities/price-option.entity';
import { HouseRule } from './entities/house-rule.entity';
import { FarmhouseImage } from './entities/farmhouse-image.entity';
import { Amenity } from './entities/amenity.entity';
import { AmenityCategory } from './entities/amenity-category.entity';
import { FarmhouseAmenity } from './entities/farmhouse-amenity.entity';
import { CreateFarmhouseDto } from './dto/create-farmhouse.dto';
import { UpdateFarmhouseDto } from './dto/update-farmhouse.dto';
import { QueryFarmhouseDto, SortOrder } from './dto/query-farmhouse.dto';
import { ApiResponse } from 'src/common/responses/api-response';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Farmhouse) private readonly farmhouseModel: typeof Farmhouse,
    @InjectModel(Location) private readonly locationModel: typeof Location,
    @InjectModel(PriceOption) private readonly priceOptionModel: typeof PriceOption,
    @InjectModel(HouseRule) private readonly houseRuleModel: typeof HouseRule,
    @InjectModel(FarmhouseImage) private readonly farmhouseImageModel: typeof FarmhouseImage,
    @InjectModel(Amenity) private readonly amenityModel: typeof Amenity,
    @InjectModel(AmenityCategory) private readonly amenityCategoryModel: typeof AmenityCategory,
    @InjectModel(FarmhouseAmenity) private readonly farmhouseAmenityModel: typeof FarmhouseAmenity,
  ) { }

  // Create Farmhouse (Admin only)
  async create(createFarmhouseDto: CreateFarmhouseDto) {
    try {
      const { location, priceOptions, houseRules, ...farmhouseData } = createFarmhouseDto;

      // Check if slug already exists
      const existingFarmhouse = await this.farmhouseModel.findOne({
        where: { slug: farmhouseData.slug },
      });

      if (existingFarmhouse) {
        return new ApiResponse(true, 'Farmhouse with this slug already exists', null);
      }

      // Create farmhouse with transaction
      const farmhouse = await this.farmhouseModel.create(farmhouseData as any);

      // Create location if provided
      if (location) {
        await this.locationModel.create({
          ...location,
          farmhouseId: farmhouse.id,
        } as any);
      }

      // Create price options if provided
      if (priceOptions && priceOptions.length > 0) {
        await this.priceOptionModel.bulkCreate(
          priceOptions.map((option) => ({
            ...option,
            farmhouseId: farmhouse.id,
          })) as any,
        );
      }

      // Create house rules if provided
      if (houseRules && houseRules.length > 0) {
        await this.houseRuleModel.bulkCreate(
          houseRules.map((rule) => ({
            ...rule,
            farmhouseId: farmhouse.id,
          })) as any,
        );
      }

      // Fetch complete farmhouse with relations
      const createdFarmhouse = await this.findById(farmhouse.id);

      return new ApiResponse(false, 'Farmhouse created successfully', createdFarmhouse.data);
    } catch (error) {
      return new ApiResponse(true, 'Error creating farmhouse', error.message);
    }
  }

  // Get All Farmhouses (Public) - Only images, locations, rent, maxPersons, bedrooms, isRecomanded, isAmazing
  async findAll(queryDto: QueryFarmhouseDto) {
    try {
      const {
        search,
        city,
        priority,
        bedrooms,
        minPrice,
        maxPrice,
        sort = SortOrder.PRIORITY,
        page = 1,
        limit = 10,
      } = queryDto;

      const offset = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (priority) {
        where.priority = priority;
      }

      if (bedrooms) {
        where.bedrooms = bedrooms;
      }

      // Build location filter
      const locationWhere: any = {};
      if (city) {
        locationWhere.city = city;
      }
      if (search) {
        locationWhere.address = { [Op.like]: `%${search}%` };
      }

      // Build price filter
      const priceWhere: any = {};
      if (minPrice !== undefined) {
        priceWhere.price = { [Op.gte]: minPrice };
      }
      if (maxPrice !== undefined) {
        priceWhere.price = {
          ...priceWhere.price,
          [Op.lte]: maxPrice,
        };
      }

      // Build order clause
      let order: any[] = [];
      switch (sort) {
        case SortOrder.NEWEST:
          order = [['createdAt', 'DESC']];
          break;
        case SortOrder.PRICE_LOW:
          order = [
            [{ model: PriceOption, as: 'priceOptions' }, 'price', 'ASC'],
            [
              Sequelize.literal(`CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`),
              'ASC',
            ],
          ];
          break;
        case SortOrder.PRICE_HIGH:
          order = [
            [{ model: PriceOption, as: 'priceOptions' }, 'price', 'DESC'],
            [
              Sequelize.literal(`CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`),
              'ASC',
            ],
          ];
          break;
        case SortOrder.PRIORITY:
        default:
          order = [
            [
              Sequelize.literal(`CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`),
              'ASC',
            ],
            ['createdAt', 'DESC'],
          ];
          break;
      }

      // If search is provided, search in farmhouse name OR location address
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { '$location.address$': { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows } = await this.farmhouseModel.findAndCountAll({
        where,
        include: [
          {
            model: Location,
            as: 'location',
            where: Object.keys(locationWhere).length > 0 && !search ? locationWhere : undefined,
            required: false,
          },
          {
            model: PriceOption,
            as: 'priceOptions',
            where: Object.keys(priceWhere).length > 0 ? priceWhere : undefined,
            required: false,
          },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            separate: true,
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
          },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      // Transform data to return only required fields
      const farmhouses = rows.map((farmhouse: any) => {
        const farmhouseData = farmhouse.toJSON();
        return {
          id: farmhouseData.id,
          name: farmhouseData.name,
          slug: farmhouseData.slug,
          maxPersons: farmhouseData.maxPersons,
          bedrooms: farmhouseData.bedrooms,
          isRecomanded: farmhouseData.isRecomanded,
          isAmazing: farmhouseData.isAmazing,
          images: farmhouseData.images?.map((img: any) => ({
            id: img.id,
            imagePath: `/uploads/farm-product/${img.imagePath}`,
            isMain: img.isMain,
            ordering: img.ordering,
          })) || [],
          location: farmhouseData.location
            ? {
              id: farmhouseData.location.id,
              address: farmhouseData.location.address,
              city: farmhouseData.location.city,
              state: farmhouseData.location.state,
              latitude: farmhouseData.location.latitude,
              longitude: farmhouseData.location.longitude,
            }
            : null,
          rent: farmhouseData.priceOptions?.map((price: any) => ({
            id: price.id,
            category: price.category,
            hours: price.hours,
            price: price.price,
            maxPeople: price.maxPeople,
          })) || [],
        };
      });

      return new ApiResponse(false, 'Farmhouses fetched successfully', {
        farmhouses,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching farmhouses', error.message);
    }
  }

  // Get Farmhouse by ID (Public)
  async findById(id: number) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(id, {
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
            model: HouseRule,
            as: 'houseRules',
          },
          {
            model: FarmhouseImage,
            as: 'images',
            attributes: ['id', 'imagePath', 'isMain', 'ordering'],
            order: [['ordering', 'ASC'], ['isMain', 'DESC']],
          },
          {
            model: FarmhouseAmenity,
            as: 'farmhouseAmenities',
            include: [
              {
                model: Amenity,
                as: 'amenity',
                attributes: ['id', 'name'],
              },
              {
                model: AmenityCategory,
                as: 'category',
                attributes: ['id', 'name'],
              },
            ],
          },
        ],
      });

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const farmhouseData: any = farmhouse.toJSON();

      // Transform images to include full URL
      if (farmhouseData.images) {
        farmhouseData.images = farmhouseData.images.map((img: any) => ({
          ...img,
          imagePath: `/uploads/farm-product/${img.imagePath}`,
        }));
      }

      return new ApiResponse(false, 'Farmhouse fetched successfully', farmhouseData);
    } catch (error) {
      return new ApiResponse(true, 'Error fetching farmhouse', error.message);
    }
  }

  // Update Farmhouse (Admin only)
  async update(id: number, updateFarmhouseDto: UpdateFarmhouseDto) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(id);

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const { location, priceOptions, houseRules, ...farmhouseData } = updateFarmhouseDto;

      // Update farmhouse
      if (Object.keys(farmhouseData).length > 0) {
        await farmhouse.update(farmhouseData as any);
      }

      // Update location if provided
      if (location) {
        const existingLocation = await this.locationModel.findOne({
          where: { farmhouseId: id },
        });

        if (existingLocation) {
          await existingLocation.update(location as any);
        } else {
          await this.locationModel.create({
            ...location,
            farmhouseId: id,
          } as any);
        }
      }

      // Update price options if provided
      if (priceOptions && priceOptions.length > 0) {
        // Delete existing price options
        await this.priceOptionModel.destroy({ where: { farmhouseId: id } });
        // Create new ones
        await this.priceOptionModel.bulkCreate(
          priceOptions.map((option) => ({
            ...option,
            farmhouseId: id,
          })) as any,
        );
      }

      // Update house rules if provided
      if (houseRules && houseRules.length > 0) {
        // Delete existing rules
        await this.houseRuleModel.destroy({ where: { farmhouseId: id } });
        // Create new ones
        await this.houseRuleModel.bulkCreate(
          houseRules.map((rule) => ({
            ...rule,
            farmhouseId: id,
          })) as any,
        );
      }

      // Fetch updated farmhouse
      const updatedFarmhouse = await this.findById(id);

      return new ApiResponse(false, 'Farmhouse updated successfully', updatedFarmhouse.data);
    } catch (error) {
      return new ApiResponse(true, 'Error updating farmhouse', error.message);
    }
  }

  // Delete Farmhouse (Admin only)
  async remove(id: number) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(id);

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const images = await this.farmhouseImageModel.findAll({
        where: { farmhouseId: id },
      });

      const uploadDir = path.join(process.cwd(), 'uploads', 'farm-product');

      for (const image of images) {
        if (image.imagePath) {
          const imagePath = path.join(uploadDir, image.imagePath);

          try {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          } catch (err) {
            console.log(`Error deleting file: ${imagePath}`, err.message);
          }
        }
      }

      // Delete related images records from DB
      await this.farmhouseImageModel.destroy({
        where: { farmhouseId: id },
      });

      // Finally delete farmhouse entry
      await farmhouse.destroy();

      return new ApiResponse(false, 'Farmhouse deleted successfully', null);

    } catch (error) {
      console.error(error);
      return new ApiResponse(true, 'Error deleting farmhouse', error.message);
    }
  }

  // Upload Images and Videos (Admin only)
  async uploadImages(
    farmhouseId: number,
    files: Array<{
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }>
  ) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId);

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'farm-product');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uploadedFiles: Array<{
        id: number;
        farmhouseId: number;
        filePath: string;
        isMain: boolean;
        ordering: number;
        type: 'image' | 'video';
      }> = [];

      for (const file of files) {
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.originalname}`;
        const filePath = path.join(uploadDir, filename);

        // Save file to disk
        fs.writeFileSync(filePath, file.buffer);

        // Determine file type
        const isVideo = file.mimetype.match(/\/(mp4|mov|avi|wmv|flv|webm|mkv)$/);
        const fileType: 'image' | 'video' = isVideo ? 'video' : 'image';

        // Get max ordering for this farmhouse
        const maxOrdering = (await this.farmhouseImageModel.max('ordering', {
          where: { farmhouseId },
        })) as number | null;

        // Save record to DB
        const image = await this.farmhouseImageModel.create({
          farmhouseId,
          imagePath: filename,
          isMain: false,
          ordering: (maxOrdering ?? 0) + 1,
        } as any);

        // Push to response array
        uploadedFiles.push({
          id: image.id,
          farmhouseId,
          filePath: `/uploads/farm-product/${filename}`,
          isMain: image.isMain,
          ordering: image.ordering,
          type: fileType,
        });
      }

      return new ApiResponse(false, 'Files uploaded successfully', {
        farmhouseId,
        files: uploadedFiles,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading files', error.message);
    }
  }

  async addAmenities(
    farmhouseId: number,
    amenities: Array<{ name: string; quantity: number; category?: string }>
  ) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(farmhouseId);
      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      const results: any[] = [];

      for (const item of amenities) {
        try {
          const amenityName = item.name.trim();
          const categoryName = item.category?.trim() || 'Common';

          let amenity = await this.amenityModel.findOne({ where: { name: amenityName } });
          if (!amenity) {
            amenity = await this.amenityModel.create({ name: amenityName } as any);
          }

          let category = await this.amenityCategoryModel.findOne({ where: { name: categoryName } });
          if (!category) {
            category = await this.amenityCategoryModel.create({ name: categoryName } as any);
          }

          const existing = await this.farmhouseAmenityModel.findOne({
            where: { farmhouseId, amenityId: amenity.id },
          });

          if (item.quantity === 0) {
            if (existing) {
              await existing.destroy();
              results.push({
                farmhouseId,
                amenity: amenityName,
                category: categoryName,
                previousQuantity: existing.quantity,
                status: 'removed',
              });
            }
            continue;
          }

          if (existing) {
            const oldQuantity = existing.quantity;
            await existing.update({ quantity: item.quantity, categoryId: category.id });

            results.push({
              farmhouseId,
              amenity: amenityName,
              category: categoryName,
              previousQuantity: oldQuantity,
              quantity: item.quantity,
              status: oldQuantity === item.quantity ? 'no-change' : 'updated',
            });
          } else {
            await this.farmhouseAmenityModel.create({
              farmhouseId,
              amenityId: amenity.id,
              categoryId: category.id,
              quantity: item.quantity,
            } as any);

            results.push({
              farmhouseId,
              amenity: amenityName,
              category: categoryName,
              quantity: item.quantity,
              status: 'added',
            });
          }

        } catch (err) {
          results.push({
            farmhouseId,
            amenity: item.name,
            category: item.category || 'Common',
            quantity: item.quantity,
            status: 'error',
            message: err.message,
          });
        }
      }

      return new ApiResponse(false, 'Amenities processed', {
        farmhouseId,
        updates: results
      });

    } catch (err) {
      return new ApiResponse(true, 'Internal Error', err.message);
    }
  }



  async deleteImage(farmhouseId: number, imageId: number) {
    try {
      const image = await this.farmhouseImageModel.findOne({
        where: { id: imageId, farmhouseId },
      });

      if (!image) {
        return new ApiResponse(true, 'Image not found', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'farm-product');
      const imagePath = path.join(uploadDir, image.imagePath);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      await image.destroy();

      return new ApiResponse(false, 'Image deleted successfully', {
        farmhouseId,
        imageId,
        message: 'File removed from DB and uploads folder'
      });

    } catch (error) {
      return new ApiResponse(true, 'Error deleting image', error.message);
    }
  }
  async deleteAmenity(farmhouseId: number, amenityId: number) {
    try {
      const record = await this.farmhouseAmenityModel.findOne({
        where: { farmhouseId, amenityId },
      });

      if (!record) {
        return new ApiResponse(true, 'Amenity not found in this farmhouse', null);
      }

      await record.destroy();

      return new ApiResponse(false, 'Amenity deleted successfully', {
        farmhouseId,
        amenityId
      });

    } catch (error) {
      return new ApiResponse(true, 'Error deleting amenity', error.message);
    }
  }

}

