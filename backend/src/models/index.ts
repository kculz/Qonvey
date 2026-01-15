import sequelize from '../config/database';
import User from './user.model';
import Subscription from './subscription.model';
import SubscriptionInvoice from './subscription-invoice.model';
import Load from './load.model';
import Bid from './bid.model';
import Trip from './trip.model';
import Vehicle from './vehicle.model';
import Message from './message.model';
import Call from './call.model';
import Notification from './notification.model';
import Review from './review.model';
import TeamMember from './team-member.model';
import LoadTemplate from './load-template.model';
import SavedSearch from './saved-search.model';

// Initialize all models
const models = {
  User,
  Subscription,
  SubscriptionInvoice,
  Load,
  Bid,
  Trip,
  Vehicle,
  Message,
  Call,
  Notification,
  Review,
  TeamMember,
  LoadTemplate,
  SavedSearch,
};

// // Define associations
// Object.values(models).forEach((model) => {
//   if (model.associate) {
//     model.associate(models);
//   }
// });

// // Define complex associations that require multiple models
// User.associate(models);
// Subscription.associate(models);
// Load.associate(models);
// Bid.associate(models);
// Trip.associate(models);
// Vehicle.associate(models);
// Message.associate(models);
// Call.associate(models);
// Notification.associate(models);
// Review.associate(models);
// TeamMember.associate(models);
// LoadTemplate.associate(models);
// SavedSearch.associate(models);

export { sequelize };
export default models;