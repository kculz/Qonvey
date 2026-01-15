import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import User from './user.model';
import Bid from './bid.model';

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
  tableName: 'vehicles',
  timestamps: true,
})
export default class Vehicle extends Model {
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
  owner_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(VehicleType)),
    allowNull: false,
  })
  type!: VehicleType;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  make!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  model!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  year!: number;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
  })
  license_plate!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  color!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  capacity!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  volume_capacity!: number;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  images!: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  insurance!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  registration!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  is_active!: boolean;

  // Associations
  @BelongsTo(() => User, 'owner_id')
  owner!: User; 
  @HasMany(() => Bid, 'vehicle_id')
  bids!: Bid[];

  static associate(models: any) {
    Vehicle.belongsTo(models.User, {
      foreignKey: 'owner_id',
      as: 'owner',
    });
    Vehicle.hasMany(models.Bid, {
      foreignKey: 'vehicle_id',
      as: 'bids',
    });
  }
}