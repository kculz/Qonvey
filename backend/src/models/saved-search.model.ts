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
  tableName: 'saved_searches',
  timestamps: true,
  updatedAt: false,
})
export default class SavedSearch extends Model {
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
  name!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  filters!: {
    origin?: {
      city?: string;
      province?: string;
      radius?: number; // in km
    };
    destination?: {
      city?: string;
      province?: string;
      radius?: number;
    };
    vehicle_types?: string[];
    cargo_type?: string;
    min_weight?: number;
    max_weight?: number;
    min_price?: number;
    max_price?: number;
    pickup_date_from?: Date;
    pickup_date_to?: Date;
  };

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  notify_on_new!: boolean;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  last_notified_at!: Date;

  // Associations
  @BelongsTo(() => User, 'user_id')
  user!: User;
  static associate(models: any) {
    SavedSearch.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }

  // Instance methods
  updateLastNotified() {
    this.last_notified_at = new Date();
    return this.save();
  }

  matchesFilters(load: any): boolean {
    // Implement filter matching logic
    const filters = this.filters;
    
    if (filters.origin) {
      const loadOrigin = load.pickup_location;
      if (filters.origin.city && loadOrigin.city !== filters.origin.city) return false;
      if (filters.origin.province && loadOrigin.province !== filters.origin.province) return false;
    }

    if (filters.destination) {
      const loadDestination = load.delivery_location;
      if (filters.destination.city && loadDestination.city !== filters.destination.city) return false;
      if (filters.destination.province && loadDestination.province !== filters.destination.province) return false;
    }

    if (filters.vehicle_types && filters.vehicle_types.length > 0) {
      const hasMatchingVehicle = load.vehicle_types.some((type: string) => 
        filters.vehicle_types!.includes(type)
      );
      if (!hasMatchingVehicle) return false;
    }

    if (filters.cargo_type && load.cargo_type !== filters.cargo_type) return false;
    if (filters.min_weight && load.weight < filters.min_weight) return false;
    if (filters.max_weight && load.weight > filters.max_weight) return false;
    if (filters.min_price && load.suggested_price < filters.min_price) return false;
    if (filters.max_price && load.suggested_price > filters.max_price) return false;

    return true;
  }
}