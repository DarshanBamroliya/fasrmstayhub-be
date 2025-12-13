import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum ImageType {
  LOGO = 'logo',
  LOGIN_DIALOG = 'login_dialog',
  HERO_SLIDER = 'hero_slider',
}

@Table({ tableName: 'settings_images', timestamps: true })
export class SettingsImage extends Model<SettingsImage> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.ENUM(...Object.values(ImageType)),
    allowNull: false,
    comment: 'Type of image: logo, login_dialog, hero_slider',
  })
  declare imageType: ImageType;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Image filename/path',
  })
  declare imagePath: string;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}

