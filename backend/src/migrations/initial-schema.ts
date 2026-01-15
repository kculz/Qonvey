import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    // Create all tables
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      phone_number: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('CARGO_OWNER', 'DRIVER', 'FLEET_OWNER', 'ADMIN'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'),
        defaultValue: 'PENDING',
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // ... add all other columns for each table
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Create other tables...
    await queryInterface.createTable('subscriptions', { /* ... */ });
    await queryInterface.createTable('loads', { /* ... */ });
    await queryInterface.createTable('bids', { /* ... */ });
    await queryInterface.createTable('trips', { /* ... */ });
    await queryInterface.createTable('vehicles', { /* ... */ });
    await queryInterface.createTable('messages', { /* ... */ });
    await queryInterface.createTable('calls', { /* ... */ });
    await queryInterface.createTable('notifications', { /* ... */ });
    await queryInterface.createTable('reviews', { /* ... */ });
    await queryInterface.createTable('team_members', { /* ... */ });
    await queryInterface.createTable('load_templates', { /* ... */ });
    await queryInterface.createTable('saved_searches', { /* ... */ });
    await queryInterface.createTable('subscription_invoices', { /* ... */ });
  },

  down: async (queryInterface: QueryInterface) => {
    // Drop tables in reverse order to avoid foreign key constraints
    await queryInterface.dropTable('subscription_invoices');
    await queryInterface.dropTable('saved_searches');
    await queryInterface.dropTable('load_templates');
    await queryInterface.dropTable('team_members');
    await queryInterface.dropTable('reviews');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('calls');
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('trips');
    await queryInterface.dropTable('bids');
    await queryInterface.dropTable('loads');
    await queryInterface.dropTable('vehicles');
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('users');
  },
};