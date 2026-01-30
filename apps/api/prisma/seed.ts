import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if already seeded
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@fpm.local' }
  });

  if (existingUser) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@fpm.local',
      passwordHash,
      name: 'Admin User',
      role: 'admin',
    },
  });

  // Create accounts
  const checking = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Main Checking',
      type: 'checking',
      institution: 'Demo Bank',
    },
  });

  const savings = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Savings',
      type: 'savings',
      institution: 'Demo Bank',
    },
  });

  const credit = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Credit Card',
      type: 'credit',
      institution: 'Demo Bank',
    },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { userId: user.id, name: 'Income', icon: '💰', isSystem: true } }),
    prisma.category.create({ data: { userId: user.id, name: 'Groceries', icon: '🛒' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Utilities', icon: '💡' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Entertainment', icon: '🎬' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Dining', icon: '🍽️' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Transportation', icon: '🚗' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Shopping', icon: '🛍️' } }),
    prisma.category.create({ data: { userId: user.id, name: 'Health', icon: '💊' } }),
  ]);

  const [income, groceries, utilities, entertainment, dining, transport, shopping, health] = categories;

  // Create transactions
  const now = new Date();
  const transactions = [
    { accountId: checking.id, categoryId: income.id, date: new Date(now.getFullYear(), now.getMonth(), 1), description: 'Monthly Salary', amount: 5000 },
    { accountId: checking.id, categoryId: groceries.id, date: new Date(now.getFullYear(), now.getMonth(), 3), description: 'Grocery Store', merchant: 'Whole Foods', amount: -125.50 },
    { accountId: checking.id, categoryId: utilities.id, date: new Date(now.getFullYear(), now.getMonth(), 5), description: 'Electric Bill', merchant: 'Power Co', amount: -89.00 },
    { accountId: credit.id, categoryId: entertainment.id, date: new Date(now.getFullYear(), now.getMonth(), 7), description: 'Netflix', merchant: 'Netflix', amount: -15.99 },
    { accountId: credit.id, categoryId: dining.id, date: new Date(now.getFullYear(), now.getMonth(), 10), description: 'Restaurant', merchant: 'The Bistro', amount: -65.00 },
    { accountId: credit.id, categoryId: transport.id, date: new Date(now.getFullYear(), now.getMonth(), 12), description: 'Gas Station', merchant: 'Shell', amount: -45.00 },
    { accountId: credit.id, categoryId: shopping.id, date: new Date(now.getFullYear(), now.getMonth(), 15), description: 'Amazon Purchase', merchant: 'Amazon', amount: -89.99 },
    { accountId: credit.id, categoryId: health.id, date: new Date(now.getFullYear(), now.getMonth(), 18), description: 'Pharmacy', merchant: 'CVS', amount: -23.50 },
    { accountId: checking.id, categoryId: groceries.id, date: new Date(now.getFullYear(), now.getMonth(), 20), description: 'Grocery Store', merchant: 'Trader Joes', amount: -98.75 },
    { accountId: savings.id, categoryId: null, date: new Date(now.getFullYear(), now.getMonth(), 25), description: 'Transfer to Savings', amount: 500 },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({ data: tx });
  }

  // Create portfolio with holdings
  const portfolio = await prisma.portfolio.create({
    data: {
      userId: user.id,
      name: 'Main Portfolio',
    },
  });

  const holdings = [
    { portfolioId: portfolio.id, symbol: 'AAPL', shares: 50, costBasis: 6275 },
    { portfolioId: portfolio.id, symbol: 'GOOGL', shares: 25, costBasis: 3518.75 },
    { portfolioId: portfolio.id, symbol: 'MSFT', shares: 30, costBasis: 9600 },
    { portfolioId: portfolio.id, symbol: 'VTI', shares: 100, costBasis: 22050 },
  ];

  for (const h of holdings) {
    await prisma.holding.create({ data: h });
  }

  // Create prices
  const prices = [
    { symbol: 'AAPL', date: new Date(), close: 185.75 },
    { symbol: 'GOOGL', date: new Date(), close: 175.50 },
    { symbol: 'MSFT', date: new Date(), close: 415.25 },
    { symbol: 'VTI', date: new Date(), close: 245.60 },
  ];

  for (const p of prices) {
    await prisma.price.create({ data: p });
  }

  // Create budget month
  const budgetMonth = await prisma.budgetMonth.create({
    data: {
      userId: user.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
    },
  });

  // Create budget envelopes
  const envelopes = [
    { budgetMonthId: budgetMonth.id, categoryId: groceries.id, assigned: 400, spent: 224.25 },
    { budgetMonthId: budgetMonth.id, categoryId: utilities.id, assigned: 150, spent: 89 },
    { budgetMonthId: budgetMonth.id, categoryId: entertainment.id, assigned: 100, spent: 15.99 },
    { budgetMonthId: budgetMonth.id, categoryId: dining.id, assigned: 200, spent: 65 },
    { budgetMonthId: budgetMonth.id, categoryId: transport.id, assigned: 150, spent: 45 },
    { budgetMonthId: budgetMonth.id, categoryId: shopping.id, assigned: 200, spent: 89.99 },
    { budgetMonthId: budgetMonth.id, categoryId: health.id, assigned: 100, spent: 23.50 },
  ];

  for (const e of envelopes) {
    await prisma.budgetEnvelope.create({ data: e });
  }

  console.log('✅ Database seeded successfully');
  console.log('   Email: admin@fpm.local');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
