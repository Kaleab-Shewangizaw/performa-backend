// Seeds demo users, products, and customers. Idempotent: skips records that
// already exist. Run with: npm run seed
const { connectDb, disconnectDb } = require('../config/db');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const Customer = require('../models/customer.model');
const Setting = require('../models/setting.model');
const { hashPassword } = require('./password');

const USERS = [
  { name: 'Admin User', email: 'admin@granite.com', password: 'admin1234', role: 'admin' },
  { name: 'Sami Supervisor', email: 'supervisor@granite.com', password: 'super1234', role: 'supervisor' },
  { name: 'Sara Sales', email: 'sales@granite.com', password: 'sales1234', role: 'sales' },
];

const PRODUCTS = [
  { name: 'Absolute Black', stoneCategory: 'Granite', stoneColor: 'Black', finish: 'Polished', thicknessOptions: [20, 30], defaultUnitPrice: 4500 },
  { name: 'Kashmir White', stoneCategory: 'Granite', stoneColor: 'White/Grey', finish: 'Polished', thicknessOptions: [20, 30], defaultUnitPrice: 5200 },
  { name: 'Tan Brown', stoneCategory: 'Granite', stoneColor: 'Brown', finish: 'Flamed', thicknessOptions: [20, 30], defaultUnitPrice: 3900 },
  { name: 'Carrara Bianco', stoneCategory: 'Marble', stoneColor: 'White', finish: 'Honed', thicknessOptions: [15, 20, 30], defaultUnitPrice: 6800 },
  { name: 'Emperador Dark', stoneCategory: 'Marble', stoneColor: 'Dark Brown', finish: 'Polished', thicknessOptions: [15, 20], defaultUnitPrice: 7200 },
  { name: 'Calacatta Quartz', stoneCategory: 'Quartz', stoneColor: 'White/Gold', finish: 'Polished', thicknessOptions: [12, 20, 30], defaultUnitPrice: 8500 },
  { name: 'Grey Mist Quartz', stoneCategory: 'Quartz', stoneColor: 'Grey', finish: 'Leathered', thicknessOptions: [12, 20], defaultUnitPrice: 7800 },
  { name: 'Taj Mahal', stoneCategory: 'Quartzite', stoneColor: 'Cream', finish: 'Leathered', thicknessOptions: [20, 30], defaultUnitPrice: 9200 },
  { name: 'Silver Travertine', stoneCategory: 'Travertine', stoneColor: 'Silver/Grey', finish: 'Brushed', thicknessOptions: [10, 12, 15], defaultUnitPrice: 3200 },
];

const CUSTOMERS = [
  { fullName: 'Abebe Kebede', companyName: 'AK Construction PLC', phone: '+251911223344', email: 'abebe@akconstruction.com', address: 'Bole Road', city: 'Addis Ababa', taxNumber: 'TIN-0011223344' },
  { fullName: 'Hanna Tesfaye', companyName: 'Hanna Interiors', phone: '+251922334455', email: 'hanna@interiors.et', address: 'Kazanchis', city: 'Addis Ababa' },
];

async function seed() {
  await connectDb();
  console.log('Connected. Seeding...');

  await Setting.get();

  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) continue;
    await User.create({ ...u, passwordHash: await hashPassword(u.password) });
    console.log(`  user: ${u.email} (${u.role}) password: ${u.password}`);
  }

  for (const p of PRODUCTS) {
    const exists = await Product.findOne({ name: p.name });
    if (exists) continue;
    await Product.create(p);
    console.log(`  product: ${p.name}`);
  }

  const salesUser = await User.findOne({ email: 'sales@granite.com' });
  for (const c of CUSTOMERS) {
    const exists = await Customer.findOne({ phone: c.phone });
    if (exists) continue;
    await Customer.create({ ...c, createdBy: salesUser._id });
    console.log(`  customer: ${c.fullName}`);
  }

  console.log('Done.');
  await disconnectDb();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
