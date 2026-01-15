import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Op } from 'sequelize';
import User from './user.model';

@Table({
  tableName: 'team_members',
  timestamps: true,
})
export default class TeamMember extends Model {
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
  business_owner_id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  phone_number!: string;

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
    allowNull: false,
    defaultValue: 'DRIVER',
  })
  role!: string; // DRIVER, DISPATCHER, ADMIN

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
  })
  permissions!: string[];

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  is_active!: boolean;

  // Associations
  @BelongsTo(() => User, 'business_owner_id')
  business_owner!: User;

  static associate(models: any) {
    TeamMember.belongsTo(models.User, {
      foreignKey: 'business_owner_id',
      as: 'business_owner',
    });
  }

  // Instance methods
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission) || this.role === 'ADMIN';
  }

  // Validate uniqueness constraint
  static async isUniqueEmail(email: string, businessOwnerId: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = {
      email,
      business_owner_id: businessOwnerId,
    };
    
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }
    
    const count = await TeamMember.count({ where: whereClause });
    return count === 0;
  }
}