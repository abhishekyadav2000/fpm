from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import httpx
import os
import uuid
import json

app = FastAPI(title="FPM Agents Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")
ANALYTICS_URL = os.getenv("ANALYTICS_URL", "http://localhost:5000")
API_URL = os.getenv("API_URL", "http://localhost:4000")

# In-memory store for agent runs (in production, use database)
agent_runs = {}
agent_steps = {}

class RunRequest(BaseModel):
    user_id: str
    workflow: str
    params: Optional[dict] = None

class RunResponse(BaseModel):
    run_id: str
    status: str
    output: Optional[dict] = None

async def call_ollama(prompt: str, system: str = None) -> str:
    """Call Ollama LLM"""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("message", {}).get("content", "")
            else:
                return f"Error calling Ollama: {response.status_code}"
    except Exception as e:
        return f"Ollama unavailable: {str(e)}. Using fallback response."

async def get_analytics(endpoint: str, params: dict) -> dict:
    """Call analytics service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{ANALYTICS_URL}{endpoint}", params=params)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Analytics error: {e}")
    return {}

def log_step(run_id: str, agent: str, action: str, input_data: dict, output_data: dict, evidence_ids: list):
    """Log agent step for audit"""
    step_id = str(uuid.uuid4())
    step = {
        "id": step_id,
        "run_id": run_id,
        "agent": agent,
        "action": action,
        "input": input_data,
        "output": output_data,
        "evidence_ids": evidence_ids,
        "created_at": datetime.now().isoformat()
    }
    if run_id not in agent_steps:
        agent_steps[run_id] = []
    agent_steps[run_id].append(step)
    return step

# ============ AGENTS ============

async def ingestion_agent(run_id: str, user_id: str) -> dict:
    """Gather all metrics from analytics service"""
    cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id})
    burn_rate = await get_analytics("/metrics/burn-rate", {"user_id": user_id})
    net_worth = await get_analytics("/metrics/net-worth", {"user_id": user_id})
    portfolio = await get_analytics("/metrics/portfolio-summary", {"user_id": user_id})
    
    evidence_ids = []
    evidence_ids.extend(cashflow.get("evidence_ids", []))
    evidence_ids.extend(burn_rate.get("evidence_ids", []))
    evidence_ids.extend(net_worth.get("evidence_ids", []))
    evidence_ids.extend(portfolio.get("evidence_ids", []))
    
    output = {
        "cashflow": cashflow,
        "burn_rate": burn_rate,
        "net_worth": net_worth,
        "portfolio": portfolio,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "IngestionAgent", "gather_metrics", {"user_id": user_id}, output, evidence_ids)
    return output

async def ledger_intel_agent(run_id: str, metrics: dict) -> dict:
    """Analyze spending patterns and anomalies"""
    cashflow = metrics.get("cashflow", {}).get("data", [])
    burn_rate = metrics.get("burn_rate", {})
    
    # Build analysis prompt
    prompt = f"""Analyze these financial metrics and identify patterns:

Cashflow (last 6 months):
{json.dumps(cashflow, indent=2)}

Burn Rate:
- Average: ${burn_rate.get('avg_burn_rate', 0):,.2f}/month
- Range: ${burn_rate.get('min_month', 0):,.2f} - ${burn_rate.get('max_month', 0):,.2f}

Identify:
1. Any concerning spending patterns
2. Month-over-month trends
3. Categories that might need attention

Keep response brief (3-5 bullet points). Reference the specific numbers provided."""

    system = "You are a financial analyst. Only reference numbers explicitly provided. Never invent statistics."
    
    analysis = await call_ollama(prompt, system)
    evidence_ids = metrics.get("evidence_ids", [])
    
    output = {
        "analysis": analysis,
        "metrics_summary": {
            "avg_burn_rate": burn_rate.get("avg_burn_rate", 0),
            "months_analyzed": len(cashflow)
        },
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "LedgerIntelAgent", "analyze_spending", {"metrics": "provided"}, output, evidence_ids)
    return output

async def portfolio_analyst_agent(run_id: str, metrics: dict) -> dict:
    """Analyze portfolio allocation and performance"""
    portfolio = metrics.get("portfolio", {})
    holdings = portfolio.get("holdings", [])
    
    prompt = f"""Analyze this investment portfolio:

