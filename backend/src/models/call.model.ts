import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  BeforeUpdate,
} from 'sequelize-typescript';
import User from './user.model';
import Load from './load.model';
import Bid from './bid.model';

export enum CallStatus {
  INITIATED = 'INITIATED',
  RINGING = 'RINGING',
  ANSWERED = 'ANSWERED',
  REJECTED = 'REJECTED',
  MISSED = 'MISSED',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

@Table({
  tableName: 'calls',
  timestamps: true,
})
export default class Call extends Model {
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
  caller_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  receiver_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(CallType)),
    defaultValue: CallType.AUDIO,
  })
  type!: CallType;

  @Column({
    type: DataType.ENUM(...Object.values(CallStatus)),
    defaultValue: CallStatus.INITIATED,
  })
  status!: CallStatus;

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
    type: DataType.DATE,
    allowNull: true,
  })
  started_at!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  ended_at!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  duration!: number | null;

  // Associations
  @BelongsTo(() => User, 'caller_id')
  caller!: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver!: User;

  @BelongsTo(() => Load, 'load_id')
  load!: Load;

  @BelongsTo(() => Bid, 'bid_id')
  bid!: Bid;

  // Instance methods
  calculateDuration(): number | null {
    if (!this.started_at || !this.ended_at) return null;
    return Math.floor((this.ended_at.getTime() - this.started_at.getTime()) / 1000);
  }

  static associate(models: any) {
    Call.belongsTo(models.User, {
      foreignKey: 'caller_id',
      as: 'caller',
    });
    Call.belongsTo(models.User, {
      foreignKey: 'receiver_id',
      as: 'receiver',
    });
    Call.belongsTo(models.Load, {
      foreignKey: 'load_id',
      as: 'load',
    });
    Call.belongsTo(models.Bid, {
      foreignKey: 'bid_id',
      as: 'bid',
    });
  }

  @BeforeUpdate
  static updateDuration(instance: Call) {
    if (instance.changed('ended_at') && instance.started_at && instance.ended_at) {
      instance.duration = instance.calculateDuration();
    }
  }
}