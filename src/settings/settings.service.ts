import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ApiResponse } from 'src/common/responses/api-response';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings) private readonly settingsModel: typeof Settings,
  ) {}

  async getSettings() {
    try {
      // Get the first settings record, or create default if none exists
      let settings = await this.settingsModel.findOne();

      if (!settings) {
        // Create default settings
        settings = await this.settingsModel.create({
          heroSliders: [],
          appLogoLight: null,
          appLogoDark: null,
          loginDialogImage: null,
        } as any);
      }

      const settingsData: any = settings.toJSON();
      
      // Transform file paths to full URLs
      const heroSliders = (settingsData.heroSliders || []).map((file: string) => 
        file ? `uploads/static-images/${file}` : null
      ).filter((file: string | null) => file !== null);

      const appLogoLight = settingsData.appLogoLight 
        ? `uploads/static-images/${settingsData.appLogoLight}` 
        : null;
      
      const appLogoDark = settingsData.appLogoDark 
        ? `uploads/static-images/${settingsData.appLogoDark}` 
        : null;

      const loginDialogImage = settingsData.loginDialogImage 
        ? `uploads/static-images/${settingsData.loginDialogImage}` 
        : null;

      return new ApiResponse(false, 'Settings fetched successfully', {
        id: settingsData.id,
        heroSliders,
        appLogoLight,
        appLogoDark,
        loginDialogImage,
        createdAt: settingsData.createdAt,
        updatedAt: settingsData.updatedAt,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error fetching settings', error.message);
    }
  }

  async updateSettings(updateSettingsDto: UpdateSettingsDto) {
    try {
      // Get the first settings record, or create if none exists
      let settings = await this.settingsModel.findOne();

      if (!settings) {
        settings = await this.settingsModel.create({
          heroSliders: updateSettingsDto.heroSliders || [],
          appLogoLight: updateSettingsDto.appLogoLight || null,
          appLogoDark: updateSettingsDto.appLogoDark || null,
        } as any);
      } else {
        // Update existing settings
        const updateData: any = {};
        
        if (updateSettingsDto.heroSliders !== undefined) {
          updateData.heroSliders = updateSettingsDto.heroSliders;
        }
        
        if (updateSettingsDto.appLogoLight !== undefined) {
          updateData.appLogoLight = updateSettingsDto.appLogoLight;
        }
        
        if (updateSettingsDto.appLogoDark !== undefined) {
          updateData.appLogoDark = updateSettingsDto.appLogoDark;
        }

        await settings.update(updateData);
      }

      // Fetch updated settings
      const updatedSettings = await this.settingsModel.findOne();

      return new ApiResponse(false, 'Settings updated successfully', updatedSettings);
    } catch (error) {
      return new ApiResponse(true, 'Error updating settings', error.message);
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
      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uploadedFiles: string[] = [];

      for (const file of files) {
        const timestamp = Date.now();
        // Determine if it's a video or image
        const isVideo = file.mimetype.match(/\/(mp4|mov|avi|wmv|flv|webm|mkv)$/);
        const prefix = isVideo ? 'hero-slider-video' : 'hero-slider-image';
        const filename = `${prefix}-${timestamp}-${file.originalname}`;
        const filePath = path.join(uploadDir, filename);

        // Save file to disk
        fs.writeFileSync(filePath, file.buffer);

        uploadedFiles.push(filename);
      }

      // Get current settings
      let settings = await this.settingsModel.findOne();
      const currentSliders: string[] = settings?.heroSliders ? (settings.heroSliders as string[]) : [];

      // Add new files to existing sliders
      const updatedSliders = [...currentSliders, ...uploadedFiles];

      if (!settings) {
        settings = await this.settingsModel.create({
          heroSliders: updatedSliders,
          appLogoLight: null,
          appLogoDark: null,
        } as any);
      } else {
        await settings.update({ heroSliders: updatedSliders } as any);
      }

      return new ApiResponse(false, 'Hero slider files uploaded successfully', {
        uploadedFiles: uploadedFiles.map(f => `uploads/static-images/${f}`),
        totalSliders: updatedSliders.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading hero slider images', error.message);
    }
  }

  async uploadLogo(
    file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    mode: 'light' | 'dark'
  ) {
    try {
      if (!file) {
        return new ApiResponse(true, 'No file provided', null);
      }

      if (!mode || (mode !== 'light' && mode !== 'dark')) {
        return new ApiResponse(true, 'Invalid mode. Must be "light" or "dark"', null);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `logo-${mode}-${timestamp}-${file.originalname}`;
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Get current settings
      let settings = await this.settingsModel.findOne();

      if (!settings) {
        settings = await this.settingsModel.create({
          heroSliders: [],
          appLogoLight: mode === 'light' ? filename : null,
          appLogoDark: mode === 'dark' ? filename : null,
        } as any);
      } else {
        const updateData: any = {};
        if (mode === 'light') {
          // Delete old light logo if exists
          if (settings.appLogoLight) {
            const oldLogoPath = path.join(uploadDir, settings.appLogoLight as string);
            if (fs.existsSync(oldLogoPath)) {
              fs.unlinkSync(oldLogoPath);
            }
          }
          updateData.appLogoLight = filename;
        } else {
          // Delete old dark logo if exists
          if (settings.appLogoDark) {
            const oldLogoPath = path.join(uploadDir, settings.appLogoDark as string);
            if (fs.existsSync(oldLogoPath)) {
              fs.unlinkSync(oldLogoPath);
            }
          }
          updateData.appLogoDark = filename;
        }
        await settings.update(updateData);
      }

      return new ApiResponse(false, 'Logo uploaded successfully', {
        mode,
        logoUrl: `uploads/static-images/${filename}`,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading logo', error.message);
    }
  }

  async deleteHeroSlider(imageName: string) {
    try {
      // Get current settings
      const settings = await this.settingsModel.findOne();
      
      if (!settings) {
        return new ApiResponse(true, 'Settings not found', null);
      }

      const currentSliders: string[] = settings.heroSliders ? (settings.heroSliders as string[]) : [];
      
      // Check if image exists in sliders
      if (!currentSliders.includes(imageName)) {
        return new ApiResponse(true, 'Image not found in hero sliders', null);
      }

      // Remove from array
      const updatedSliders = currentSliders.filter(img => img !== imageName);
      await settings.update({ heroSliders: updatedSliders } as any);

      // Delete file from disk
      const uploadDir = path.join(process.cwd(), 'uploads', 'static-images');
      const filePath = path.join(uploadDir, imageName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return new ApiResponse(false, 'Hero slider file deleted successfully', {
        deletedFile: imageName,
        remainingSliders: updatedSliders.length,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error deleting hero slider file', error.message);
    }
  }

  async uploadLoginDialogImage(
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
      const filename = `login-dialog-${timestamp}-${file.originalname}`;
      const filePath = path.join(uploadDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Get current settings
      let settings = await this.settingsModel.findOne();

      if (!settings) {
        settings = await this.settingsModel.create({
          heroSliders: [],
          appLogoLight: null,
          appLogoDark: null,
          loginDialogImage: filename,
        } as any);
      } else {
        // Delete old login dialog image if exists
        if (settings.loginDialogImage) {
          const oldImagePath = path.join(uploadDir, settings.loginDialogImage as string);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        await settings.update({ loginDialogImage: filename } as any);
      }

      return new ApiResponse(false, 'Login dialog image uploaded successfully', {
        imageUrl: `uploads/static-images/${filename}`,
      });
    } catch (error) {
      return new ApiResponse(true, 'Error uploading login dialog image', error.message);
    }
  }
}

