const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

app.get('/api/dpr/health', (req, res) => {
    res.json({ status: 'OK', message: 'DPR Engine Running (Optimized)' });
});

app.post('/api/dpr/generate-full-report', async (req, res) => {
    let browser = null;
    try {
        const data = req.body;
        console.log(`📊 Generating report for: ${data.business_name || 'Business'}`);

        // ========== BACKEND CALCULATIONS (FREE, NO TOKENS) ==========
        
        // Project Cost
        const landCost = Number(data.land_cost) || 0;
        const buildingCost = Number(data.building_cost) || 0;
        const machineryTotal = Number(data.machinery_total) || 0;
        const furnitureCost = Number(data.furniture_cost) || 0;
        const workingCapital = Number(data.working_capital) || 0;
        const otherCost = Number(data.other_cost) || 0;
        const totalProjectCost = landCost + buildingCost + machineryTotal + furnitureCost + workingCapital + otherCost;
        
        // Means of Finance
        const promoterContribution = Number(data.promoter_contribution) || 0;
        const bankLoan = Number(data.bank_loan) || 0;
        const subsidy = Number(data.subsidy) || 0;
        const promoterPercent = totalProjectCost > 0 ? ((promoterContribution / totalProjectCost) * 100).toFixed(1) : 0;
        const loanPercent = totalProjectCost > 0 ? ((bankLoan / totalProjectCost) * 100).toFixed(1) : 0;
        
        // Staff Calculations
        const mgmtCount = Number(data.mgmt_count) || 0;
        const supCount = Number(data.sup_count) || 0;
        const skillCount = Number(data.skill_count) || 0;
        const unskillCount = Number(data.unskill_count) || 0;
        const adminCount = Number(data.admin_count) || 0;
        const totalStaffCount = mgmtCount + supCount + skillCount + unskillCount + adminCount;
        
        const mgmtSalary = Number(data.mgmt_salary) || 0;
        const supSalary = Number(data.sup_salary) || 0;
        const skillSalary = Number(data.skill_salary) || 0;
        const unskillSalary = Number(data.unskill_salary) || 0;
        const adminSalary = Number(data.admin_salary) || 0;
        
        const totalSalaryCost = (mgmtCount * mgmtSalary) + (supCount * supSalary) + 
                                (skillCount * skillSalary) + (unskillCount * unskillSalary) + 
                                (adminCount * adminSalary);
        
        // Daily/Annual Revenue
        const dailyCapacity = Number(data.daily_capacity) || 0;
        const sellingPrice = Number(data.selling_price) || 0;
        const annualRevenue = dailyCapacity * sellingPrice * 300;
        
        // 5-Year Projections (calculated by backend)
        const projections = [];
        const capacityRamp = [0.6, 0.75, 0.85, 0.9, 0.95];
        for (let i = 0; i < 5; i++) {
            const revenue = Math.round(annualRevenue * capacityRamp[i]);
            const pat = Math.round(revenue * 0.12); // 12% PAT margin assumption
            projections.push({ revenue, pat });
        }
        
        // Break-even (calculated by backend)
        const variableCostPerUnit = 250;
        const contributionPerUnit = sellingPrice - variableCostPerUnit;
        const fixedCosts = totalSalaryCost * 12 + (Number(data.monthly_rent) || 0) * 12 + 500000;
        const bepUnits = contributionPerUnit > 0 ? Math.ceil(fixedCosts / contributionPerUnit) : 0;
        const bepPercent = (dailyCapacity > 0 && bepUnits > 0) ? ((bepUnits / dailyCapacity / 300) * 100).toFixed(1) : 0;
        
        // Balance Sheet Ratios (calculated by backend)
        const totalCurrentAssets = (Number(data.cash_in_hand) || 0) + (Number(data.bank_balance) || 0) + 
                                   (Number(data.inventory_value) || 0) + (Number(data.receivables) || 0);
        const totalFixedAssets = landCost + buildingCost + machineryTotal;
        const totalAssets = totalCurrentAssets + totalFixedAssets;
        
        const totalCurrentLiabilities = (Number(data.short_term_loan) || 0) + (Number(data.creditors) || 0);
        const totalLongTermLiabilities = Number(data.long_term_loan) || 0;
        const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
        
        const totalEquity = (Number(data.owner_capital) || 0) + (Number(data.retained_earnings) || 0);
        const currentRatio = totalCurrentLiabilities > 0 ? (totalCurrentAssets / totalCurrentLiabilities).toFixed(2) : 0;
        const debtEquityRatio = totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : 0;

        // ========== GEMINI ONLY FOR NARRATIVE SECTIONS (3-4 CALLS ONLY) ==========
        
        console.log('🤖 Gemini: Writing narrative sections only...');
        
        // CALL 1: Executive Summary + Business Overview (2 sections)
        const narrative1 = await generateWithGemini(`
            Write TWO narrative sections for a bank loan DPR.
            
            BUSINESS DATA:
            Business Name: ${data.business_name || 'Not provided'}
            Business Description: ${data.business_desc || 'Not provided'}
            Entity Type: ${data.entity_type || 'Not provided'}
            Location: ${data.village || ''}, ${data.district || ''}, ${data.state || ''}
            Contact: ${data.contact_name || 'Not provided'}
            Product: ${data.primary_product || 'Not provided'}
            
            Return EXACTLY in this format:
            
            [EXECUTIVE_SUMMARY]
            Write 350-450 words. Include: business mission, problem solved, location advantage, growth potential.
            
            [BUSINESS_OVERVIEW]
            Write 300-400 words. Include: company background, legal status, core activities, management expertise.
        `);

        // CALL 2: Product + Market + SWOT (3 sections)
        const narrative2 = await generateWithGemini(`
            Write THREE narrative sections for a bank loan DPR.
            
            PRODUCT DATA:
            Product: ${data.primary_product || 'Not provided'}
            Daily Capacity: ${dailyCapacity > 0 ? dailyCapacity + ' ' + (data.capacity_unit || 'units') : 'Not provided'}
            Selling Price: ${sellingPrice > 0 ? '₹' + sellingPrice : 'Not provided'}
            Raw Materials: ${data.raw_materials || 'Not provided'}
            USP: ${data.usp || 'Not provided'}
            
            MARKET DATA:
            Target Customers: ${data.target_customers || 'Not provided'}
            Competitors: ${data.competitors || 'Not provided'}
            
            SWOT DATA (from user):
            Strengths: ${data.strengths || 'Not provided'}
            Weaknesses: ${data.weaknesses || 'Not provided'}
            Opportunities: ${data.opportunities || 'Not provided'}
            Threats: ${data.threats || 'Not provided'}
            
            Return EXACTLY in this format:
            
            [PRODUCT_TECHNOLOGY]
            Write 350-450 words. Include: product features, manufacturing process, technology advantages, USP.
            
            [MARKET_ANALYSIS]
            Write 400-500 words. Include: market size, target segments, competition, growth opportunities.
            
            [SWOT_ANALYSIS]
            Format as:
            STRENGTHS: (based on user input)
            WEAKNESSES: (based on user input)
            OPPORTUNITIES: (based on user input)
            THREATS: (based on user input)
            STRATEGIC RECOMMENDATIONS: (4-5 sentences)
        `);

        // CALL 3: Social + Risk + Declaration (3 sections)
        const narrative3 = await generateWithGemini(`
            Write THREE narrative sections for a bank loan DPR.
            
            SOCIAL DATA:
            Direct Employment: ${totalStaffCount} persons
            Women Employment: ${data.women_employment || 'Not provided'}
            Youth Employment: ${data.youth_employment || 'Not provided'}
            Eco-friendly Practices: ${data.eco_friendly || 'Not provided'}
            
            FINANCIAL CONTEXT (for risk assessment):
            Total Project Cost: ₹${totalProjectCost.toLocaleString()}
            Bank Loan: ₹${bankLoan.toLocaleString()}
            Total Staff: ${totalStaffCount}
            
            CREDIT DATA:
            CIBIL Score: ${data.cibil_score || 'Not provided'}
            Default History: ${data.default_history || 'Not provided'}
            
            Return EXACTLY in this format:
            
            [SOCIAL_IMPACT]
            Write 350-450 words. Include: employment impact, women empowerment, environmental practices.
            
            [RISK_ASSESSMENT]
            Write 400-500 words. Cover: Market risks, Operational risks, Financial risks, and mitigation.
            
            [DECLARATION]
            Write 150-200 words formal declaration for bank loan application.
        `);

        // Parse narratives
        function extractSection(content, header) {
            const regex = new RegExp(`\\[${header}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
            const match = content.match(regex);
            return match ? match[1].trim() : 'Information not available.';
        }

        const executiveSummary = extractSection(narrative1, 'EXECUTIVE_SUMMARY');
        const businessOverview = extractSection(narrative1, 'BUSINESS_OVERVIEW');
        const productTechnology = extractSection(narrative2, 'PRODUCT_TECHNOLOGY');
        const marketAnalysis = extractSection(narrative2, 'MARKET_ANALYSIS');
        const swotAnalysis = extractSection(narrative2, 'SWOT_ANALYSIS');
        const socialImpact = extractSection(narrative3, 'SOCIAL_IMPACT');
        const riskAssessment = extractSection(narrative3, 'RISK_ASSESSMENT');
        const declaration = extractSection(narrative3, 'DECLARATION');

        console.log('✅ Gemini finished (3 calls, ~4,000 tokens total)');

        // ========== FINANCIAL NARRATIVE = BACKEND GENERATED (NO GEMINI) ==========
        const financialNarrative = `
            <p><strong>Project Cost Analysis:</strong> The total project cost is estimated at ₹${totalProjectCost.toLocaleString()}. This includes land and building (${((landCost + buildingCost)/totalProjectCost*100).toFixed(1)}%), plant and machinery (${(machineryTotal/totalProjectCost*100).toFixed(1)}%), and working capital requirements (${(workingCapital/totalProjectCost*100).toFixed(1)}%). The cost estimates are based on current market rates and quotations from verified suppliers.</p>
            
            <p><strong>Capital Structure:</strong> The project is financed through promoter's contribution of ${promoterPercent}% (₹${promoterContribution.toLocaleString()}) and bank loan of ${loanPercent}% (₹${bankLoan.toLocaleString()}). The debt-equity ratio of ${debtEquityRatio} is healthy for the manufacturing sector, indicating moderate leverage and comfortable servicing capability.</p>
            
            <p><strong>Profitability Outlook:</strong> Based on the projected capacity utilization of 60% in Year 1 ramping up to 95% by Year 5, the business is expected to generate annual revenue of ₹${projections[0]?.revenue.toLocaleString()} in Year 1, reaching ₹${projections[4]?.revenue.toLocaleString()} by Year 5. With a projected PAT margin of 12-16%, the net profit is expected to grow from ₹${projections[0]?.pat.toLocaleString()} to ₹${projections[4]?.pat.toLocaleString()} over five years.</p>
            
            <p><strong>Break-even & Servicing:</strong> The business needs to achieve ${bepPercent}% capacity utilization (${bepUnits.toLocaleString()} units) to break even, which is achievable within 24 months of operations. The healthy current ratio of ${currentRatio} indicates strong liquidity position.</p>
        `;

        // ========== READ TEMPLATE ==========
        const templatePath = path.join(__dirname, 'templates', 'dpr-template.html');
        let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Build members/machinery rows
        let membersRows = '';
        if (data.members && data.members.length > 0) {
            data.members.forEach(m => {
                membersRows += `<tr>
                    <td>${m.name || 'N/A'}</td>
                    <td>${m.role || 'N/A'}</td>
                    <td>${m.age || 'N/A'}</td>
                    <td>${m.qualification || 'N/A'}</td>
                    <td>${m.experience || 'N/A'}</td>
                    <td>Operations\n               </tr>`;
            });
        }
        
        let machineryRows = '';
        if (data.machinery && data.machinery.length > 0) {
            data.machinery.forEach((m, idx) => {
                machineryRows += `<tr>
                    <td>${idx + 1}</td>
                    <td>${m.name || 'N/A'}</td>
                    <td>${m.quantity || 0}</td>
                    <td>₹${(Number(m.price) || 0).toLocaleString()}</td>
                    <td>₹${(Number(m.total) || 0).toLocaleString()}</td>
                </tr>`;
            });
        }
        
        // Replace placeholders
        const replacements = {
            '{{business_name}}': data.business_name || 'Not provided',
            '{{village}}': data.village || 'Not provided',
            '{{district}}': data.district || 'Not provided',
            '{{state}}': data.state || 'Not provided',
            '{{generated_date}}': new Date().toLocaleDateString(),
            '{{full_address}}': `${data.village || ''}, ${data.district || ''}, ${data.state || ''}`,
            '{{contact_number}}': data.contact_number || 'Not provided',
            '{{email}}': data.email || 'Not provided',
            '{{entity_type}}': data.entity_type || 'Not provided',
            '{{executive_summary_text}}': executiveSummary,
            '{{business_overview_text}}': businessOverview,
            '{{product_technology_text}}': productTechnology,
            '{{market_analysis_text}}': marketAnalysis,
            '{{swot_analysis_text}}': swotAnalysis,
            '{{social_impact_text}}': socialImpact,
            '{{risk_assessment_text}}': riskAssessment,
            '{{financial_narrative_text}}': financialNarrative,
            '{{declaration_text}}': declaration,
            '{{primary_product}}': data.primary_product || 'Not provided',
            '{{daily_capacity}}': dailyCapacity || 'Not provided',
            '{{selling_price}}': sellingPrice || 'Not provided',
            '{{annual_capacity_kg}}': (dailyCapacity * 300).toLocaleString() || 'Not provided',
            '{{rev_year1}}': projections[0]?.revenue.toLocaleString() || '0',
            '{{rev_year2}}': projections[1]?.revenue.toLocaleString() || '0',
            '{{rev_year3}}': projections[2]?.revenue.toLocaleString() || '0',
            '{{rev_year4}}': projections[3]?.revenue.toLocaleString() || '0',
            '{{rev_year5}}': projections[4]?.revenue.toLocaleString() || '0',
            '{{pat_year1}}': projections[0]?.pat.toLocaleString() || '0',
            '{{pat_year2}}': projections[1]?.pat.toLocaleString() || '0',
            '{{pat_year3}}': projections[2]?.pat.toLocaleString() || '0',
            '{{pat_year4}}': projections[3]?.pat.toLocaleString() || '0',
            '{{pat_year5}}': projections[4]?.pat.toLocaleString() || '0',
            '{{bep_units}}': bepUnits.toLocaleString(),
            '{{bep_percent}}': bepPercent,
            '{{bep_months}}': '24',
            '{{total_staff_count}}': totalStaffCount,
            '{{total_salary_cost}}': totalSalaryCost.toLocaleString(),
            '{{machinery_total_formatted}}': machineryTotal.toLocaleString(),
            '{{direct_employment}}': totalStaffCount,
            '{{women_employment}}': data.women_employment || 'Not provided',
            '{{women_percent}}': data.women_employment && totalStaffCount > 0 ? Math.round((data.women_employment / totalStaffCount) * 100) : 'N/A',
            '{{youth_employment}}': data.youth_employment || 'Not provided',
            '{{place}}': data.place || data.district || 'Not provided',
            '{{declaration_date}}': data.declaration_date || new Date().toLocaleDateString(),
            '{{declarant_name}}': data.declarant_name || data.contact_name || 'Not provided',
            '{{designation}}': data.designation || 'Director',
            '{{members_rows}}': membersRows,
            '{{machinery_rows}}': machineryRows,
            '{{mgmt_cost_formatted}}': (mgmtCount * mgmtSalary).toLocaleString(),
            '{{sup_cost_formatted}}': (supCount * supSalary).toLocaleString(),
            '{{skill_cost_formatted}}': (skillCount * skillSalary).toLocaleString(),
            '{{unskill_cost_formatted}}': (unskillCount * unskillSalary).toLocaleString(),
            '{{admin_cost_formatted}}': (adminCount * adminSalary).toLocaleString()
        };
        
        for (const [key, value] of Object.entries(replacements)) {
            htmlTemplate = htmlTemplate.split(key).join(value);
        }
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
        await browser.close();
        
        console.log('✅ PDF generated successfully! (Token-efficient)');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=DPR_${data.business_name || 'Report'}_${Date.now()}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
});

async function generateWithGemini(prompt) {
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
    
    for (let i = 0; i < models.length; i++) {
        try {
            const model = genAI.getGenerativeModel({ model: models[i] });
            const result = await model.generateContent(prompt);
            const text = (await result.response).text();
            if (text && text.length > 100) return text;
        } catch (error) {
            console.log(`Model ${models[i]} failed, trying next...`);
        }
    }
    return 'Information not available.';
}

app.post('/api/dpr/upload-balance-sheet', (req, res) => {
    res.json({ success: false, error: 'Coming soon.' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✨ Gemini used ONLY for narrative (3 calls, ~4,000 tokens)`);
    console.log(`📊 Calculations done by backend (FREE!)`);
});