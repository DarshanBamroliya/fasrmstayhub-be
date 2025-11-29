import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, Unique } from 'sequelize-typescript';

export type StaticPageType = 'houseRules' | 'privacyPolicy' | 'termsAndCondition' | 'cancellationPolicy';

@Table({ tableName: 'static_pages', timestamps: true })
export class StaticPage extends Model<StaticPage> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @Column(DataType.ENUM('houseRules', 'privacyPolicy', 'termsAndCondition', 'cancellationPolicy'))
  type: StaticPageType;

  @Column(DataType.STRING)
  title: string;

  @Column(DataType.TEXT)
  content: string;

  @Column(DataType.TEXT) // HTML content
  htmlContent: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
