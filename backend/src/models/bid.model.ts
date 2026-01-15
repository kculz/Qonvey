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
import Vehicle from './vehicle.model';
import Trip from './trip.model';

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

@Table({
  tableName: 'bids',
  timestamps: true,
})
export default class Bid extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Load)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  load_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  driver_id!: string;

  @ForeignKey(() => Vehicle)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  vehicle_id!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  proposed_price!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'USD',
  })
  currency!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  message!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  estimated_duration!: number;

  @Column({
    type: DataType.ENUM(...Object.values(BidStatus)),
    defaultValue: BidStatus.PENDING,
  })
  status!: BidStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  expires_at!: Date;

  // Associations
  @BelongsTo(() => Load, 'load_id')
  load!: Load;

  @BelongsTo(() => User, 'driver_id')
  driver!: User;

  @BelongsTo(() => Vehicle, 'vehicle_id')
  vehicle!: Vehicle;

  @HasOne(() => Trip, 'bid_id')
  trip!: Trip;

  static associate(models: any) {
    Bid.belongsTo(models.Load, {
      foreignKey: 'load_id',
      as: 'load',
    });
    Bid.belongsTo(models.User, {
      foreignKey: 'driver_id',
      as: 'driver',
    });
    Bid.belongsTo(models.Vehicle, {
      foreignKey: 'vehicle_id',
      as: 'vehicle',
    });
    Bid.hasOne(models.Trip, {
      foreignKey: 'bid_id',
      as: 'trip',
    });
  }
}