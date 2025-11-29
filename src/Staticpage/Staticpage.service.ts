import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { StaticPage, StaticPageType } from './entities/Staticpage.model';
import { CreationAttributes } from 'sequelize';

@Injectable()
export class StaticPageService {
  constructor(
    @InjectModel(StaticPage)
    private staticPageModel: typeof StaticPage,
  ) {}

  // Get page by type
  async getPage(type: StaticPageType): Promise<Partial<StaticPage> | null> {
    const page = await this.staticPageModel.findOne({ where: { type } });
    if (!page) return null;

    // Return only needed fields including id
    const { id, type: pageType, title, content, htmlContent } = page.get({ plain: true });
    return { id, type: pageType, title, content, htmlContent };
  }

  // Create or update page by type
  async createOrUpdatePage(
    type: StaticPageType,
    title: string,
    content: string,
    htmlContent: string,
  ): Promise<Partial<StaticPage>> {
    let page = await this.staticPageModel.findOne({ where: { type } });

    if (page) {
      await page.update({ title, content, htmlContent } as Partial<StaticPage>);
    } else {
      page = await this.staticPageModel.create({
        type,
        title,
        content,
        htmlContent,
      } as CreationAttributes<StaticPage>);
    }

    // Convert to plain object to include `id`
    const { id, type: pageType, title: pageTitle, content: pageContent, htmlContent: pageHtml } =
      page.get({ plain: true });

    return {
      id,
      type: pageType,
      title: pageTitle,
      content: pageContent,
      htmlContent: pageHtml,
    };
  }
}