Holdings:
{json.dumps(holdings, indent=2)}

Total Value: ${portfolio.get('total_value', 0):,.2f}
Total Cost: ${portfolio.get('total_cost', 0):,.2f}
Total Gain/Loss: ${portfolio.get('total_gain_loss', 0):,.2f}
Return: {portfolio.get('total_return_pct', 0):.1f}%

Provide:
1. Assessment of diversification
2. Any concentration risks
3. Performance observations

Keep brief (3-4 bullet points). Only reference the provided holdings."""

    system = "You are a portfolio analyst. Only discuss the specific holdings provided. Never mention securities not in the list."
    
    analysis = await call_ollama(prompt, system)
    evidence_ids = portfolio.get("evidence_ids", [])
    
    output = {
        "analysis": analysis,
        "portfolio_summary": {
            "total_value": portfolio.get("total_value", 0),
            "total_return_pct": portfolio.get("total_return_pct", 0),
            "num_holdings": len(holdings)
        },
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "PortfolioAnalystAgent", "analyze_portfolio", {"num_holdings": len(holdings)}, output, evidence_ids)
    return output

async def risk_safety_agent(run_id: str, analyses: dict) -> dict:
    """Validate that all outputs are properly grounded in evidence"""
    
    all_evidence = set()
    issues = []
    
    for agent_name, agent_output in analyses.items():
        evidence = agent_output.get("evidence_ids", [])
        all_evidence.update(evidence)
        
        # Check if analysis exists without evidence
        if agent_output.get("analysis") and not evidence:
            issues.append(f"{agent_name}: analysis present but no evidence IDs")
    
    is_grounded = len(issues) == 0 and len(all_evidence) > 0
    
    output = {
        "is_grounded": is_grounded,
        "total_evidence_count": len(all_evidence),
        "evidence_ids": list(all_evidence),
        "issues": issues,
        "verdict": "PASS" if is_grounded else "FAIL: " + "; ".join(issues)
    }
    
    log_step(run_id, "RiskSafetyAgent", "validate_grounding", {"num_analyses": len(analyses)}, output, list(all_evidence))
    return output

async def decision_coach_agent(run_id: str, analyses: dict, safety: dict) -> dict:
    """Generate actionable recommendations"""
    
    if not safety.get("is_grounded", False):
        return {
            "recommendations": [],
            "blocked": True,
            "reason": "NOT GROUNDED: " + safety.get("verdict", "Unknown safety issue"),
            "evidence_ids": []
        }
    
    ledger = analyses.get("ledger_intel", {})
    portfolio = analyses.get("portfolio_analyst", {})
    
    prompt = f"""Based on these analyses, suggest 2-3 specific actionable recommendations:

Spending Analysis:
{ledger.get('analysis', 'Not available')}

Portfolio Analysis:
{portfolio.get('analysis', 'Not available')}

Format each recommendation as:
- [ACTION]: Brief description

Be specific and actionable. Reference the analyses provided."""

    system = "You are a financial coach. Provide practical, actionable advice based only on the analyses provided."
    
    recommendations = await call_ollama(prompt, system)
    evidence_ids = safety.get("evidence_ids", [])
    
    output = {
        "recommendations": recommendations,
        "blocked": False,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "DecisionCoachAgent", "generate_recommendations", {}, output, evidence_ids)
    return output

async def narrator_agent(run_id: str, all_outputs: dict) -> dict:
    """Generate final human-readable summary"""
    
    safety = all_outputs.get("safety", {})
    if not safety.get("is_grounded", False):
        return {
            "summary": f"⚠️ {safety.get('reason', 'Analysis could not be completed due to missing evidence.')}",
            "evidence_ids": []
        }
    
    ledger = all_outputs.get("ledger_intel", {})
    portfolio = all_outputs.get("portfolio_analyst", {})
    coach = all_outputs.get("decision_coach", {})
    
    prompt = f"""Create a brief financial digest (3-4 paragraphs) summarizing:

Spending Insights:
{ledger.get('analysis', 'N/A')}

