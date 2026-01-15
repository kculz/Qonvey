import { Sequelize } from 'sequelize-typescript';
import { config } from './env';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.db.host,
  port: config.db.port,
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  models: [__dirname + '/../models/**/*.model.ts'],
  logging: config.env === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

export default sequelize;