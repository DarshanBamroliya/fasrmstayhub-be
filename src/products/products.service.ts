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
import { EnquiryWhatsappDto } from './dto/enquiry-whatsapp.dto';

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
      const { location, priceOptions, ...farmhouseData } = createFarmhouseDto;

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

      // House rules removed from create API

      // Fetch complete farmhouse with relations
      const createdFarmhouse = await this.findById(farmhouse.id);

      return new ApiResponse(false, 'Farmhouse created successfully', createdFarmhouse.data);
    } catch (error) {
      return new ApiResponse(true, 'Error creating farmhouse', error.message);
    }
  }

  // Update Farmhouse Status (Admin only)
  async updateStatus(id: number, status: boolean) {
    try {
      const farmhouse = await this.farmhouseModel.findByPk(id);

      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      await farmhouse.update({ status });

      return new ApiResponse(false, 'Farmhouse status updated successfully', {
        id: farmhouse.id,
        status,
      });

    } catch (error) {
      return new ApiResponse(true, 'Error updating farmhouse status', error.message);
    }
  }


  // Get All Farmhouses for Admin - Shows all farms regardless of status
 async findAllForAdmin(queryDto: QueryFarmhouseDto) {
  try {
    const {
      search,
      priority,
      page = 1,
      limit = 10,
    } = queryDto;

    const offset = (page - 1) * limit;

    // Step 1: First get IDs and total count in a separate query
    const whereClause: any = {};
    
    if (priority) whereClause.priority = priority;

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { farmNo: { [Op.like]: `%${search}%` } },
      ];
    }

    // Get total count WITHOUT includes first
    const totalCount = await this.farmhouseModel.count({
      where: whereClause
    });

    console.log(`Total farmhouses in DB: ${totalCount}`);

    // If searching by location, we need to handle it differently
    if (search) {
      // Also check location for search
      const farmhousesWithLocation = await this.farmhouseModel.findAll({
        attributes: ['id'],
        include: [{
          model: Location,
          as: 'location',
          required: false,
          where: {
            address: { [Op.like]: `%${search}%` }
          }
        }],
        where: whereClause,
        raw: true
      });

      const locationSearchIds = farmhousesWithLocation
        .filter(f => f['location.id']) // Has location matching search
        .map(f => f.id);

      // Add location search IDs to OR condition
      if (locationSearchIds.length > 0) {
        if (!whereClause[Op.or]) whereClause[Op.or] = [];
        whereClause[Op.or].push({ id: { [Op.in]: locationSearchIds } });
      }
    }

    // Step 2: Now fetch farmhouses with pagination
    const farmhouses = await this.farmhouseModel.findAll({
      where: whereClause,
      include: [
        {
          model: Location,
          as: 'location',
          required: false,
        },
        {
          model: FarmhouseImage,
          as: 'images',
          attributes: ['id', 'imagePath', 'isMain', 'ordering'],
          separate: true, // Critical: loads separately to avoid duplication
          order: [
            ['ordering', 'ASC'],
            ['isMain', 'DESC'],
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      // Don't use subQuery: false unless absolutely necessary
    });

    console.log(`Found ${farmhouses.length} farmhouses after query`);

    // Step 3: Get price options separately to avoid join issues
    const farmhouseIds = farmhouses.map(f => f.id);
    let priceOptionsMap = new Map<number, any[]>();

    if (farmhouseIds.length > 0) {
      const priceOptions = await this.priceOptionModel.findAll({
        where: {
          farmhouseId: { [Op.in]: farmhouseIds }
        },
        order: [['category', 'ASC']]
      });

      // Group price options by farmhouseId
      priceOptions.forEach(option => {
        const farmhouseId = option.farmhouseId;
        if (!priceOptionsMap.has(farmhouseId)) {
          priceOptionsMap.set(farmhouseId, []);
        }
        priceOptionsMap.get(farmhouseId)!.push(option.toJSON());
      });
    }

    // Format Response
    const formattedFarmhouses = farmhouses.map((farmhouse: any) => {
      const data = farmhouse.toJSON();
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        maxPersons: data.maxPersons,
        priority: data.priority,
        bedrooms: data.bedrooms,
        isRecomanded: data.isRecomanded,
        isAmazing: data.isAmazing,
        status: data.status,
        farmNo: data.farmNo,
        images: data.images?.map((img: any) => ({
          id: img.id,
          imagePath: img.imagePath,
          isMain: img.isMain,
          ordering: img.ordering,
        })) || [],
        location: data.location
          ? {
            id: data.location.id,
            address: data.location.address,
            city: data.location.city,
            state: data.location.state,
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          }
          : null,
        rent: priceOptionsMap.get(data.id) || [],
      };
    });

    return new ApiResponse(false, 'Farmhouses fetched successfully', {
      farmhouses: formattedFarmhouses,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching farmhouses:', error);
    return new ApiResponse(true, 'Error fetching farmhouses', error.message);
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
        sort = SortOrder.ASC, // default asc
        page = 1,
        limit = 10,
      } = queryDto;

      const offset = (page - 1) * limit;

      // WHERE CLAUSE
      const where: any = { status: true };

      if (priority) where.priority = priority;
      if (bedrooms) where.bedrooms = bedrooms;

      // LOCATION FILTER
      const locationWhere: any = {};
      if (city) locationWhere.city = city;
      if (search) {
        locationWhere.address = { [Op.like]: `%${search}%` };
      }

      // PRICE FILTER
      const priceWhere: any = {};
      if (minPrice !== undefined) priceWhere.price = { [Op.gte]: minPrice };
      if (maxPrice !== undefined)
        priceWhere.price = { ...(priceWhere.price || {}), [Op.lte]: maxPrice };

      // ✅ ASC / DESC Logic Only
      let order: any[] = [];

      // SEARCH: name OR location.address
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { '$location.address$': { [Op.like]: `%${search}%` } },
        ];
      }

      // QUERY
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

      // RESPONSE TRANSFORM
      const farmhouses = rows.map((farmhouse: any) => {
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
          imagePath: `uploads/farm-product/${img.imagePath}`,
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
      // 1️⃣ Find existing farmhouse
      const farmhouse = await this.farmhouseModel.findByPk(id);
      if (!farmhouse) {
        return new ApiResponse(true, 'Farmhouse not found', null);
      }

      // 2️⃣ Separate related entities from main farmhouse fields
      const { location, priceOptions, ...farmhouseData } = updateFarmhouseDto;

      // 3️⃣ Update main farmhouse fields if provided
      if (Object.keys(farmhouseData).length > 0) {
        await farmhouse.update(farmhouseData as any);
      }

      // 4️⃣ Update location if provided
      if (location) {
        const existingLocation = await this.locationModel.findOne({ where: { farmhouseId: id } });
        if (existingLocation) {
          await existingLocation.update(location as any);
        } else {
          await this.locationModel.create({ ...location, farmhouseId: id } as any);
        }
      }

      // 5️⃣ Update price options if provided
      if (priceOptions) {
        // Delete all existing price options
        await this.priceOptionModel.destroy({ where: { farmhouseId: id } });

        // Add new ones if array is not empty
        if (priceOptions.length > 0) {
          await this.priceOptionModel.bulkCreate(
            priceOptions.map(option => ({ ...option, farmhouseId: id })) as any
          );
        }
      }

      // 6️⃣ Fetch the updated farmhouse
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

      // ✅ FIX 1 — add type so array is not NEVER[]
      const uploadedFiles: {
        id: number;
        farmhouseId: number;
        filePath: string;
        isMain: boolean;
        ordering: number;
        type: 'image' | 'video';
      }[] = [];

      for (const file of files) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();

        const filename = `${timestamp}${ext}`;
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, file.buffer);

        const isVideo = file.mimetype.startsWith("video/");
        const fileType: 'image' | 'video' = isVideo ? 'video' : 'image';

        const maxOrdering = (await this.farmhouseImageModel.max('ordering', {
          where: { farmhouseId },
        })) as number | null;

        // ✅ FIX 2 — cast object as ANY (only place needed)
        const image = await this.farmhouseImageModel.create({
          farmhouseId,
          imagePath: filename,
          isMain: false,
          ordering: (maxOrdering ?? 0) + 1,
        } as any);

        uploadedFiles.push({
          id: image.id,
          farmhouseId,
          filePath: `uploads/farm-product/${filename}`,
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

  async upsertAmenities(
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

          // DELETE (quantity = 0)
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

          // UPDATE
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
          }
          // CREATE
          else {
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

  // Build WhatsApp link for enquiry using farmhouse contact or provided phone
  async getWhatsappEnquiryLink(dto: EnquiryWhatsappDto) {
    try {
      const { farmhouseId, phone, message } = dto;

      let targetPhone = phone?.trim();

      if (!targetPhone && farmhouseId) {
        const farmhouse = await this.farmhouseModel.findByPk(farmhouseId, { attributes: ['id', 'name', 'farmNo', 'contactNumber', 'mobileNo'] });
        if (!farmhouse) return new ApiResponse(true, 'Farmhouse not found', null);
        const f: any = farmhouse.toJSON();
        targetPhone = f.contactNumber || f.mobileNo || null;
      }

      if (!targetPhone) {
        return new ApiResponse(true, 'No phone available for this farmhouse. Provide phone in request.', null);
      }

      // sanitize phone: remove non-digit and plus
      let digits = targetPhone.replace(/[^\d+]/g, '');
      if (digits.startsWith('+')) digits = digits.slice(1);
      digits = digits.replace(/\D/g, '');

      const encoded = encodeURIComponent(message || '');
      const waUrl = `https://wa.me/${digits}?text=${encoded}`;

      return new ApiResponse(false, 'WhatsApp link generated', { url: waUrl, phone: digits });
    } catch (err: any) {
      return new ApiResponse(true, 'Error generating WhatsApp link', err.message);
    }
  }

}

