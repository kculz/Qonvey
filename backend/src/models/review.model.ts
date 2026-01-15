import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import User from './user.model';
import Trip from './trip.model';

@Table({
  tableName: 'reviews',
  timestamps: true,
  updatedAt: false,
})
export default class Review extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Trip)
  @Column({
    type: DataType.UUID,
    unique: true,
    allowNull: false,
  })
  trip_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  author_id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  receiver_id!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  })
  rating!: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  comment!: string;

  // Associations
  @BelongsTo(() => Trip, 'trip_id')
  trip!: Trip;

  @BelongsTo(() => User, 'author_id')
  author!: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver!: User;

  static associate(models: any) {
    Review.belongsTo(models.Trip, {
      foreignKey: 'trip_id',
      as: 'trip',
    });
    Review.belongsTo(models.User, {
      foreignKey: 'author_id',
      as: 'author',
    });
    Review.belongsTo(models.User, {
      foreignKey: 'receiver_id',
      as: 'receiver',
    });
  }
}