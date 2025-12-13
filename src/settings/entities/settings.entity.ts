import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { SettingsImage } from './settings-image.entity';

@Table({ tableName: 'settings', timestamps: true })
export class Settings extends Model<Settings> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => SettingsImage)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'App logo for light mode - reference to settings_images.id',
  })
  declare appLogoLightId: number;

  @ForeignKey(() => SettingsImage)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'App logo for dark mode - reference to settings_images.id',
  })
  declare appLogoDarkId: number;

  @ForeignKey(() => SettingsImage)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Login dialog image - reference to settings_images.id',
  })
  declare loginDialogImageId: number;

  @BelongsTo(() => SettingsImage, { foreignKey: 'appLogoLightId', as: 'appLogoLight' })
  declare appLogoLight: SettingsImage;

  @BelongsTo(() => SettingsImage, { foreignKey: 'appLogoDarkId', as: 'appLogoDark' })
  declare appLogoDark: SettingsImage;

  @BelongsTo(() => SettingsImage, { foreignKey: 'loginDialogImageId', as: 'loginDialogImage' })
  declare loginDialogImage: SettingsImage;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}

