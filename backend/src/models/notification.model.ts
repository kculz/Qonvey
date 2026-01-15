import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import User from './user.model';

@Table({
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false,
})
export default class Notification extends Model {
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
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  body!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  data!: Record<string, any>;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  type!: string; // BID_RECEIVED, LOAD_POSTED, TRIP_STARTED, etc.

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  read!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  read_at!: Date;

  // Associations
  @BelongsTo(() => User, 'user_id')
  user!: User;

  // Instance methods
  markAsRead() {
    this.read = true;
    this.read_at = new Date();
    return this.save();
  }

  static associate(models: any) {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
}