Portfolio Status:
{portfolio.get('analysis', 'N/A')}

Recommendations:
{coach.get('recommendations', 'N/A')}

Write in a friendly, conversational tone. Start with a greeting like "Here's your financial snapshot..."
End with an encouraging note."""

    system = "You are a friendly financial advisor writing a daily digest. Be warm but professional."
    
    summary = await call_ollama(prompt, system)
    evidence_ids = safety.get("evidence_ids", [])
    
    output = {
        "summary": summary,
        "evidence_ids": evidence_ids
    }
    
    log_step(run_id, "NarratorAgent", "generate_summary", {}, output, evidence_ids)
    return output

# ============ WORKFLOWS ============

async def daily_digest_workflow(run_id: str, user_id: str) -> dict:
    """Run full daily digest workflow"""
    
    # Step 1: Ingest metrics
    metrics = await ingestion_agent(run_id, user_id)
    
    # Step 2: Run analysis agents in parallel
    ledger_analysis = await ledger_intel_agent(run_id, metrics)
    portfolio_analysis = await portfolio_analyst_agent(run_id, metrics)
    
    analyses = {
        "ledger_intel": ledger_analysis,
        "portfolio_analyst": portfolio_analysis
    }
    
    # Step 3: Validate grounding
    safety = await risk_safety_agent(run_id, analyses)
    
    # Step 4: Generate recommendations
    coach = await decision_coach_agent(run_id, analyses, safety)
    
    # Step 5: Generate final narrative
    all_outputs = {
        **analyses,
        "safety": safety,
        "decision_coach": coach
    }
    narrative = await narrator_agent(run_id, all_outputs)
    
    return {
        "digest": narrative.get("summary", ""),
        "recommendations": coach.get("recommendations", ""),
        "is_grounded": safety.get("is_grounded", False),
        "evidence_count": safety.get("total_evidence_count", 0),
        "evidence_ids": safety.get("evidence_ids", [])
    }

# ============ API ENDPOINTS ============

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = "default"
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    response: str
    evidence_ids: Optional[list] = None
    suggestions: Optional[list] = None

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agents", "model": OLLAMA_MODEL}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Interactive chat with financial AI advisor"""
    
    # Build context from user's financial data
    context_summary = ""
    evidence_ids = []
    
    try:
        # Get user's financial context if we have their data
        cashflow = await get_analytics("/metrics/cashflow", {"user_id": request.user_id, "months": 3})
        net_worth = await get_analytics("/metrics/net-worth", {"user_id": request.user_id})
        
        if cashflow.get("data"):
            latest = cashflow["data"][0] if cashflow["data"] else {}
            context_summary += f"\nRecent monthly income: ${latest.get('income', 0):,.0f}"
            context_summary += f"\nRecent monthly expenses: ${latest.get('expenses', 0):,.0f}"
            evidence_ids.append("cashflow-data")
        
        if net_worth.get("net_worth"):
            context_summary += f"\nNet worth: ${net_worth['net_worth']:,.0f}"
            evidence_ids.append("net-worth-data")
            
    except Exception as e:
        context_summary = "\nNo financial data available yet."
    
    system_prompt = f"""You are a helpful personal finance advisor. You provide practical, actionable advice.
    
User's Financial Context:{context_summary if context_summary else ' No data available yet - encourage them to add accounts and transactions.'}

Guidelines:
- Be concise and friendly
- Give specific, actionable advice
- If you don't have enough data, suggest what they should add
- Never make up numbers - only reference the context provided
- Keep responses under 150 words"""

    response = await call_ollama(request.message, system_prompt)
    
    # Generate follow-up suggestions
    suggestions = []
    if "budget" in request.message.lower():
        suggestions = ["How should I allocate my income?", "What's the 50/30/20 rule?", "Help me cut expenses"]
    elif "invest" in request.message.lower():
        suggestions = ["Am I diversified enough?", "What's a good savings rate?", "Index funds vs individual stocks?"]
    elif "save" in request.message.lower():
        suggestions = ["How much should I save monthly?", "Emergency fund tips", "Automate my savings"]
    else:
        suggestions = ["Analyze my spending", "Create a budget", "Investment advice"]
    
    return ChatResponse(
        response=response,
        evidence_ids=evidence_ids if evidence_ids else None,
        suggestions=suggestions
    )

