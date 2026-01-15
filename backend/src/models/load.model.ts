import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import User from './user.model';
import Bid from './bid.model';
import Trip from './trip.model';

export enum LoadStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  BIDDING_CLOSED = 'BIDDING_CLOSED',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

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
  tableName: 'loads',
  timestamps: true,
})
export default class Load extends Model {
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
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  description!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  cargo_type!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
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
    type: DataType.DATE,
    allowNull: false,
  })
  pickup_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  delivery_date!: Date;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  suggested_price!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'USD',
  })
  currency!: string;

  @Column({
    type: DataType.ENUM(...Object.values(LoadStatus)),
    defaultValue: LoadStatus.DRAFT,
  })
  status!: LoadStatus;

  @Column({
    type: DataType.ARRAY(DataType.ENUM(...Object.values(VehicleType))),
    defaultValue: [],
  })
  vehicle_types!: VehicleType[];

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  images!: string[];

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    defaultValue: [],
  })
  documents!: string[];

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  requires_insurance!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  fragile!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  expires_at!: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  view_count!: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  published_at!: Date;

  // Associations
  @BelongsTo(() => User, 'owner_id')
  owner!: User;

  @HasMany(() => Bid, 'load_id')
  bids!: Bid[];

  @HasOne(() => Trip, 'load_id')
  trip!: Trip;

  static associate(models: any) {
    Load.belongsTo(models.User, {
      foreignKey: 'owner_id',
      as: 'owner',
    });
    Load.hasMany(models.Bid, {
      foreignKey: 'load_id',
      as: 'bids',
    });
    Load.hasOne(models.Trip, {
      foreignKey: 'load_id',
      as: 'trip',
    });
  }
}