import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
} from 'sequelize-typescript';
import User from './user.model';
import Load from './load.model';
import Bid from './bid.model';
import Review from './review.model';

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ECOCASH = 'ECOCASH',
  ONEMONEY = 'ONEMONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
}

@Table({
  tableName: 'trips',
  timestamps: true,
})
export default class Trip extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Load)
  @Column({
    type: DataType.UUID,
    unique: true,
    allowNull: false,
  })
  load_id!: string;

  @ForeignKey(() => Bid)
  @Column({
    type: DataType.UUID,
    unique: true,
    allowNull: false,
  })
  bid_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  driver_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(TripStatus)),
    defaultValue: TripStatus.SCHEDULED,
  })
  status!: TripStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  start_time!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  end_time!: Date;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  current_location!: {
    lat: number;
    lng: number;
    timestamp: Date;
  };

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
  })
  route!: Array<{
    lat: number;
    lng: number;
    timestamp: Date;
  }>;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  agreed_price!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'USD',
  })
  currency!: string;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
  })
  payment_method!: PaymentMethod;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  proof_of_pickup!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  proof_of_delivery!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  signature!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes!: string;

  // Associations
  @BelongsTo(() => Load, 'load_id')
  load!: Load;

  @BelongsTo(() => Bid, 'bid_id')
  bid!: Bid;

  @BelongsTo(() => User, 'driver_id')
  driver!: User;

  @HasOne(() => Review, 'trip_id')
  review!: Review;

  // Instance methods
  getDuration(): number | null {
    if (!this.start_time || !this.end_time) return null;
    return (this.end_time.getTime() - this.start_time.getTime()) / 1000;
  }

  static associate(models: any) {
    Trip.belongsTo(models.Load, {
      foreignKey: 'load_id',
      as: 'load',
    });
    Trip.belongsTo(models.Bid, {
      foreignKey: 'bid_id',
      as: 'bid',
    });
    Trip.belongsTo(models.User, {
      foreignKey: 'driver_id',
      as: 'driver',
    });
    Trip.hasOne(models.Review, {
      foreignKey: 'trip_id',
      as: 'review',
    });
  }
}