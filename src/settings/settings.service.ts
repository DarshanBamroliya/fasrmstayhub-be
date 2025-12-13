import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SettingsImage, ImageType } from './entities/settings-image.entity';
import { ApiResponse } from 'src/common/responses/api-response';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SettingsImage) private readonly settingsImageModel: typeof SettingsImage,
  ) { }

  // ============================================
  // GET APIs - Public
  // ============================================

  async getLogo() {
    try {
      const logo = await this.settingsImageModel.findOne({
        where: { imageType: ImageType.LOGO },
        order: [['createdAt', 'DESC']], // Get latest if multiple exist
      });

      return new ApiResponse(false, 'Logo fetched successfully', {
        logo: logo
          ? {
            id: logo.id,
            imagePath: logo.imagePath,
            url: `uploads/static-images/${logo.imagePath}`,
          }
          : null,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching logo', error.message);
    }
  }

  async getLoginImage() {
    try {
      const loginImage = await this.settingsImageModel.findOne({
        where: { imageType: ImageType.LOGIN_DIALOG },
        order: [['createdAt', 'DESC']], // Get latest if multiple exist
      });

      return new ApiResponse(false, 'Login image fetched successfully', {
        image: loginImage
          ? {
            id: loginImage.id,
            imagePath: loginImage.imagePath,
            url: `uploads/static-images/${loginImage.imagePath}`,
          }
          : null,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching login image', error.message);
    }
  }

  async getHeroSliders() {
    try {
      const heroSliders = await this.settingsImageModel.findAll({
        where: { imageType: ImageType.HERO_SLIDER },
        order: [['createdAt', 'ASC']],
      });

      return new ApiResponse(false, 'Hero sliders fetched successfully', {
        sliders: heroSliders.map((img: any) => ({
          id: img.id,
          imagePath: img.imagePath,
          url: `uploads/static-images/${img.imagePath}`,
        })),
        total: heroSliders.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching hero sliders', error.message);
    }
  }

  // ============================================
  // POST APIs - Admin Only
  // ============================================

  async uploadLogo(
    file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }
  ) {
    try {
      if (!file) {
        return new ApiResponse(true, 'No file provided', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `logo-${timestamp}${ext}`;
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Delete old logo if exists (replace behavior)
      const oldLogo = await this.settingsImageModel.findOne({
        where: { imageType: ImageType.LOGO },
        order: [['createdAt', 'DESC']],
      });

      if (oldLogo) {
        const oldFilePath = path.join(uploadDir, oldLogo.imagePath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
        await oldLogo.destroy();
      }

      // Create new logo record
      const newLogo = await this.settingsImageModel.create({
        imageType: ImageType.LOGO,
        imagePath: filename,
      } as any);

      return new ApiResponse(false, 'Logo uploaded successfully', {
        id: newLogo.id,
        imagePath: filename,
        url: `uploads/static-images/${filename}`,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading logo', error.message);
    }
  }

  async uploadLoginImage(
    file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }
  ) {
    try {
      if (!file) {
        return new ApiResponse(true, 'No file provided', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `login-dialog-${timestamp}${ext}`;
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Delete old login image if exists (replace behavior)
      const oldLoginImage = await this.settingsImageModel.findOne({
        where: { imageType: ImageType.LOGIN_DIALOG },
        order: [['createdAt', 'DESC']],
      });

      if (oldLoginImage) {
        const oldFilePath = path.join(uploadDir, oldLoginImage.imagePath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
        await oldLoginImage.destroy();
      }

      // Create new login image record
      const newLoginImage = await this.settingsImageModel.create({
        imageType: ImageType.LOGIN_DIALOG,
        imagePath: filename,
      } as any);

      return new ApiResponse(false, 'Login dialog image uploaded successfully', {
        id: newLoginImage.id,
        imagePath: filename,
        url: `uploads/static-images/${filename}`,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading login dialog image', error.message);
    }
  }

  async uploadHeroSliders(
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
      if (!files || files.length === 0) {
        return new ApiResponse(true, 'No files provided', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uploadedFiles: Array<{ id: number; imagePath: string; url: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Add small delay to ensure unique timestamps for simultaneous uploads
        // Same approach as product images - use timestamp only
        const timestamp = Date.now() + i; // Add index to ensure uniqueness
        const ext = path.extname(file.originalname).toLowerCase();
        // Use same format as product images: just timestamp + extension
        const filename = `${timestamp}${ext}`;
        const filePath = path.join(uploadDir, filename);

        // Save file to disk
        fs.writeFileSync(filePath, file.buffer);

        // Create image record (add behavior - no replace)
        const image = await this.settingsImageModel.create({
          imageType: ImageType.HERO_SLIDER,
          imagePath: filename,
        } as any);

        uploadedFiles.push({
          id: image.id,
          imagePath: filename,
          url: `uploads/static-images/${filename}`,
        });
      }

      return new ApiResponse(false, 'Hero slider files uploaded successfully', {
        uploadedFiles,
        totalUploaded: uploadedFiles.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading hero slider images', error.message);
    }
  }

  // ============================================
  // DELETE APIs - Admin Only
  // ============================================

  async deleteHeroSlider(id: number) {
    try {
      const image = await this.settingsImageModel.findOne({
        where: {
          id,
          imageType: ImageType.HERO_SLIDER,
        },
      });

      if (!image) {
        return new ApiResponse(true, 'Hero slider not found', null);
      }

      // Delete file from disk
      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      const filePath = path.join(uploadDir, image.imagePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await image.destroy();

      return new ApiResponse(false, 'Hero slider deleted successfully', {
        deletedId: id,
        deletedFile: image.imagePath,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error deleting hero slider', error.message);
    }
  }
}
