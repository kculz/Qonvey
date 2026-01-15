import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import User from './user.model';

export enum VehicleType {
  PICKUP = 'PICKUP',
  SMALL_TRUCK = 'SMALL_TRUCK',
  MEDIUM_TRUCK = 'MEDIUM_TRUCK',
  LARGE_TRUCK = 'LARGE_TRUCK',
  FLATBED = 'FLATBED',
  REFRIGERATED = 'REFRIGERATED',
  CONTAINER = 'CONTAINER',
}

@Table({
  tableName: 'load_templates',
  timestamps: true,
})
export default class LoadTemplate extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  user_id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  cargo_type!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  weight!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  volume!: number;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  pickup_location!: {
    address: string;
    lat: number;
    lng: number;
    city: string;
    province: string;
  };

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  delivery_location!: {
    address: string;
    lat: number;
    lng: number;
    city: string;
    province: string;
  };

  @Column({
    type: DataType.ARRAY(DataType.ENUM(...Object.values(VehicleType))),
    defaultValue: [],
  })
  vehicle_types!: VehicleType[];

  // Associations
  @BelongsTo(() => User, 'user_id')
  user!: User;

  // Instance methods
  createLoadFromTemplate(overrideData?: Partial<LoadTemplate>): any {
    const baseLoad = {
      title: this.name,
      description: this.description,
      cargo_type: this.cargo_type,
      weight: this.weight,
      volume: this.volume,
      pickup_location: this.pickup_location,
      delivery_location: this.delivery_location,
      vehicle_types: this.vehicle_types,
    };

    return { ...baseLoad, ...overrideData };
  }

  static associate(models: any) {
    LoadTemplate.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
}