@app.post("/quick-insight")
async def quick_insight(user_id: str = "default"):
    """Get a quick AI insight based on current financial state"""
    
    # Gather data
    cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id, "months": 1})
    
    if not cashflow.get("data"):
        return {
            "insight": "Start by adding your accounts and transactions to get personalized insights!",
            "type": "tip",
            "action": "Add an account"
        }
    
    latest = cashflow["data"][0]
    income = latest.get("income", 0)
    expenses = latest.get("expenses", 0)
    savings_rate = ((income - expenses) / income * 100) if income > 0 else 0
    
    if savings_rate >= 20:
        insight = f"Great job! You're saving {savings_rate:.0f}% of your income this month."
        insight_type = "achievement"
    elif savings_rate >= 0:
        insight = f"You're saving {savings_rate:.0f}% of your income. Try to reach 20% for long-term wealth building."
        insight_type = "tip"
    else:
        insight = f"You're spending more than you earn. Let's review your expenses together."
        insight_type = "warning"
    
    return {
        "insight": insight,
        "type": insight_type,
        "savings_rate": savings_rate,
        "evidence": ["cashflow-data"]
    }

@app.post("/run", response_model=RunResponse)
async def run_workflow(request: RunRequest):
    """Execute an agent workflow"""
    run_id = str(uuid.uuid4())
    
    # Initialize run
    agent_runs[run_id] = {
        "id": run_id,
        "user_id": request.user_id,
        "workflow": request.workflow,
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "input": request.params
    }
    
    try:
        if request.workflow == "daily-digest":
            output = await daily_digest_workflow(run_id, request.user_id)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown workflow: {request.workflow}")
        
        agent_runs[run_id]["status"] = "completed"
        agent_runs[run_id]["output"] = output
        agent_runs[run_id]["completed_at"] = datetime.now().isoformat()
        
        return RunResponse(run_id=run_id, status="completed", output=output)
        
    except Exception as e:
        agent_runs[run_id]["status"] = "failed"
        agent_runs[run_id]["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get status and output of a run"""
    if run_id not in agent_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return agent_runs[run_id]

@app.get("/runs/{run_id}/steps")
async def get_run_steps(run_id: str):
    """Get all steps for a run (audit log)"""
    if run_id not in agent_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return agent_steps.get(run_id, [])

@app.get("/runs")
async def list_runs(user_id: str = Query(None), limit: int = 20):
    """List recent runs"""
    runs = list(agent_runs.values())
    if user_id:
        runs = [r for r in runs if r.get("user_id") == user_id]
    runs.sort(key=lambda x: x.get("started_at", ""), reverse=True)
    return runs[:limit]

# ============ INSIGHT MINER ============

class InsightMinerRequest(BaseModel):
    user_id: str = "default"
    depth: str = "standard"  # quick, standard, deep
    focus_areas: Optional[list] = None  # spending, savings, investments, debt, all

class MinedInsight(BaseModel):
    id: str
    type: str  # opportunity, warning, achievement, tip, pattern, anomaly
    category: str  # spending, savings, investments, debt, income
    title: str
    description: str
    impact: str  # high, medium, low
    action: Optional[str] = None
    evidence: Optional[str] = None
    confidence: float = 0.8

async def mine_spending_insights(run_id: str, user_id: str) -> list:
    """Deep dive into spending patterns"""
    insights = []
    
    # Get spending by category
    try:
        category_spend = await get_analytics("/metrics/category-spend", {"user_id": user_id, "months": 3})
        cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id, "months": 6})
        
        if category_spend.get("data"):
            # Find top spending categories
            top_categories = sorted(
                category_spend["data"], 
                key=lambda x: x.get("total", 0), 
                reverse=True
            )[:5]
            
            # Build prompt for spending analysis
            prompt = f"""Analyze these spending patterns and identify actionable insights:

Top Spending Categories (last 3 months):
{json.dumps(top_categories, indent=2)}

Monthly Cashflow Trend:
{json.dumps(cashflow.get("data", []), indent=2)}

For each insight, provide:
1. A specific observation about spending
2. Why it matters (impact)
3. One actionable recommendation

Format as JSON array with objects containing: title, description, impact (high/medium/low), action
Return 3-5 insights. Be specific with numbers from the data provided."""

            system = """You are a financial analyst. Return ONLY valid JSON array. 
Example: [{"title": "High dining spend", "description": "Dining out accounts for 25% of expenses", "impact": "high", "action": "Set a $300/month dining budget"}]"""
            
            response = await call_ollama(prompt, system)
            
            try:
                # Try to parse LLM response as JSON
                parsed = json.loads(response)
                if isinstance(parsed, list):
                    for i, item in enumerate(parsed[:5]):
                        insights.append({
                            "id": f"spend-{i+1}",
                            "type": "pattern",
                            "category": "spending",
                            "title": item.get("title", "Spending Pattern"),
                            "description": item.get("description", ""),
                            "impact": item.get("impact", "medium"),
                            "action": item.get("action"),
                            "evidence": "category-spend-data",
                            "confidence": 0.85
                        })
            except json.JSONDecodeError:
                # Fallback: create a general insight from the response
                insights.append({
                    "id": "spend-analysis",
                    "type": "tip",
                    "category": "spending",
                    "title": "Spending Analysis",
                    "description": response[:500] if response else "Review your top spending categories for savings opportunities.",
                    "impact": "medium",
                    "action": "Review expenses in Ledger",
                    "evidence": "category-spend-data",
                    "confidence": 0.7
                })
                
    except Exception as e:
        print(f"Spending analysis error: {e}")
        
    return insights

