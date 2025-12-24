// Database Seed File
// Location: backend/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.review.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.load.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.subscriptionInvoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleared existing data');

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create users
  const cargoOwner = await prisma.user.create({
    data: {
      phoneNumber: '+263712345678',
      email: 'cargo@qonvey.co.zw',
      passwordHash: hashedPassword,
      role: 'CARGO_OWNER',
      status: 'ACTIVE',
      firstName: 'John',
      lastName: 'Moyo',
      companyName: 'Moyo Logistics',
      phoneVerified: true,
      emailVerified: true,
      rating: 4.5,
      totalRatings: 12,
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      phoneNumber: '+263723456789',
      email: 'driver1@qonvey.co.zw',
      passwordHash: hashedPassword,
      role: 'DRIVER',
      status: 'ACTIVE',
      firstName: 'Tendai',
      lastName: 'Ncube',
      driversLicense: 'DL123456',
      phoneVerified: true,
      emailVerified: true,
      rating: 4.8,
      totalRatings: 25,
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      phoneNumber: '+263734567890',
      email: 'driver2@qonvey.co.zw',
      passwordHash: hashedPassword,
      role: 'DRIVER',
      status: 'ACTIVE',
      firstName: 'Rumbi',
      lastName: 'Mutasa',
      driversLicense: 'DL789012',
      phoneVerified: true,
      emailVerified: true,
      rating: 4.6,
      totalRatings: 18,
    },
  });

  const fleetOwner = await prisma.user.create({
    data: {
      phoneNumber: '+263745678901',
      email: 'fleet@qonvey.co.zw',
      passwordHash: hashedPassword,
      role: 'FLEET_OWNER',
      status: 'ACTIVE',
      firstName: 'Tatenda',
      lastName: 'Chikwanha',
      companyName: 'Swift Fleet Services',
      companyRegistration: 'REG123456',
      phoneVerified: true,
      emailVerified: true,
      rating: 4.7,
      totalRatings: 30,
    },
  });

  console.log('✅ Created users');

  // Create subscriptions
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);

  await prisma.subscription.create({
    data: {
      userId: cargoOwner.id,
      plan: 'STARTER',
      status: 'TRIAL',
      trialStartDate: new Date(),
      trialEndDate,
      hasUsedTrial: true,
      amount: 0,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: driver1.id,
      plan: 'FREE',
      status: 'ACTIVE',
      amount: 0,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: driver2.id,
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      amount: 5,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: fleetOwner.id,
      plan: 'BUSINESS',
      status: 'ACTIVE',
      amount: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created subscriptions');

  // Create vehicles
  const vehicle1 = await prisma.vehicle.create({
    data: {
      ownerId: driver1.id,
      type: 'MEDIUM_TRUCK',
      make: 'Isuzu',
      model: 'NQR',
      year: 2020,
      licensePlate: 'ABB1234',
      color: 'White',
      capacity: 5000,
      volumeCapacity: 20,
      isActive: true,
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      ownerId: driver2.id,
      type: 'LARGE_TRUCK',
      make: 'Hino',
      model: '700 Series',
      year: 2019,
      licensePlate: 'ACC5678',
      color: 'Blue',
      capacity: 10000,
      volumeCapacity: 35,
      isActive: true,
    },
  });

  const vehicle3 = await prisma.vehicle.create({
    data: {
      ownerId: fleetOwner.id,
      type: 'REFRIGERATED',
      make: 'Mercedes-Benz',
      model: 'Actros',
      year: 2021,
      licensePlate: 'ADD9012',
      color: 'White',
      capacity: 8000,
      volumeCapacity: 30,
      isActive: true,
    },
  });

  console.log('✅ Created vehicles');

  // Create loads
  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 2);

  const load1 = await prisma.load.create({
    data: {
      ownerId: cargoOwner.id,
      title: 'Furniture Delivery Harare to Bulawayo',
      description: 'Need to transport household furniture from Harare to Bulawayo. Includes sofa set, dining table, and bedroom furniture.',
      cargoType: 'Furniture',
      weight: 2000,
      volume: 15,
      pickupLocation: {
        address: '123 Samora Machel Ave, Harare',
        lat: -17.8252,
        lng: 31.0335,
        city: 'Harare',
        province: 'Harare',
      },
      deliveryLocation: {
        address: '456 Fife Street, Bulawayo',
        lat: -20.1547,
        lng: 28.5826,
        city: 'Bulawayo',
        province: 'Bulawayo',
      },
      pickupDate,
      suggestedPrice: 250,
      currency: 'USD',
      status: 'OPEN',
      vehicleTypes: ['MEDIUM_TRUCK', 'LARGE_TRUCK'],
      publishedAt: new Date(),
      fragile: true,
    },
  });

  const load2 = await prisma.load.create({
    data: {
      ownerId: cargoOwner.id,
      title: 'Construction Materials - Harare to Mutare',
      description: 'Cement bags and building materials needed for construction project in Mutare.',
      cargoType: 'Construction Materials',
      weight: 5000,
      volume: 25,
      pickupLocation: {
        address: 'Industrial Area, Harare',
        lat: -17.8678,
        lng: 31.0534,
        city: 'Harare',
        province: 'Harare',
      },
      deliveryLocation: {
        address: 'Main Street, Mutare',
        lat: -18.9707,
        lng: 32.6706,
        city: 'Mutare',
        province: 'Manicaland',
      },
      pickupDate,
      suggestedPrice: 300,
      currency: 'USD',
      status: 'OPEN',
      vehicleTypes: ['LARGE_TRUCK', 'FLATBED'],
      publishedAt: new Date(),
    },
  });

  console.log('✅ Created loads');

  // Create bids
  const bid1 = await prisma.bid.create({
    data: {
      loadId: load1.id,
      driverId: driver1.id,
      vehicleId: vehicle1.id,
      proposedPrice: 230,
      currency: 'USD',
      message: 'I can do this delivery with care. I have experience with furniture.',
      status: 'PENDING',
    },
  });

  const bid2 = await prisma.bid.create({
    data: {
      loadId: load1.id,
      driverId: driver2.id,
      vehicleId: vehicle2.id,
      proposedPrice: 240,
      currency: 'USD',
      message: 'Reliable service with insurance coverage.',
      status: 'PENDING',
    },
  });

  const bid3 = await prisma.bid.create({
    data: {
      loadId: load2.id,
      driverId: driver2.id,
      vehicleId: vehicle2.id,
      proposedPrice: 280,
      currency: 'USD',
      message: 'Can handle heavy loads. Available immediately.',
      status: 'PENDING',
    },
  });

  console.log('✅ Created bids');

  // Create messages
  await prisma.message.create({
    data: {
      senderId: cargoOwner.id,
      receiverId: driver1.id,
      loadId: load1.id,
      bidId: bid1.id,
      content: 'Hi, when can you start the delivery?',
    },
  });

  await prisma.message.create({
    data: {
      senderId: driver1.id,
      receiverId: cargoOwner.id,
      loadId: load1.id,
      bidId: bid1.id,
      content: 'I can start tomorrow morning. I have all necessary equipment.',
      read: false,
    },
  });

  console.log('✅ Created messages');

  // Create notifications
  await prisma.notification.create({
    data: {
      userId: cargoOwner.id,
      title: 'New Bid Received',
      body: `Tendai Ncube bid $230 for "Furniture Delivery Harare to Bulawayo"`,
      type: 'BID_RECEIVED',
      data: { bidId: bid1.id, loadId: load1.id },
    },
  });

  await prisma.notification.create({
    data: {
      userId: driver1.id,
      title: 'New Message',
      body: 'John Moyo sent you a message',
      type: 'NEW_MESSAGE',
      data: { senderId: cargoOwner.id },
      read: false,
    },
  });

  console.log('✅ Created notifications');

  console.log('🎉 Database seeded successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('Cargo Owner: cargo@qonvey.co.zw / password123');
  console.log('Driver 1: driver1@qonvey.co.zw / password123');
  console.log('Driver 2: driver2@qonvey.co.zw / password123');
  console.log('Fleet Owner: fleet@qonvey.co.zw / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });