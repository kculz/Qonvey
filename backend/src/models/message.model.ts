import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import User from './user.model';
import Load from './load.model';
import Bid from './bid.model';

@Table({
  tableName: 'messages',
  timestamps: true,
  updatedAt: false,
})
export default class Message extends Model {
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
  sender_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  receiver_id!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content!: string;

  @ForeignKey(() => Load)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  load_id!: string;

  @ForeignKey(() => Bid)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  bid_id!: string;

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
  @BelongsTo(() => User, 'sender_id')
  sender!: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver!: User;

  @BelongsTo(() => Load, 'load_id')
  load!: Load;

  @BelongsTo(() => Bid, 'bid_id')
  bid!: Bid;

  static associate(models: any) {
    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
    });
    Message.belongsTo(models.User, {
      foreignKey: 'receiver_id',
      as: 'receiver',
    });
    Message.belongsTo(models.Load, {
      foreignKey: 'load_id',
      as: 'load',
    });
    Message.belongsTo(models.Bid, {
      foreignKey: 'bid_id',
      as: 'bid',
    });
  }

  // Instance methods
  markAsRead() {
    this.read = true;
    this.read_at = new Date();
    return this.save();
  }
}