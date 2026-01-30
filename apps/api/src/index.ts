import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { prisma } from './lib/prisma.js';

const app = Fastify({ logger: true });

// Register plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
await app.register(multipart);

// Auth decorator
app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth routes
app.post('/auth/login', async (request, reply) => {
  const { email, password } = request.body as { email: string; password: string };
  const bcrypt = await import('bcryptjs');
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  const valid = await bcrypt.default.compare(password, user.passwordHash);
  if (!valid) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  const token = app.jwt.sign({ userId: user.id, email: user.email, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
});

app.get('/auth/me', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.userId },
    select: { id: true, email: true, name: true, role: true }
  });
  return user;
});

// Accounts routes
app.get('/accounts', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.account.findMany({
    where: { userId: request.user.userId },
    orderBy: { name: 'asc' }
  });
});

app.post('/accounts', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { name, type, institution, currency } = request.body as any;
  return prisma.account.create({
    data: { userId: request.user.userId, name, type, institution, currency }
  });
});

// Categories routes
app.get('/categories', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.category.findMany({
    where: { userId: request.user.userId },
    orderBy: { name: 'asc' }
  });
});

app.post('/categories', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { name, parentId, icon, color } = request.body as any;
  return prisma.category.create({
    data: { userId: request.user.userId, name, parentId, icon, color }
  });
});

// Transactions routes
app.get('/transactions', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { accountId, startDate, endDate, limit = 100 } = request.query as any;
  
  const where: any = {
    account: { userId: request.user.userId }
  };
  
  if (accountId) where.accountId = accountId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  
  return prisma.transaction.findMany({
    where,
    include: { account: true, category: true, splits: { include: { category: true } } },
    orderBy: { date: 'desc' },
    take: parseInt(limit)
  });
});

app.post('/transactions', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { accountId, categoryId, date, description, merchant, amount, notes, splits } = request.body as any;
  
  // Verify account belongs to user
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: request.user.userId }
  });
  if (!account) {
    return { error: 'Account not found' };
  }
  
  return prisma.transaction.create({
    data: {
      accountId,
      categoryId: categoryId || null,
      date: new Date(date),
      description,
      merchant,
      amount,
      notes,
      splits: splits ? { create: splits } : undefined
    },
    include: { account: true, category: true, splits: { include: { category: true } } }
  });
});

app.put('/transactions/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  const { categoryId, date, description, merchant, amount, notes } = request.body as any;
  
  // Verify transaction belongs to user
  const tx = await prisma.transaction.findFirst({
    where: { id, account: { userId: request.user.userId } }
  });
  if (!tx) {
    return { error: 'Transaction not found' };
  }
  
  return prisma.transaction.update({
    where: { id },
    data: {
      categoryId: categoryId || null,
      date: date ? new Date(date) : undefined,
      description,
      merchant,
      amount,
      notes
    },
    include: { account: true, category: true }
  });
});

app.delete('/transactions/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  
  // Verify transaction belongs to user
  const tx = await prisma.transaction.findFirst({
    where: { id, account: { userId: request.user.userId } }
  });
  if (!tx) {
    return { error: 'Transaction not found' };
  }
  
  await prisma.transactionSplit.deleteMany({ where: { transactionId: id } });
  await prisma.transaction.delete({ where: { id } });
  return { success: true };
});

// Account update/delete
app.put('/accounts/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  const { name, type, institution, currency } = request.body as any;
  
  const account = await prisma.account.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!account) {
    return { error: 'Account not found' };
  }
  
  return prisma.account.update({
    where: { id },
    data: { name, type, institution, currency }
  });
});

app.delete('/accounts/:id', { preHandler: [app.authenticate as any] }, async (request: any, reply: any) => {
  const { id } = request.params as { id: string };
  
  const account = await prisma.account.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!account) {
    return reply.status(404).send({ error: 'Account not found' });
  }
  
  // Check for transactions
  const txCount = await prisma.transaction.count({ where: { accountId: id } });
  if (txCount > 0) {
    return reply.status(400).send({ error: 'Cannot delete account with transactions. Remove transactions first.' });
  }
  
  await prisma.account.delete({ where: { id } });
  return { success: true };
});

// Category update/delete
app.put('/categories/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  const { name, icon, color, parentId } = request.body as any;
  
  const category = await prisma.category.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!category) {
    return { error: 'Category not found' };
  }
  
  return prisma.category.update({
    where: { id },
    data: { name, icon, color, parentId }
  });
});

