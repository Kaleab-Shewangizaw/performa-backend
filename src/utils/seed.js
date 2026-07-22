// Seeds demo users, products, and customers. Idempotent: skips records that
// already exist. Run with: npm run seed
const { pool, query } = require('../config/db');
const userModel = require('../models/user.model');
const productModel = require('../models/product.model');
const customerModel = require('../models/customer.model');
const settingModel = require('../models/setting.model');
const { hashPassword } = require('./password');

const USERS = [
  { name: 'Admin User', email: 'admin@granite.com', password: 'admin1234', role: 'admin' },
  { name: 'Sami Supervisor', email: 'supervisor@granite.com', password: 'super1234', role: 'supervisor' },
  { name: 'Sara Sales', email: 'sales@granite.com', password: 'sales1234', role: 'sales' },
];

const PRODUCTS = [
  { name: 'Absolute Black', stoneCategory: 'Granite', stoneColor: 'Black', finish: 'Polished', thicknessOptions: [20, 30], defaultUnitPrice: 4500, status: 'active' },
  { name: 'Kashmir White', stoneCategory: 'Granite', stoneColor: 'White/Grey', finish: 'Polished', thicknessOptions: [20, 30], defaultUnitPrice: 5200, status: 'active' },
  { name: 'Tan Brown', stoneCategory: 'Granite', stoneColor: 'Brown', finish: 'Flamed', thicknessOptions: [20, 30], defaultUnitPrice: 3900, status: 'active' },
  { name: 'Carrara Bianco', stoneCategory: 'Marble', stoneColor: 'White', finish: 'Honed', thicknessOptions: [15, 20, 30], defaultUnitPrice: 6800, status: 'active' },
  { name: 'Emperador Dark', stoneCategory: 'Marble', stoneColor: 'Dark Brown', finish: 'Polished', thicknessOptions: [15, 20], defaultUnitPrice: 7200, status: 'active' },
  { name: 'Calacatta Quartz', stoneCategory: 'Quartz', stoneColor: 'White/Gold', finish: 'Polished', thicknessOptions: [12, 20, 30], defaultUnitPrice: 8500, status: 'active' },
  { name: 'Grey Mist Quartz', stoneCategory: 'Quartz', stoneColor: 'Grey', finish: 'Leathered', thicknessOptions: [12, 20], defaultUnitPrice: 7800, status: 'active' },
  { name: 'Taj Mahal', stoneCategory: 'Quartzite', stoneColor: 'Cream', finish: 'Leathered', thicknessOptions: [20, 30], defaultUnitPrice: 9200, status: 'active' },
  { name: 'Silver Travertine', stoneCategory: 'Travertine', stoneColor: 'Silver/Grey', finish: 'Brushed', thicknessOptions: [10, 12, 15], defaultUnitPrice: 3200, status: 'active' },
];

const CUSTOMERS = [
  { fullName: 'Abebe Kebede', companyName: 'AK Construction PLC', phone: '+251911223344', email: 'abebe@akconstruction.com', address: 'Bole Road', city: 'Addis Ababa', taxNumber: 'TIN-0011223344', notes: '' },
  { fullName: 'Hanna Tesfaye', companyName: 'Hanna Interiors', phone: '+251922334455', email: 'hanna@interiors.et', address: 'Kazanchis', city: 'Addis Ababa', taxNumber: '', notes: '' },
];

async function seed() {
  console.log('Seeding...');

  await settingModel.get();

  for (const u of USERS) {
    if (await userModel.existsByEmail(u.email)) continue;
    await userModel.create({
      name: u.name,
      email: u.email,
      passwordHash: await hashPassword(u.password),
      role: u.role,
    });
    console.log(`  user: ${u.email} (${u.role}) password: ${u.password}`);
  }

  for (const p of PRODUCTS) {
    if (await productModel.findByName(p.name)) continue;
    await productModel.create(p);
    console.log(`  product: ${p.name}`);
  }

  const { rows } = await query('SELECT id FROM users WHERE email = $1', ['sales@granite.com']);
  const salesUserId = rows[0].id;

  for (const c of CUSTOMERS) {
    const { rows: existing } = await query('SELECT 1 FROM customers WHERE phone = $1', [c.phone]);
    if (existing.length) continue;
    await customerModel.create(c, salesUserId);
    console.log(`  customer: ${c.fullName}`);
  }

  console.log('Done.');
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
