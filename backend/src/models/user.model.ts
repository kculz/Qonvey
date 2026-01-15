import {
  Table,
  Column,
  Model,
  DataType,
  HasOne,
  HasMany,
  Index,
  BeforeCreate,
  BeforeUpdate,
} from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';
import Subscription from './subscription.model';
import Load from './load.model';
import Bid from './bid.model';
import Trip from './trip.model';
import Vehicle from './vehicle.model';

export enum UserRole {
  CARGO_OWNER = 'CARGO_OWNER',
  DRIVER = 'DRIVER',
  FLEET_OWNER = 'FLEET_OWNER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

@Table({
  tableName: 'users',
  timestamps: true,
})
export default class User extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
  })
  phone_number!: string;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: true,
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  password_hash!: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    allowNull: false,
  })
  role!: UserRole;

  @Column({
    type: DataType.ENUM(...Object.values(UserStatus)),
    defaultValue: UserStatus.PENDING,
  })
  status!: UserStatus;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  first_name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  last_name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  profile_image!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  id_document!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  drivers_license!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  company_name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  company_registration!: string;

  @Column({
    type: DataType.FLOAT,
    defaultValue: 0,
  })
  rating!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  total_ratings!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  email_verified!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  phone_verified!: boolean;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  location!: {
    address: string;
    lat: number;
    lng: number;
    city: string;
  };

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  fcm_token!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  last_login_at!: Date;

  // Associations
  @HasOne(() => Subscription, 'user_id')
  subscription!: Subscription;

  @HasMany(() => Load, 'owner_id')
  loads_posted!: Load[];

  @HasMany(() => Bid, 'driver_id')
  bids!: Bid[];

  @HasMany(() => Trip, 'driver_id')
  trips!: Trip[];

  @HasMany(() => Vehicle, 'owner_id')
  vehicles!: Vehicle[];

  // Hooks
  @BeforeCreate
  @BeforeUpdate
  static async hashPassword(instance: User) {
    if (instance.changed('password_hash')) {
      instance.password_hash = await bcrypt.hash(instance.password_hash, 10);
    }
  }

  // Instance methods
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  // Static methods
  static associate(models: any) {
    User.hasOne(models.Subscription, {
      foreignKey: 'user_id',
      as: 'subscription',
    });
    User.hasMany(models.Load, {
      foreignKey: 'owner_id',
      as: 'loads_posted',
    });
    User.hasMany(models.Bid, {
      foreignKey: 'driver_id',
      as: 'bids',
    });
    User.hasMany(models.Trip, {
      foreignKey: 'driver_id',
      as: 'trips',
    });
    User.hasMany(models.Vehicle, {
      foreignKey: 'owner_id',
      as: 'vehicles',
    });
    // Add other associations...
  }
}