app.delete('/categories/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  
  const category = await prisma.category.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!category) {
    return { error: 'Category not found' };
  }
  
  // Nullify category on transactions instead of blocking
  await prisma.transaction.updateMany({
    where: { categoryId: id },
    data: { categoryId: null }
  });
  await prisma.transactionSplit.updateMany({
    where: { categoryId: id },
    data: { categoryId: null }
  });
  await prisma.budgetEnvelope.deleteMany({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });
  return { success: true };
});

// Budget routes
app.get('/budgets/:month', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { month } = request.params as { month: string };
  const monthDate = new Date(month + '-01');
  
  let budgetMonth = await prisma.budgetMonth.findFirst({
    where: { userId: request.user.userId, month: monthDate },
    include: { envelopes: { include: { category: true } } }
  });
  
  if (!budgetMonth) {
    budgetMonth = await prisma.budgetMonth.create({
      data: { userId: request.user.userId, month: monthDate },
      include: { envelopes: { include: { category: true } } }
    });
  }
  
  return budgetMonth;
});

// Get actual spending per category for a month
app.get('/budgets/:month/spending', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { month } = request.params as { month: string };
  const startDate = new Date(month + '-01');
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  
  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId: request.user.userId },
      date: { gte: startDate, lte: endDate },
      amount: { lt: 0 } // Only expenses
    },
    select: { categoryId: true, amount: true }
  });
  
  // Group by category
  const spending: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.categoryId) {
      spending[tx.categoryId] = (spending[tx.categoryId] || 0) + Math.abs(tx.amount);
    }
  }
  
  return Object.entries(spending).map(([categoryId, spent]) => ({ categoryId, spent }));
});

app.post('/budgets/:month/envelopes', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { month } = request.params as { month: string };
  const { categoryId, assigned } = request.body as any;
  const monthDate = new Date(month + '-01');
  
  let budgetMonth = await prisma.budgetMonth.findFirst({
    where: { userId: request.user.userId, month: monthDate }
  });
  
  if (!budgetMonth) {
    budgetMonth = await prisma.budgetMonth.create({
      data: { userId: request.user.userId, month: monthDate }
    });
  }
  
  return prisma.budgetEnvelope.upsert({
    where: { budgetMonthId_categoryId: { budgetMonthId: budgetMonth.id, categoryId } },
    update: { assigned },
    create: { budgetMonthId: budgetMonth.id, categoryId, assigned },
    include: { category: true }
  });
});

// Get staged import rows
app.get('/imports/:batchId/rows', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { batchId } = request.params as { batchId: string };
  
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: request.user.userId }
  });
  if (!batch) {
    return { error: 'Batch not found' };
  }
  
  return prisma.importRow.findMany({
    where: { batchId },
    orderBy: { rowNumber: 'asc' }
  });
});

// Import routes
app.get('/imports', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.importBatch.findMany({
    where: { userId: request.user.userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
});

app.post('/imports/stage', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { filename, rows } = request.body as { filename: string; rows: any[] };
  const crypto = await import('node:crypto');
  
  const batch = await prisma.importBatch.create({
    data: {
      userId: request.user.userId,
      filename,
      status: 'staged',
      rowCount: rows.length
    }
  });
  
  // Get existing hashes for deduplication
  const existingHashes = new Set(
    (await prisma.transaction.findMany({
      where: { account: { userId: request.user.userId } },
      select: { rowHash: true }
    })).map(t => t.rowHash).filter(Boolean)
  );
  
  const importRows = rows.map((row, i) => {
    const hash = crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
    return {
      batchId: batch.id,
      rowNumber: i + 1,
      rawData: row,
      rowHash: hash,
      isDupe: existingHashes.has(hash)
    };
  });
  
  await prisma.importRow.createMany({ data: importRows });
  
  const dupeCount = importRows.filter(r => r.isDupe).length;
  
  return { batchId: batch.id, total: rows.length, duplicates: dupeCount };
});

app.post('/imports/:batchId/commit', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { batchId } = request.params as { batchId: string };
  const { accountId } = request.body as { accountId: string };
  
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: request.user.userId, status: 'staged' },
    include: { rows: { where: { isDupe: false } } }
  });
  
  if (!batch) {
    return { error: 'Batch not found or already committed' };
  }
  
  const transactions = batch.rows.map(row => {
    const data = row.rawData as any;
    return {
      accountId,
      date: new Date(data.date),
      description: data.description || data.merchant || 'Unknown',
      merchant: data.merchant,
      amount: parseFloat(data.amount),
      importBatchId: batch.id,
      rowHash: row.rowHash
    };
  });
  
  await prisma.transaction.createMany({ data: transactions });
  
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: 'committed', committedAt: new Date() }
  });
  
  return { committed: transactions.length };
});

app.post('/imports/:batchId/rollback', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { batchId } = request.params as { batchId: string };
  
  await prisma.transaction.deleteMany({ where: { importBatchId: batchId } });
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: 'rolledback' }
  });
  
  return { success: true };
});

