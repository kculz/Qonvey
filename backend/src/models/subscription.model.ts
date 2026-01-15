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
import SubscriptionInvoice from './subscription-invoice.model';

export enum PlanType {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
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
  tableName: 'subscriptions',
  timestamps: true,
})
export default class Subscription extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    unique: true,
    allowNull: false,
  })
  user_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(PlanType)),
    defaultValue: PlanType.FREE,
  })
  plan!: PlanType;

  @Column({
    type: DataType.ENUM(...Object.values(SubscriptionStatus)),
    defaultValue: SubscriptionStatus.TRIAL,
  })
  status!: SubscriptionStatus;

  @Column({
    type: DataType.STRING,
    defaultValue: 'MONTHLY',
  })
  billing_cycle!: string;

  @Column({
    type: DataType.FLOAT,
    defaultValue: 0,
  })
  amount!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'USD',
  })
  currency!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  trial_start_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  trial_end_date!: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  has_used_trial!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  start_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  end_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  next_billing_date!: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  auto_renew!: boolean;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
  })
  payment_method!: PaymentMethod;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  last_payment!: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  loads_posted_this_month!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  bids_placed_this_month!: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  last_reset_date!: Date;

  // Associations
  @BelongsTo(() => User)
  user!: User;

  @HasMany(() => SubscriptionInvoice, 'subscription_id')
  invoices!: SubscriptionInvoice[];

  static associate(models: any) {
    Subscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Subscription.hasMany(models.SubscriptionInvoice, {
      foreignKey: 'subscription_id',
      as: 'invoices',
    });
  }
}