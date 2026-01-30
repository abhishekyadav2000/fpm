from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta
from decimal import Decimal
import os

app = FastAPI(title="FPM Analytics Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fpm")
# Convert to async URL
ASYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(ASYNC_DB_URL)

def decimal_to_float(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    return obj

@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}

@app.get("/metrics/cashflow")
async def get_cashflow(
    user_id: str = Query(...),
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """Get income vs expenses by month"""
    async with AsyncSession(engine) as session:
        # Default to last 6 months
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")
        
        query = text("""
            SELECT 
                date_trunc('month', date) as month,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
            FROM "Transaction" t
            JOIN "Account" a ON t."accountId" = a.id
            WHERE a."userId" = :user_id
              AND t.date >= :start_date
              AND t.date <= :end_date
            GROUP BY date_trunc('month', date)
            ORDER BY month DESC
        """)
        
        result = await session.execute(query, {
            "user_id": user_id,
            "start_date": start_date,
            "end_date": end_date
        })
        rows = result.fetchall()
        
        return {
            "data": [
                {
                    "month": row[0].strftime("%Y-%m") if row[0] else None,
                    "income": decimal_to_float(row[1]),
                    "expenses": decimal_to_float(row[2]),
                    "net": decimal_to_float(row[1] - row[2]) if row[1] and row[2] else 0
                }
                for row in rows
            ],
            "evidence_ids": [f"cashflow_{start_date}_{end_date}"]
        }

@app.get("/metrics/burn-rate")
async def get_burn_rate(user_id: str = Query(...)):
    """Calculate average monthly spending (burn rate)"""
    async with AsyncSession(engine) as session:
        query = text("""
            SELECT 
                AVG(monthly_spend) as avg_burn,
                MIN(monthly_spend) as min_burn,
                MAX(monthly_spend) as max_burn
            FROM (
                SELECT 
                    date_trunc('month', date) as month,
                    SUM(ABS(amount)) as monthly_spend
                FROM "Transaction" t
                JOIN "Account" a ON t."accountId" = a.id
                WHERE a."userId" = :user_id
                  AND amount < 0
                  AND date >= NOW() - INTERVAL '6 months'
                GROUP BY date_trunc('month', date)
            ) monthly
        """)
        
        result = await session.execute(query, {"user_id": user_id})
        row = result.fetchone()
        
        return {
            "avg_burn_rate": decimal_to_float(row[0]) if row[0] else 0,
            "min_month": decimal_to_float(row[1]) if row[1] else 0,
            "max_month": decimal_to_float(row[2]) if row[2] else 0,
            "evidence_ids": [f"burn_rate_{user_id}"]
        }

@app.get("/metrics/net-worth")
async def get_net_worth(user_id: str = Query(...)):
    """Calculate total net worth from accounts and portfolios"""
    async with AsyncSession(engine) as session:
        # Get account balances
        accounts_query = text("""
            SELECT 
                a.type,
                SUM(
                    CASE 
                        WHEN a.type = 'credit' OR a.type = 'loan' THEN -1 * COALESCE(tx_sum, 0)
                        ELSE COALESCE(tx_sum, 0)
                    END
                ) as balance
            FROM "Account" a
            LEFT JOIN (
                SELECT "accountId", SUM(amount) as tx_sum
                FROM "Transaction"
                GROUP BY "accountId"
            ) t ON a.id = t."accountId"
            WHERE a."userId" = :user_id
            GROUP BY a.type
        """)
        
        accounts_result = await session.execute(accounts_query, {"user_id": user_id})
        account_balances = {row[0]: decimal_to_float(row[1]) for row in accounts_result.fetchall()}
        
        # Get portfolio value
        portfolio_query = text("""
            SELECT SUM(h.shares * p.close) as total_value
            FROM "Holding" h
            JOIN "Portfolio" pf ON h."portfolioId" = pf.id
            JOIN "Price" p ON h.symbol = p.symbol
            WHERE pf."userId" = :user_id
              AND p.date = (SELECT MAX(date) FROM "Price" WHERE symbol = h.symbol)
        """)
        
        portfolio_result = await session.execute(portfolio_query, {"user_id": user_id})
        portfolio_row = portfolio_result.fetchone()
        portfolio_value = decimal_to_float(portfolio_row[0]) if portfolio_row[0] else 0
        
        total_assets = sum(v for k, v in account_balances.items() if k not in ['credit', 'loan'] and v > 0)
        total_liabilities = abs(sum(v for k, v in account_balances.items() if k in ['credit', 'loan'] or v < 0))
        
        return {
            "accounts": account_balances,
            "portfolio_value": portfolio_value,
            "total_assets": total_assets + portfolio_value,
            "total_liabilities": total_liabilities,
            "net_worth": total_assets + portfolio_value - total_liabilities,
            "evidence_ids": [f"net_worth_{user_id}"]
        }

@app.get("/metrics/portfolio-summary")
async def get_portfolio_summary(user_id: str = Query(...)):
    """Get portfolio allocation and performance"""
    async with AsyncSession(engine) as session:
        query = text("""
            SELECT 
                h.symbol,
                h.shares,
                h."costBasis",
                p.close as current_price,
                (h.shares * p.close) as market_value,
                (h.shares * p.close - h."costBasis") as gain_loss
            FROM "Holding" h
            JOIN "Portfolio" pf ON h."portfolioId" = pf.id
            LEFT JOIN "Price" p ON h.symbol = p.symbol
                AND p.date = (SELECT MAX(date) FROM "Price" WHERE symbol = h.symbol)
            WHERE pf."userId" = :user_id
        """)
        
        result = await session.execute(query, {"user_id": user_id})
        rows = result.fetchall()
        
        holdings = []
        total_value = 0
        total_cost = 0
        total_gain = 0
        
        for row in rows:
            market_value = decimal_to_float(row[4]) if row[4] else 0
            cost = decimal_to_float(row[2]) if row[2] else 0
            gain = decimal_to_float(row[5]) if row[5] else 0
            
            total_value += market_value
            total_cost += cost
            total_gain += gain
            
            holdings.append({
                "symbol": row[0],
                "shares": decimal_to_float(row[1]),
                "cost_basis": cost,
                "current_price": decimal_to_float(row[3]) if row[3] else None,
                "market_value": market_value,
                "gain_loss": gain,
                "holding_id": f"holding_{row[0]}"
            })
        
        # Calculate allocation percentages
        for h in holdings:
            h["allocation_pct"] = (h["market_value"] / total_value * 100) if total_value > 0 else 0
        
        return {
            "holdings": holdings,
            "total_value": total_value,
            "total_cost": total_cost,
            "total_gain_loss": total_gain,
            "total_return_pct": (total_gain / total_cost * 100) if total_cost > 0 else 0,
            "evidence_ids": [h["holding_id"] for h in holdings]
        }

@app.get("/metrics/category-spend")
async def get_category_spend(
    user_id: str = Query(...),
    month: str = Query(None)
):
    """Get spending by category for a month"""
    async with AsyncSession(engine) as session:
        if not month:
            month = datetime.now().strftime("%Y-%m")
        
        start_date = f"{month}-01"
        # Calculate end date (last day of month)
        year, mon = map(int, month.split("-"))
        if mon == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{mon + 1:02d}-01"
        
        query = text("""
            SELECT 
                c.id,
                c.name,
                c.icon,
                ABS(SUM(t.amount)) as spent
            FROM "Transaction" t
            JOIN "Account" a ON t."accountId" = a.id
            LEFT JOIN "Category" c ON t."categoryId" = c.id
            WHERE a."userId" = :user_id
              AND t.amount < 0
              AND t.date >= :start_date
              AND t.date < :end_date
            GROUP BY c.id, c.name, c.icon
            ORDER BY spent DESC
        """)
        
        result = await session.execute(query, {
            "user_id": user_id,
            "start_date": start_date,
            "end_date": end_date
        })
        rows = result.fetchall()
        
        return {
            "month": month,
            "categories": [
                {
                    "id": row[0],
                    "name": row[1] or "Uncategorized",
                    "icon": row[2],
                    "spent": decimal_to_float(row[3])
                }
                for row in rows
            ],
            "evidence_ids": [f"category_spend_{month}"]
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
