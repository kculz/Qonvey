import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import Subscription from './subscription.model';

export enum PaymentMethod {
  CASH = 'CASH',
  ECOCASH = 'ECOCASH',
  ONEMONEY = 'ONEMONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
}

export enum PlanType {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
}

@Table({
  tableName: 'subscription_invoices',
  timestamps: true,
})
export default class SubscriptionInvoice extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Subscription)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  subscription_id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  user_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(PlanType)),
    allowNull: false,
  })
  plan!: PlanType;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  amount!: number;

  @Column({
    type: DataType.STRING,
    defaultValue: 'USD',
  })
  currency!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  billing_period!: string;

  @Column({
    type: DataType.STRING,
    defaultValue: 'PENDING',
  })
  status!: string; // PENDING, PAID, OVERDUE, CANCELLED

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  due_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  paid_at!: Date | null;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
  })
  payment_method!: PaymentMethod | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  reference!: string | null;

  // Associations
  @BelongsTo(() => Subscription, 'subscription_id')
  subscription!: Subscription;

  // Instance methods
  markAsPaid(paymentMethod: PaymentMethod, reference?: string) {
    this.status = 'PAID';
    this.paid_at = new Date();
    this.payment_method = paymentMethod;
    this.reference = reference || null;
    return this.save();
  }

  isOverdue(): boolean {
    return this.status === 'PENDING' && new Date() > this.due_date;
  }

  static associate(models: any) {
    SubscriptionInvoice.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription',
    });
  }
}