async def mine_savings_insights(run_id: str, user_id: str) -> list:
    """Analyze savings rate and opportunities"""
    insights = []
    
    try:
        cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id, "months": 6})
        net_worth = await get_analytics("/metrics/net-worth", {"user_id": user_id})
        
        if cashflow.get("data"):
            months_data = cashflow["data"]
            
            # Calculate savings rates
            savings_rates = []
            for month in months_data:
                income = month.get("income", 0)
                expenses = month.get("expenses", 0)
                if income > 0:
                    rate = ((income - expenses) / income) * 100
                    savings_rates.append({
                        "month": month.get("month"),
                        "rate": round(rate, 1),
                        "saved": income - expenses
                    })
            
            if savings_rates:
                avg_rate = sum(r["rate"] for r in savings_rates) / len(savings_rates)
                trend = savings_rates[0]["rate"] - savings_rates[-1]["rate"] if len(savings_rates) > 1 else 0
                
                # Generate insights based on savings rate
                if avg_rate >= 20:
                    insights.append({
                        "id": "savings-excellent",
                        "type": "achievement",
                        "category": "savings",
                        "title": f"Excellent Savings Rate: {avg_rate:.0f}%",
                        "description": f"You're saving above the recommended 20% rate. Your 6-month average is {avg_rate:.1f}%. Keep it up!",
                        "impact": "high",
                        "action": "Consider increasing investments",
                        "evidence": "cashflow-data",
                        "confidence": 0.95
                    })
                elif avg_rate >= 10:
                    insights.append({
                        "id": "savings-good",
                        "type": "tip",
                        "category": "savings",
                        "title": f"Good Progress: {avg_rate:.0f}% Savings Rate",
                        "description": f"Your average savings rate is {avg_rate:.1f}%. Try to reach 20% for faster wealth building.",
                        "impact": "medium",
                        "action": "Find $200/month to save more",
                        "evidence": "cashflow-data",
                        "confidence": 0.9
                    })
                elif avg_rate >= 0:
                    insights.append({
                        "id": "savings-low",
                        "type": "warning",
                        "category": "savings",
                        "title": f"Low Savings Rate: {avg_rate:.0f}%",
                        "description": f"Your savings rate of {avg_rate:.1f}% is below target. Consider reviewing expenses.",
                        "impact": "high",
                        "action": "Use the 50/30/20 budget rule",
                        "evidence": "cashflow-data",
                        "confidence": 0.9
                    })
                else:
                    insights.append({
                        "id": "savings-negative",
                        "type": "warning",
                        "category": "savings",
                        "title": "Spending Exceeds Income",
                        "description": f"You're spending {abs(avg_rate):.1f}% more than you earn on average. This is unsustainable.",
                        "impact": "high",
                        "action": "Create an emergency budget",
                        "evidence": "cashflow-data",
                        "confidence": 0.95
                    })
                
                # Trend insight
                if abs(trend) > 5:
                    if trend > 0:
                        insights.append({
                            "id": "savings-trend-up",
                            "type": "achievement",
                            "category": "savings",
                            "title": "Savings Rate Improving",
                            "description": f"Your savings rate increased by {trend:.1f}% over the last 6 months. Great progress!",
                            "impact": "medium",
                            "evidence": "cashflow-data",
                            "confidence": 0.85
                        })
                    else:
                        insights.append({
                            "id": "savings-trend-down",
                            "type": "warning",
                            "category": "savings",
                            "title": "Savings Rate Declining",
                            "description": f"Your savings rate dropped by {abs(trend):.1f}% over 6 months. Review recent expenses.",
                            "impact": "high",
                            "action": "Identify new expenses to cut",
                            "evidence": "cashflow-data",
                            "confidence": 0.85
                        })
                        
    except Exception as e:
        print(f"Savings analysis error: {e}")
        
    return insights

