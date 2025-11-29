import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse as SwaggerResponse, ApiParam } from '@nestjs/swagger';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { StaticPageService } from './Staticpage.service';
import { UpdateHtmlContentDto } from './dto/html-content.dto';
import { ApiResponse } from 'src/common/responses/api-response';

export enum StaticPageTypeEnum {
  HOUSE_RULES = 'houseRules',
  PRIVACY_POLICY = 'privacyPolicy',
  TERMS_AND_CONDITION = 'termsAndCondition',
  CANCELLATION_POLICY = 'cancellationPolicy',
}

@Controller('static-pages')
export class StaticPageController {
  constructor(private readonly staticPageService: StaticPageService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':type')
  @ApiOperation({ summary: 'Update HTML content for a static page (Admin only)' })
  @SwaggerResponse({ status: 200, description: 'Page updated successfully.' })
  @ApiParam({
    name: 'type',
    enum: StaticPageTypeEnum,
    description: 'Select the type of static page',
  })
  async updateHtmlContent(
    @Param('type') type: StaticPageTypeEnum,
    @Body() body: UpdateHtmlContentDto,
  ) {
    try {
      const titleMap = {
        houseRules: 'House Rules',
        privacyPolicy: 'Privacy Policy',
        termsAndCondition: 'Terms and Conditions',
        cancellationPolicy: 'Cancellation Policy',
      };
      const title = titleMap[type] || 'Static Page';

      const content = body.htmlContent.replace(/<[^>]+>/g, '').trim();

      const page = await this.staticPageService.createOrUpdatePage(
        type,
        title,
        content,
        body.htmlContent,
      );

      if (!page) {
        throw new BadRequestException('Failed to create or update page');
      }

      return new ApiResponse(
        false, // error
        'Page updated successfully',
        {
          id: page.id,
          type: page.type,
          title: page.title,
          content: page.content,
          htmlContent: page.htmlContent,
        },
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(err.message || 'Internal server error');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get(':type')
  @ApiOperation({ summary: 'Get static page content (Admin only)' })
  @SwaggerResponse({ status: 200, description: 'Page retrieved successfully.' })
  @SwaggerResponse({ status: 404, description: 'Page not found' })
  @SwaggerResponse({ status: 500, description: 'Internal server error' })
  @ApiParam({
    name: 'type',
    enum: StaticPageTypeEnum,
    description: 'Select the type of static page',
  })
  async getPage(@Param('type') type: StaticPageTypeEnum) {
    try {
      const page = await this.staticPageService.getPage(type);

      if (!page) {
        throw new BadRequestException('Page not found');
      }

      return new ApiResponse(
        false, // error
        'Page retrieved successfully',
        {
          id: page.id,
          type: page.type,
          title: page.title,
          content: page.content,
          htmlContent: page.htmlContent,
        },
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(err.message || 'Internal server error');
    }
  }
}
