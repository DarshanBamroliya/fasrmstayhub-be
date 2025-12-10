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
} from 'sequelize-typescript';

@Table({ tableName: 'settings', timestamps: true })
export class Settings extends Model<Settings> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    comment: 'Hero section sliders - array of image URLs',
  })
  heroSliders: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'App logo for light mode',
  })
  appLogoLight: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'App logo for dark mode',
  })
  appLogoDark: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Login dialog image',
  })
  loginDialogImage: string;

  @CreatedAt
  @Column({ type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE })
  declare updatedAt: Date;
}