async def mine_investment_insights(run_id: str, user_id: str) -> list:
    """Analyze investment portfolio"""
    insights = []
    
    try:
        portfolio = await get_analytics("/metrics/portfolio-summary", {"user_id": user_id})
        
        if portfolio.get("holdings"):
            holdings = portfolio["holdings"]
            total_value = portfolio.get("total_value", 0)
            
            # Check concentration
            for h in holdings:
                if total_value > 0:
                    weight = (h.get("market_value", 0) / total_value) * 100
                    if weight > 30:
                        insights.append({
                            "id": f"invest-concentration-{h.get('symbol', 'unknown')}",
                            "type": "warning",
                            "category": "investments",
                            "title": f"High Concentration in {h.get('symbol', 'Unknown')}",
                            "description": f"{h.get('symbol')} represents {weight:.0f}% of your portfolio. Consider diversifying.",
                            "impact": "high",
                            "action": "Rebalance portfolio",
                            "evidence": "portfolio-data",
                            "confidence": 0.9
                        })
            
            # Overall performance
            total_return = portfolio.get("total_return_pct", 0)
            if total_return > 15:
                insights.append({
                    "id": "invest-performance-great",
                    "type": "achievement",
                    "category": "investments",
                    "title": f"Strong Portfolio Performance: {total_return:.1f}%",
                    "description": f"Your portfolio is up {total_return:.1f}%. Consider rebalancing to lock in gains.",
                    "impact": "medium",
                    "evidence": "portfolio-data",
                    "confidence": 0.9
                })
            elif total_return < -10:
                insights.append({
                    "id": "invest-performance-down",
                    "type": "tip",
                    "category": "investments",
                    "title": f"Portfolio Down {abs(total_return):.1f}%",
                    "description": "Stay the course with long-term investments. Consider adding to positions if you have spare cash.",
                    "impact": "medium",
                    "action": "Review investment timeline",
                    "evidence": "portfolio-data",
                    "confidence": 0.85
                })
            
            # Diversification check
            if len(holdings) < 5:
                insights.append({
                    "id": "invest-diversify",
                    "type": "tip",
                    "category": "investments",
                    "title": "Consider More Diversification",
                    "description": f"You have {len(holdings)} holdings. Consider adding index funds or ETFs for broader exposure.",
                    "impact": "medium",
                    "action": "Research low-cost ETFs",
                    "evidence": "portfolio-data",
                    "confidence": 0.8
                })
                
    except Exception as e:
        print(f"Investment analysis error: {e}")
        
    return insights