// Portfolio routes
app.get('/portfolios', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.portfolio.findMany({
    where: { userId: request.user.userId },
    include: { holdings: true }
  });
});

app.get('/portfolios/:id', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  return prisma.portfolio.findFirst({
    where: { id, userId: request.user.userId },
    include: { holdings: true, targets: true, snapshots: { orderBy: { date: 'desc' }, take: 30 } }
  });
});

app.post('/portfolios', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { name } = request.body as { name: string };
  return prisma.portfolio.create({
    data: { userId: request.user.userId, name },
    include: { holdings: true }
  });
});

app.post('/portfolios/:id/holdings', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  const { symbol, shares, costBasis } = request.body as any;
  
  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!portfolio) {
    return { error: 'Portfolio not found' };
  }
  
  // Upsert holding
  const existing = await prisma.holding.findFirst({
    where: { portfolioId: id, symbol }
  });
  
  if (existing) {
    return prisma.holding.update({
      where: { id: existing.id },
      data: {
        shares: existing.shares + shares,
        costBasis: existing.costBasis + costBasis
      }
    });
  }
  
  return prisma.holding.create({
    data: { portfolioId: id, symbol, shares, costBasis }
  });
});

app.post('/portfolios/:id/trades', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  const { symbol, type, shares, price, fees = 0, date } = request.body as any;
  
  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!portfolio) {
    return { error: 'Portfolio not found' };
  }
  
  // Update holding based on trade type
  let holding = await prisma.holding.findFirst({
    where: { portfolioId: id, symbol }
  });
  
  const tradeAmount = shares * price + fees;
  
  if (type === 'buy') {
    if (holding) {
      holding = await prisma.holding.update({
        where: { id: holding.id },
        data: {
          shares: holding.shares + shares,
          costBasis: holding.costBasis + tradeAmount
        }
      });
    } else {
      holding = await prisma.holding.create({
        data: { portfolioId: id, symbol, shares, costBasis: tradeAmount }
      });
    }
  } else if (type === 'sell' && holding) {
    const newShares = holding.shares - shares;
    const avgCost = holding.costBasis / holding.shares;
    const newCostBasis = avgCost * newShares;
    
    if (newShares <= 0) {
      await prisma.holding.delete({ where: { id: holding.id } });
      holding = null;
    } else {
      holding = await prisma.holding.update({
        where: { id: holding.id },
        data: { shares: newShares, costBasis: newCostBasis }
      });
    }
  }
  
  // Record the trade
  const trade = await prisma.trade.create({
    data: {
      portfolioId: id,
      holdingId: holding?.id,
      symbol,
      type,
      shares,
      price,
      fees,
      date: new Date(date)
    }
  });
  
  return trade;
});

app.get('/portfolios/:id/trades', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { id } = request.params as { id: string };
  
  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId: request.user.userId }
  });
  if (!portfolio) {
    return { error: 'Portfolio not found' };
  }
  
  return prisma.trade.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'desc' },
    take: 100
  });
});

// Prices routes
app.get('/prices/:symbol', async (request: any) => {
  const { symbol } = request.params as { symbol: string };
  return prisma.price.findMany({
    where: { symbol },
    orderBy: { date: 'desc' },
    take: 30
  });
});

app.get('/prices/latest', async (request: any) => {
  const { symbols } = request.query as { symbols?: string };
  const symbolList = symbols?.split(',') || [];
  
  // Get latest price for each symbol
  const prices = await prisma.price.findMany({
    where: symbolList.length > 0 ? { symbol: { in: symbolList } } : undefined,
    orderBy: { date: 'desc' },
    distinct: ['symbol']
  });
  return prices;
});

// Insights routes
app.get('/insights', { preHandler: [app.authenticate as any] }, async () => {
  return prisma.insightEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
});

// Decision log routes
app.get('/decisions', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.decisionLog.findMany({
    where: { userId: request.user.userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
});

app.post('/decisions', { preHandler: [app.authenticate as any] }, async (request: any) => {
  const { decision, reasoning, outcome } = request.body as any;
  return prisma.decisionLog.create({
    data: { userId: request.user.userId, decision, reasoning, outcome }
  });
});

// Agent runs (for audit)
app.get('/agent-runs', { preHandler: [app.authenticate as any] }, async (request: any) => {
  return prisma.agentRun.findMany({
    where: { userId: request.user.userId },
    include: { steps: true },
    orderBy: { startedAt: 'desc' },
    take: 20
  });
});

// Start server
const port = parseInt(process.env.PORT || '4000');
try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 API server running on http://0.0.0.0:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
