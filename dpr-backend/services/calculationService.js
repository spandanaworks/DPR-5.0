class CalculationService {
    
    // ========== PROJECT COST CALCULATIONS ==========
    calculateTotalProjectCost(data) {
        const landCost = Number(data.land_cost) || 0;
        const buildingCost = Number(data.building_cost) || 0;
        const machineryCost = Number(data.machinery_total) || 0;
        const furnitureCost = Number(data.furniture_cost) || 0;
        const workingCapital = Number(data.working_capital) || 0;
        const otherCost = Number(data.other_cost) || 0;
        
        return landCost + buildingCost + machineryCost + furnitureCost + workingCapital + otherCost;
    }
    
    // ========== MEANS OF FINANCE ==========
    calculateFinanceBreakdown(totalCost, promoter, loan, subsidy) {
        return {
            promoterPercent: totalCost > 0 ? ((promoter / totalCost) * 100).toFixed(2) : 0,
            loanPercent: totalCost > 0 ? ((loan / totalCost) * 100).toFixed(2) : 0,
            subsidyPercent: totalCost > 0 ? ((subsidy / totalCost) * 100).toFixed(2) : 0,
            totalFunds: (promoter || 0) + (loan || 0) + (subsidy || 0)
        };
    }
    
    // ========== BALANCE SHEET CALCULATIONS ==========
    calculateBalanceSheet(data) {
        // Current Assets
        const cashInHand = Number(data.cash_in_hand) || 0;
        const bankBalance = Number(data.bank_balance) || 0;
        const inventory = Number(data.inventory_value) || 0;
        const receivables = Number(data.receivables) || 0;
        const totalCurrentAssets = cashInHand + bankBalance + inventory + receivables;
        
        // Fixed Assets
        const fixedLand = Number(data.fixed_land) || Number(data.land_cost) || 0;
        const fixedBuilding = Number(data.fixed_building) || Number(data.building_cost) || 0;
        const fixedMachinery = Number(data.fixed_machinery) || Number(data.machinery_total) || 0;
        const fixedFurniture = Number(data.fixed_furniture) || Number(data.furniture_cost) || 0;
        const totalFixedAssets = fixedLand + fixedBuilding + fixedMachinery + fixedFurniture;
        
        // Total Assets
        const totalAssets = totalCurrentAssets + totalFixedAssets;
        
        // Liabilities
        const shortTermLoan = Number(data.short_term_loan) || 0;
        const creditors = Number(data.creditors) || 0;
        const longTermLoan = Number(data.long_term_loan) || 0;
        const totalCurrentLiabilities = shortTermLoan + creditors;
        const totalLongTermLiabilities = longTermLoan;
        const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
        
        // Equity
        const ownerCapital = Number(data.owner_capital) || Number(data.promoter_contribution) || 0;
        const retainedEarnings = Number(data.retained_earnings) || 0;
        const totalEquity = ownerCapital + retainedEarnings;
        
        // Balance Check
        const liabilitiesPlusEquity = totalLiabilities + totalEquity;
        const isBalanced = Math.abs(totalAssets - liabilitiesPlusEquity) < 1;
        const difference = totalAssets - liabilitiesPlusEquity;
        
        // Key Ratios
        const currentRatio = totalCurrentLiabilities > 0 ? (totalCurrentAssets / totalCurrentLiabilities).toFixed(2) : '∞';
        const quickRatio = totalCurrentLiabilities > 0 ? ((totalCurrentAssets - inventory) / totalCurrentLiabilities).toFixed(2) : '∞';
        const debtEquityRatio = totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : '∞';
        const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
        
        return {
            assets: {
                current: { cashInHand, bankBalance, inventory, receivables },
                fixed: { land: fixedLand, building: fixedBuilding, machinery: fixedMachinery, furniture: fixedFurniture },
                totalCurrentAssets,
                totalFixedAssets,
                totalAssets
            },
            liabilities: {
                current: { shortTermLoan, creditors },
                longTerm: longTermLoan,
                totalCurrentLiabilities,
                totalLongTermLiabilities,
                totalLiabilities
            },
            equity: {
                ownerCapital,
                retainedEarnings,
                totalEquity
            },
            balanceCheck: {
                isBalanced,
                difference,
                liabilitiesPlusEquity
            },
            ratios: {
                currentRatio,
                quickRatio,
                debtEquityRatio,
                workingCapital
            }
        };
    }
    
    // ========== PROFIT & LOSS STATEMENT ==========
    calculateProfitAndLoss(data, projections) {
        const salesRevenue = Number(data.sales_revenue) || projections?.[0]?.revenue || 0;
        const otherIncome = Number(data.other_income) || 0;
        const grossIncome = salesRevenue + otherIncome;
        
        const costOfOperations = Number(data.cost_of_operations) || (salesRevenue * 0.6);
        const staffPayroll = Number(data.staff_payroll) || 0;
        const powerUtilities = Number(data.power_utilities) || 0;
        const adminExpenses = Number(data.admin_expenses) || 0;
        const salesMarketing = Number(data.sales_marketing) || 0;
        const repairsUpkeep = Number(data.repairs_upkeep) || 0;
        const otherCosts = Number(data.other_costs) || 0;
        const depreciation = Number(data.depreciation) || 0;
        
        const totalExpenses = costOfOperations + staffPayroll + powerUtilities + adminExpenses + 
                             salesMarketing + repairsUpkeep + otherCosts + depreciation;
        
        const grossSurplus = grossIncome - totalExpenses;
        const financialCharges = Number(data.financial_charges) || Number(data.bank_loan) * 0.10 || 0;
        const pbt = grossSurplus - financialCharges;
        const tax = pbt > 0 ? pbt * 0.25 : 0;
        const pat = pbt - tax;
        
        return {
            income: { salesRevenue, otherIncome, grossIncome },
            expenses: {
                costOfOperations, staffPayroll, powerUtilities, adminExpenses,
                salesMarketing, repairsUpkeep, otherCosts, depreciation, totalExpenses
            },
            surplus: grossSurplus,
            financialCharges,
            pbt,
            tax,
            pat,
            profitMargin: salesRevenue > 0 ? ((pat / salesRevenue) * 100).toFixed(2) : 0
        };
    }
    
    // ========== 5-YEAR FINANCIAL PROJECTIONS ==========
    calculateProjections(data) {
        const dailyCapacity = Number(data.daily_capacity) || 0;
        const sellingPrice = Number(data.selling_price) || 0;
        const maxAnnualRevenue = dailyCapacity * sellingPrice * 300;
        
        const projections = [];
        const baseInterest = Number(data.bank_loan) || 5000000;
        
        for (let year = 1; year <= 5; year++) {
            const capacityUtilization = Number(data[`cap_year${year}`]) || [60, 75, 85, 90, 95][year - 1];
            const revenue = Math.round(maxAnnualRevenue * capacityUtilization / 100);
            const operatingExpenses = Math.round(revenue * 0.7);
            const pbdit = revenue - operatingExpenses;
            
            // Interest decreases as loan is repaid
            const interest = Math.round(baseInterest * 0.10 * (1 - (year - 1) * 0.1));
            const depreciation = Number(data[`dep_year${year}`]) || Math.round(880000 * (0.9 ** (year - 1)));
            const pbt = pbdit - interest - depreciation;
            const tax = pbt > 0 ? Math.round(pbt * 0.25) : 0;
            const pat = pbt - tax;
            const cumulativePat = year === 1 ? pat : projections[year - 2].cumulativePat + pat;
            
            projections.push({
                year,
                capacityUtilization,
                revenue,
                operatingExpenses,
                pbdit,
                interest,
                depreciation,
                pbt,
                tax,
                pat,
                cumulativePat,
                revenueGrowth: year > 1 ? (((revenue - projections[year - 2].revenue) / projections[year - 2].revenue) * 100).toFixed(2) : 0,
                patGrowth: year > 1 ? (((pat - projections[year - 2].pat) / projections[year - 2].pat) * 100).toFixed(2) : 0
            });
        }
        
        return projections;
    }
    
    // ========== WORKING CAPITAL & MPBF (BANK LOAN ELIGIBILITY) ==========
    calculateWorkingCapitalMPBF(balanceSheet, projections) {
        const currentAssets = balanceSheet.assets.totalCurrentAssets;
        const currentLiabilities = balanceSheet.liabilities.totalCurrentLiabilities;
        const workingCapitalGap = currentAssets - currentLiabilities;
        
        // Method 2: 25% of current assets as promoter margin
        const promoterMargin = currentAssets * 0.25;
        const mpbfMethod2 = workingCapitalGap - promoterMargin;
        
        // Method 1: 25% of working capital gap
        const mpbfMethod1 = workingCapitalGap * 0.75;
        
        return {
            totalCurrentAssets: currentAssets,
            otherCurrentLiabilities: currentLiabilities,
            workingCapitalGap,
            promoterMargin25Percent: promoterMargin,
            mpbfMethod1: Math.max(0, mpbfMethod1),
            mpbfMethod2: Math.max(0, mpbfMethod2),
            recommendedMPBF: Math.min(mpbfMethod1, mpbfMethod2),
            shortfallInNWC: workingCapitalGap - mpbfMethod2 > 0 ? workingCapitalGap - mpbfMethod2 : 0
        };
    }
    
    // ========== STAFF COST CALCULATIONS ==========
    calculateStaffCosts(data) {
        const staffCategories = [
            { count: data.mgmt_count || 0, salary: data.mgmt_salary || 0, name: 'Management' },
            { count: data.sup_count || 0, salary: data.sup_salary || 0, name: 'Supervisory' },
            { count: data.skill_count || 0, salary: data.skill_salary || 0, name: 'Skilled Workers' },
            { count: data.unskill_count || 0, salary: data.unskill_salary || 0, name: 'Unskilled Workers' },
            { count: data.admin_count || 0, salary: data.admin_salary || 0, name: 'Administrative' }
        ];
        
        let totalStaff = 0;
        let totalMonthlyCost = 0;
        
        const breakdown = staffCategories.map(cat => {
            const monthlyCost = (Number(cat.count) || 0) * (Number(cat.salary) || 0);
            totalStaff += Number(cat.count) || 0;
            totalMonthlyCost += monthlyCost;
            return {
                name: cat.name,
                count: Number(cat.count) || 0,
                salary: Number(cat.salary) || 0,
                monthlyCost
            };
        });
        
        return {
            breakdown,
            totalStaff,
            totalMonthlyCost,
            totalAnnualCost: totalMonthlyCost * 12
        };
    }
    
    // ========== COMPREHENSIVE FINANCIAL RATIOS ==========
    calculateAllRatios(balanceSheet, pnl, projections) {
        const sales = pnl.income.salesRevenue;
        const pat = pnl.pat;
        const totalAssets = balanceSheet.assets.totalAssets;
        const netWorth = balanceSheet.equity.totalEquity;
        const totalLiabilities = balanceSheet.liabilities.totalLiabilities;
        const ebitda = projections[0]?.pbdit || 0;
        const interest = projections[0]?.interest || 0;
        
        return {
            // Liquidity Ratios
            currentRatio: balanceSheet.ratios.currentRatio,
            quickRatio: balanceSheet.ratios.quickRatio,
            
            // Profitability Ratios
            netProfitMargin: sales > 0 ? ((pat / sales) * 100).toFixed(2) : 0,
            returnOnAssets: totalAssets > 0 ? ((pat / totalAssets) * 100).toFixed(2) : 0,
            returnOnNetWorth: netWorth > 0 ? ((pat / netWorth) * 100).toFixed(2) : 0,
            
            // Leverage Ratios
            debtEquityRatio: balanceSheet.ratios.debtEquityRatio,
            interestCoverageRatio: interest > 0 ? (ebitda / interest).toFixed(2) : '∞',
            
            // Turnover Ratios
            assetTurnoverRatio: totalAssets > 0 ? (sales / totalAssets).toFixed(2) : 0,
            
            // Growth Ratios
            salesGrowth: projections[1]?.revenueGrowth || 0,
            profitGrowth: projections[1]?.patGrowth || 0
        };
    }
    
    // ========== CASH FLOW STATEMENT ==========
    calculateCashFlow(projections, balanceSheet, pnl) {
        const operatingCashFlow = {
            pat: pnl.pat,
            depreciation: pnl.expenses.depreciation,
            changeInWorkingCapital: balanceSheet.ratios.workingCapital,
            netCashFromOperations: pnl.pat + pnl.expenses.depreciation - balanceSheet.ratios.workingCapital
        };
        
        const investingCashFlow = {
            capitalExpenditure: -balanceSheet.assets.totalFixedAssets,
            netCashFromInvesting: -balanceSheet.assets.totalFixedAssets
        };
        
        const financingCashFlow = {
            loanReceived: balanceSheet.liabilities.totalLiabilities * 0.5,
            loanRepaid: -balanceSheet.liabilities.totalLiabilities * 0.1,
            capitalInfused: balanceSheet.equity.ownerCapital,
            netCashFromFinancing: balanceSheet.equity.ownerCapital + (balanceSheet.liabilities.totalLiabilities * 0.4)
        };
        
        const netCashFlow = operatingCashFlow.netCashFromOperations + 
                           investingCashFlow.netCashFromInvesting + 
                           financingCashFlow.netCashFromFinancing;
        
        return {
            operating: operatingCashFlow,
            investing: investingCashFlow,
            financing: financingCashFlow,
            netCashFlow,
            closingCashBalance: (balanceSheet.assets.current.cashInHand || 0) + netCashFlow
        };
    }
    
    // ========== FUNDS FLOW STATEMENT ==========
    calculateFundsFlow(prevBalanceSheet, currentBalanceSheet, pnl) {
        const sourcesOfFunds = {
            fundsFromOperations: pnl.pat + pnl.expenses.depreciation,
            increaseInCapital: Math.max(0, currentBalanceSheet.equity.ownerCapital - (prevBalanceSheet?.equity.ownerCapital || 0)),
            increaseInLoans: Math.max(0, currentBalanceSheet.liabilities.totalLiabilities - (prevBalanceSheet?.liabilities.totalLiabilities || 0))
        };
        
        const totalSources = sourcesOfFunds.fundsFromOperations + 
                            sourcesOfFunds.increaseInCapital + 
                            sourcesOfFunds.increaseInLoans;
        
        const usesOfFunds = {
            increaseInFixedAssets: Math.max(0, currentBalanceSheet.assets.totalFixedAssets - (prevBalanceSheet?.assets.totalFixedAssets || 0)),
            increaseInWorkingCapital: Math.max(0, currentBalanceSheet.ratios.workingCapital - (prevBalanceSheet?.ratios.workingCapital || 0))
        };
        
        const totalUses = usesOfFunds.increaseInFixedAssets + usesOfFunds.increaseInWorkingCapital;
        
        return {
            sources: sourcesOfFunds,
            totalSources,
            uses: usesOfFunds,
            totalUses,
            netSurplusDeficit: totalSources - totalUses
        };
    }
}

module.exports = new CalculationService();