async def mine_anomaly_insights(run_id: str, user_id: str) -> list:
    """Detect unusual patterns and anomalies"""
    insights = []
    
    try:
        cashflow = await get_analytics("/metrics/cashflow", {"user_id": user_id, "months": 6})
        
        if cashflow.get("data") and len(cashflow["data"]) >= 3:
            months = cashflow["data"]
            
            # Calculate averages
            avg_income = sum(m.get("income", 0) for m in months) / len(months)
            avg_expense = sum(m.get("expenses", 0) for m in months) / len(months)
            
            # Check for anomalies in most recent month
            latest = months[0]
            latest_income = latest.get("income", 0)
            latest_expense = latest.get("expenses", 0)
            
            # Income anomaly
            if avg_income > 0:
                income_diff_pct = ((latest_income - avg_income) / avg_income) * 100
                if income_diff_pct > 30:
                    insights.append({
                        "id": "anomaly-income-spike",
                        "type": "opportunity",
                        "category": "income",
                        "title": f"Income Spike: +{income_diff_pct:.0f}% This Month",
                        "description": f"This month's income is ${latest_income:,.0f}, significantly above your ${avg_income:,.0f} average. Great time to boost savings!",
                        "impact": "high",
                        "action": "Save or invest the extra income",
                        "evidence": "cashflow-data",
                        "confidence": 0.9
                    })
                elif income_diff_pct < -30:
                    insights.append({
                        "id": "anomaly-income-drop",
                        "type": "warning",
                        "category": "income",
                        "title": f"Income Drop: {income_diff_pct:.0f}%",
                        "description": f"This month's income is below average. Make sure this isn't a recurring issue.",
                        "impact": "high",
                        "action": "Review income sources",
                        "evidence": "cashflow-data",
                        "confidence": 0.85
                    })
            
            # Expense anomaly
            if avg_expense > 0:
                expense_diff_pct = ((latest_expense - avg_expense) / avg_expense) * 100
                if expense_diff_pct > 25:
                    insights.append({
                        "id": "anomaly-expense-spike",
                        "type": "warning",
                        "category": "spending",
                        "title": f"Expense Spike: +{expense_diff_pct:.0f}% This Month",
                        "description": f"Spending of ${latest_expense:,.0f} is above your ${avg_expense:,.0f} average. Check for one-time expenses.",
                        "impact": "medium",
                        "action": "Review recent transactions",
                        "evidence": "cashflow-data",
                        "confidence": 0.85
                    })
                    
    except Exception as e:
        print(f"Anomaly analysis error: {e}")
        
    return insights

@app.post("/mine-insights")
async def mine_insights(request: InsightMinerRequest):
    """Deep insight mining across all financial data"""
    run_id = str(uuid.uuid4())
    all_insights = []
    
    focus = request.focus_areas or ["spending", "savings", "investments", "anomalies"]
    
    # Run insight miners based on focus areas
    if "spending" in focus or "all" in focus:
        spending_insights = await mine_spending_insights(run_id, request.user_id)
        all_insights.extend(spending_insights)
    
    if "savings" in focus or "all" in focus:
        savings_insights = await mine_savings_insights(run_id, request.user_id)
        all_insights.extend(savings_insights)
    
    if "investments" in focus or "all" in focus:
        investment_insights = await mine_investment_insights(run_id, request.user_id)
        all_insights.extend(investment_insights)
    
    if "anomalies" in focus or "all" in focus:
        anomaly_insights = await mine_anomaly_insights(run_id, request.user_id)
        all_insights.extend(anomaly_insights)
    
    # Sort by impact (high first) then confidence
    impact_order = {"high": 0, "medium": 1, "low": 2}
    all_insights.sort(key=lambda x: (impact_order.get(x.get("impact", "low"), 2), -x.get("confidence", 0)))
    
    # Log the run
    agent_runs[run_id] = {
        "id": run_id,
        "user_id": request.user_id,
        "workflow": "insight-miner",
        "status": "completed",
        "started_at": datetime.now().isoformat(),
        "completed_at": datetime.now().isoformat(),
        "output": {
            "insights": all_insights,
            "total_count": len(all_insights),
            "focus_areas": focus
        }
    }
    
    return {
        "run_id": run_id,
        "insights": all_insights,
        "total_count": len(all_insights),
        "focus_areas": focus,
        "generated_at": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "6000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
