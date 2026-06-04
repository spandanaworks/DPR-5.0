const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const imageUpload = multer({
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/dpr/health', (req, res) => {
    res.json({ status: 'OK', message: 'DPR Narrative Engine Running' });
});

// Image upload endpoint
app.post('/api/dpr/upload-image', imageUpload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const imageUrl = `/uploads/${req.file.filename}`;
        console.log(`📸 Image uploaded: ${imageUrl} (${req.body.type || 'unknown'})`);
        
        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename,
            type: req.body.type
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Template-based narrative generator (backup)
function generateTemplateNarrative(data) {
    console.log('📝 Using TEMPLATE-BACKUP narrative generator...');
    
    const businessName = data.business_name || 'the business';
    const location = `${data.village || ''} ${data.district || ''} ${data.state || ''}`.trim() || 'the region';
    const product = data.primary_product || 'products and services';
    const capacity = Number(data.daily_capacity) || 0;
    const price = Number(data.selling_price) || 0;
    
    const landCost = Number(data.land_cost) || 0;
    const buildingCost = Number(data.building_cost) || 0;
    const machineryCost = Number(data.machinery_total) || 0;
    const totalCost = landCost + buildingCost + machineryCost;
    const promoterShare = Number(data.promoter_contribution) || 0;
    const promoterPercent = totalCost > 0 ? ((promoterShare / totalCost) * 100).toFixed(1) : 'the required';
    
    const mgmtCount = Number(data.mgmt_count) || 0;
    const supCount = Number(data.sup_count) || 0;
    const skillCount = Number(data.skill_count) || 0;
    const totalStaff = mgmtCount + supCount + skillCount + Number(data.unskill_count || 0) + Number(data.admin_count || 0);
    
    const executiveSummary = `
        <p><strong>Executive Summary</strong></p>
        <p>${businessName} proposes to establish a ${product} enterprise at ${location}. This initiative represents a strategic opportunity to capitalize on growing market demand while creating sustainable economic value for the community. The project demonstrates strong commercial viability with a well-structured implementation plan and robust financial framework.</p>
        
        <p>The business aims to deliver superior quality ${product} through efficient operations and customer-centric approach. Located strategically at ${location}, the enterprise benefits from excellent access to raw materials, transportation networks, and target markets. The management team brings relevant industry experience and operational expertise to drive success.</p>
        
        <p>Financially, the project shows healthy returns with break-even expected within 24-36 months of operations. The capital structure reflects prudent promoter contribution of ${promoterPercent}%, demonstrating stakeholder confidence. The venture will generate meaningful employment opportunities, contributing to local economic development while maintaining strong governance and compliance standards.</p>
    `;
    
    const businessOverview = `
        <p><strong>Business Overview</strong></p>
        <p>${businessName} is established as a ${data.entity_type || 'business entity'} with a clear vision of excellence in ${product}. The organization is committed to delivering value to customers through quality products, efficient service, and continuous improvement. The enterprise operates with proper registrations and compliance with applicable laws and regulations.</p>
        
        <p>The business location at ${location} offers distinct advantages including proximity to target customers, availability of infrastructure, and access to skilled workforce. The management team brings diverse expertise across operations, finance, marketing, and human resources, ensuring balanced decision-making and risk management.</p>
        
        <p>The organization's mission focuses on sustainable growth, customer satisfaction, and stakeholder value creation. Core activities encompass procurement, production, distribution, and customer relationship management, supported by robust systems and processes.</p>
    `;
    
    const productTechnology = `
        <p><strong>Product & Technology</strong></p>
        <p>${businessName} will offer ${product} designed to meet customer requirements effectively. ${capacity > 0 ? `With a daily capacity of ${capacity} units,` : ''} the operations are scaled appropriately to address market demand while maintaining quality standards. ${price > 0 ? `Pricing is positioned at ₹${price} per unit,` : ''} reflecting value proposition and competitive positioning.</p>
        
        <p>The production process utilizes appropriate technology and equipment to ensure consistency and efficiency. Quality control measures are implemented at each stage, from raw material procurement to finished goods dispatch. The facility maintains standards for safety, hygiene, and operational excellence.</p>
        
        <p>The unique selling proposition centers on ${data.usp || 'quality, reliability, and customer service'}. This differentiation enables the business to build customer loyalty and sustainable competitive advantage in the marketplace.</p>
    `;
    
    const marketAnalysis = `
        <p><strong>Market Analysis</strong></p>
        <p>The market for ${product} demonstrates positive growth trajectory driven by evolving consumer preferences and economic development. ${data.target_customers ? `Target customers include ${data.target_customers}.` : 'The customer base spans retail, institutional, and commercial segments.'}</p>
        
        <p>Competitive landscape includes ${data.competitors || 'established players and emerging enterprises'}. Differentiation strategy focuses on ${data.usp || 'quality, service, and value'}, enabling the business to capture market share while maintaining customer loyalty.</p>
        
        <p>Distribution channels include ${data.sales_location || 'direct sales, retail partnerships, and strategic alliances'}. The business will leverage these channels to reach customers effectively while optimizing costs. Market growth projections indicate sustained demand, supporting the enterprise's expansion plans over the planning horizon.</p>
    `;
    
    const swotAnalysis = `
        <p><strong>STRENGTHS:</strong> ${data.strengths || 'Experienced management team, strategic location, quality focus, customer-centric approach, operational efficiency, and strong vendor relationships.'}</p>
        
        <p><strong>WEAKNESSES:</strong> ${data.weaknesses || 'Market entry as new player, brand building requirements, initial working capital needs, and dependency on key personnel during startup phase.'}</p>
        
        <p><strong>OPPORTUNITIES:</strong> ${data.opportunities || 'Growing market demand, expansion into adjacent segments, technology adoption for efficiency, strategic partnerships, and geographic market expansion.'}</p>
        
        <p><strong>THREATS:</strong> ${data.threats || 'Competition intensity, economic fluctuations, regulatory changes, raw material price volatility, and technological obsolescence risks.'}</p>
        
        <p><strong>STRATEGIC RECOMMENDATIONS:</strong> Focus on building brand awareness through targeted marketing, invest in customer relationship management, maintain quality consistency, develop supplier partnerships for cost optimization, and continuously monitor market trends for timely adaptation.</p>
    `;
    
    const socialImpact = `
        <p><strong>Social & Environmental Impact</strong></p>
        <p>The project will generate meaningful employment opportunities with ${totalStaff > 0 ? totalStaff : 'direct and indirect'} positions in the local community. ${data.women_employment ? `Women's employment is specifically promoted with ${data.women_employment} positions.` : ''} ${data.youth_employment ? `Youth employment includes ${data.youth_employment} opportunities for skill development and career growth.` : ''}</p>
        
        <p>${data.eco_friendly === 'Yes' ? 'Environmental sustainability is integral to operations with eco-friendly practices implemented across the value chain. ' : ''}${data.training === 'Yes' ? 'Training programs enhance employee skills and career progression. ' : ''}The enterprise contributes to local economic development through vendor engagement, tax contributions, and community initiatives.</p>
    `;
    
    const riskAssessment = `
        <p><strong>Risk Assessment & Mitigation</strong></p>
        <p><strong>Market Risks:</strong> Demand fluctuations and competition are addressed through customer diversification, quality focus, and responsive marketing. Regular market monitoring enables timely strategy adjustments.</p>
        
        <p><strong>Operational Risks:</strong> Supply chain disruptions and quality issues are mitigated through vendor diversification, inventory management, and robust quality control systems. Preventive maintenance ensures equipment reliability.</p>
        
        <p><strong>Financial Risks:</strong> Cash flow management includes prudent working capital planning, cost control measures, and contingency reserves. Regular financial reviews enable proactive issue identification and resolution.</p>
        
        <p><strong>Regulatory Risks:</strong> Compliance is ensured through legal review, regular audits, and professional advisory support. Documentation and reporting systems maintain transparency and accountability.</p>
    `;
    
    const financialNarrative = `
        <p><strong>Financial Analysis</strong></p>
        <p>The total project cost is estimated at ₹${totalCost.toLocaleString()}, comprising land, building, machinery, and working capital requirements. This investment level is appropriate for the scale of operations and market opportunity.</p>
        
        <p>The capital structure includes promoter contribution of ${promoterPercent}%, demonstrating stakeholder commitment and reducing leverage. This healthy equity base supports creditworthiness and financial stability.</p>
        
        <p>Financial projections indicate profitable operations with improving margins over time. Break-even is expected within 24-36 months of commencement, reflecting efficient cost management and revenue growth.</p>
        
        <p>Key ratios suggest sound financial health with adequate liquidity, reasonable leverage, and strong coverage. The business generates sufficient cash flows to meet obligations while funding growth initiatives.</p>
    `;
    
    const declaration = `
        <p><strong>Declaration</strong></p>
        <p>I hereby declare that the information provided in this Detailed Project Report is true, accurate, and complete to the best of my knowledge and belief. The business is compliant with all applicable laws and regulations.</p>
        
        <p>The financial projections are based on realistic assumptions reflecting market conditions and operational capabilities. There are no pending litigations that would adversely affect the project viability.</p>
        
        <p>Funds requested will be utilized solely for the stated purpose as per the terms and conditions of sanction. The enterprise will comply with all statutory requirements throughout the project lifecycle.</p>
    `;
    
    return {
        executiveSummary,
        businessOverview,
        productTechnology,
        marketAnalysis,
        swotAnalysis,
        socialImpact,
        riskAssessment,
        financialNarrative,
        declaration
    };
}

// Gemini helper function
async function generateWithGemini(prompt, sectionName = 'General') {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-pro'];
    
    for (let i = 0; i < models.length; i++) {
        try {
            console.log(`🔄 Trying ${sectionName} with model: ${models[i]}...`);
            const model = genAI.getGenerativeModel({ model: models[i] });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            if (text && text.length > 100) {
                console.log(`✅ ${sectionName} generated with ${models[i]}`);
                return text;
            }
        } catch (error) {
            console.log(`⚠️ ${models[i]} failed for ${sectionName}: ${error.message}`);
            if (i === models.length - 1) {
                console.log(`❌ All models failed for ${sectionName}, using template backup`);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return null;
}

// Main report generation endpoint
app.post('/api/dpr/generate-full-report', async (req, res) => {
    let browser = null;
    try {
        const data = req.body;
        console.log(`📊 Generating NARRATIVE report for: ${data.business_name || 'Business'}`);

        // Extract uploaded images from request
        const uploadedImages = data.uploaded_images || {};
        const baseUrl = `http://localhost:${PORT}`;
        
        const logoUrl = uploadedImages.logo ? `${baseUrl}${uploadedImages.logo}` : '';
        const productImageUrl = uploadedImages.product ? `${baseUrl}${uploadedImages.product}` : '';
        const facilityImageUrl = uploadedImages.facility ? `${baseUrl}${uploadedImages.facility}` : '';
        const teamImageUrl = uploadedImages.team ? `${baseUrl}${uploadedImages.team}` : '';

        // Calculate user data
        const dailyCapacity = Number(data.daily_capacity) || 0;
        const sellingPrice = Number(data.selling_price) || 0;
        
        const mgmtCount = Number(data.mgmt_count) || 0;
        const supCount = Number(data.sup_count) || 0;
        const skillCount = Number(data.skill_count) || 0;
        const unskillCount = Number(data.unskill_count) || 0;
        const adminCount = Number(data.admin_count) || 0;
        const totalStaffCount = mgmtCount + supCount + skillCount + unskillCount + adminCount;
        
        const mgmtCost = (mgmtCount * (Number(data.mgmt_salary) || 0));
        const supCost = (supCount * (Number(data.sup_salary) || 0));
        const skillCost = (skillCount * (Number(data.skill_salary) || 0));
        const unskillCost = (unskillCount * (Number(data.unskill_salary) || 0));
        const adminCost = (adminCount * (Number(data.admin_salary) || 0));
        const totalSalaryCost = mgmtCost + supCost + skillCost + unskillCost + adminCost;
        
        const landCost = Number(data.land_cost) || 0;
        const buildingCost = Number(data.building_cost) || 0;
        const machineryTotal = Number(data.machinery_total) || 0;
        const furnitureCost = Number(data.furniture_cost) || 0;
        const workingCapital = Number(data.working_capital) || 0;
        const otherCost = Number(data.other_cost) || 0;
        const totalProjectCost = landCost + buildingCost + machineryTotal + furnitureCost + workingCapital + otherCost;
        
        const promoterContribution = Number(data.promoter_contribution) || 0;
        const bankLoan = Number(data.bank_loan) || 0;
        const promoterPercent = totalProjectCost > 0 ? ((promoterContribution / totalProjectCost) * 100).toFixed(1) : 0;
        const loanPercent = totalProjectCost > 0 ? ((bankLoan / totalProjectCost) * 100).toFixed(1) : 0;

        const templateContent = generateTemplateNarrative(data);
        console.log('📝 Template backup ready');

        // Generate content with API + template backup
        console.log('📝 Generating content with Gemini + template backup...');
        
        let call1 = await generateWithGemini(`
            Write THREE sections for a bank loan DPR.
            BUSINESS DATA: Name: ${data.business_name || 'Not provided'}
            PRODUCT DATA: ${data.primary_product || 'Not provided'}
            Return in format: [EXECUTIVE_SUMMARY]...[BUSINESS_OVERVIEW]...[PRODUCT_TECHNOLOGY]...
        `, 'Call1');

        let call2 = await generateWithGemini(`
            Write THREE sections. MARKET: ${data.target_customers || 'Not provided'}
            SWOT: Strengths: ${data.strengths || 'Not provided'}
            Return in format: [MARKET_ANALYSIS]...[SWOT_ANALYSIS]...[SOCIAL_IMPACT]...
        `, 'Call2');

        let call3 = await generateWithGemini(`
            Write THREE sections. FINANCIAL: Total Cost: ₹${totalProjectCost.toLocaleString()}
            Return in format: [RISK_ASSESSMENT]...[FINANCIAL_NARRATIVE]...[DECLARATION]...
        `, 'Call3');

        function extractSection(content, header, templateValue) {
            if (!content) return templateValue;
            const regex = new RegExp(`\\[${header}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
            const match = content.match(regex);
            return match ? match[1].trim() : templateValue;
        }

        const executiveSummary = extractSection(call1, 'EXECUTIVE_SUMMARY', templateContent.executiveSummary);
        const businessOverview = extractSection(call1, 'BUSINESS_OVERVIEW', templateContent.businessOverview);
        const productTechnology = extractSection(call1, 'PRODUCT_TECHNOLOGY', templateContent.productTechnology);
        const marketAnalysis = extractSection(call2, 'MARKET_ANALYSIS', templateContent.marketAnalysis);
        const swotAnalysis = extractSection(call2, 'SWOT_ANALYSIS', templateContent.swotAnalysis);
        const socialImpact = extractSection(call2, 'SOCIAL_IMPACT', templateContent.socialImpact);
        const riskAssessment = extractSection(call3, 'RISK_ASSESSMENT', templateContent.riskAssessment);
        const financialNarrative = extractSection(call3, 'FINANCIAL_NARRATIVE', templateContent.financialNarrative);
        const declaration = extractSection(call3, 'DECLARATION', templateContent.declaration);

        console.log('✅ All content generated');

        // Read HTML template
        const templatePath = path.join(__dirname, 'templates', 'dpr-template.html');
        let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Build members rows
        let membersRows = '';
        if (data.members && data.members.length > 0) {
            data.members.forEach(m => {
                membersRows += `<tr>
                    <td>${m.name || 'N/A'}</td>
                    <td>${m.role || 'N/A'}</td>
                    <td>${m.age || 'N/A'}</td>
                    <td>${m.qualification || 'N/A'}</td>
                    <td>${m.experience || 'N/A'}</td>
                    <td>Operations</td>
                </tr>`;
            });
        } else {
            membersRows = `<tr><td colspan="6">No member data provided</td></tr>`;
        }
        
        // Build machinery rows
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
        } else {
            machineryRows = `<tr><td colspan="5">No machinery data provided</td></td>`;
        }
        
        const annualRevenue = dailyCapacity * sellingPrice * 300;
        
        // Replace placeholders
        const replacements = {
            '{{business_name}}': data.business_name || 'Not provided',
            '{{village}}': data.village || 'Not provided',
            '{{district}}': data.district || 'Not provided',
            '{{state}}': data.state || 'Not provided',
            '{{generated_date}}': new Date().toLocaleDateString(),
            '{{full_address}}': `${data.village || ''}, ${data.block || ''}, ${data.district || ''}, ${data.state || ''}`,
            '{{contact_number}}': data.contact_number || 'Not provided',
            '{{email}}': data.email || 'Not provided',
            '{{entity_type}}': data.entity_type || 'Not provided',
            '{{cin}}': data.cin || 'Not provided',
            '{{gst_no}}': data.gst_no || 'Not provided',
            '{{pan_no}}': data.pan_no || 'Not provided',
            
            '{{executive_summary_text}}': executiveSummary,
            '{{business_overview_text}}': businessOverview,
            '{{product_technology_text}}': productTechnology,
            '{{market_analysis_text}}': marketAnalysis,
            '{{swot_analysis_text}}': swotAnalysis,
            '{{social_impact_text}}': socialImpact,
            '{{risk_assessment_text}}': riskAssessment,
            '{{financial_narrative_text}}': financialNarrative,
            '{{declaration_text}}': declaration,
            
            '{{logo_url}}': logoUrl,
            '{{product_image_url}}': productImageUrl,
            '{{facility_image_url}}': facilityImageUrl,
            '{{team_image_url}}': teamImageUrl,
            
            '{{primary_product}}': data.primary_product || 'Not provided',
            '{{hsn_code}}': data.hsn_code || 'Not provided',
            '{{daily_capacity}}': dailyCapacity > 0 ? dailyCapacity : 'Not provided',
            '{{capacity_unit}}': data.capacity_unit || 'units',
            '{{selling_price}}': sellingPrice > 0 ? sellingPrice : 'Not provided',
            '{{annual_capacity_kg}}': dailyCapacity > 0 ? (dailyCapacity * 300).toLocaleString() : 'Not provided',
            
            '{{rev_year1}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.6).toLocaleString() : 'Not provided',
            '{{rev_year2}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.75).toLocaleString() : 'Not provided',
            '{{rev_year3}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.85).toLocaleString() : 'Not provided',
            '{{rev_year4}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.9).toLocaleString() : 'Not provided',
            '{{rev_year5}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.95).toLocaleString() : 'Not provided',
            '{{pat_year1}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.6 * 0.12).toLocaleString() : 'Not provided',
            '{{pat_year2}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.75 * 0.13).toLocaleString() : 'Not provided',
            '{{pat_year3}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.85 * 0.14).toLocaleString() : 'Not provided',
            '{{pat_year4}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.9 * 0.15).toLocaleString() : 'Not provided',
            '{{pat_year5}}': annualRevenue > 0 ? Math.round(annualRevenue * 0.95 * 0.16).toLocaleString() : 'Not provided',
            '{{pat_margin1}}': '12.0', '{{pat_margin2}}': '13.0', '{{pat_margin3}}': '14.0', 
            '{{pat_margin4}}': '15.0', '{{pat_margin5}}': '16.0',
            
            '{{mgmt_count}}': mgmtCount,
            '{{mgmt_cost_formatted}}': mgmtCost.toLocaleString(),
            '{{sup_count}}': supCount,
            '{{sup_cost_formatted}}': supCost.toLocaleString(),
            '{{skill_count}}': skillCount,
            '{{skill_cost_formatted}}': skillCost.toLocaleString(),
            '{{unskill_count}}': unskillCount,
            '{{unskill_cost_formatted}}': unskillCost.toLocaleString(),
            '{{admin_count}}': adminCount,
            '{{admin_cost_formatted}}': adminCost.toLocaleString(),
            '{{total_staff_count}}': totalStaffCount,
            '{{total_salary_cost}}': totalSalaryCost.toLocaleString(),
            
            '{{machinery_total_formatted}}': machineryTotal.toLocaleString(),
            
            '{{direct_employment}}': data.local_employment || totalStaffCount,
            '{{indirect_employment}}': 'Estimated 100',
            '{{women_employment}}': data.women_employment || 'Not provided',
            '{{women_percent}}': data.women_employment && totalStaffCount > 0 ? Math.round((data.women_employment / totalStaffCount) * 100) : 'Not provided',
            '{{youth_employment}}': data.youth_employment || 'Not provided',
            
            '{{place}}': data.place || data.district || 'Not provided',
            '{{declaration_date}}': data.declaration_date || new Date().toLocaleDateString(),
            '{{declarant_name}}': data.declarant_name || data.contact_name || 'Not provided',
            '{{designation}}': data.designation || 'Director',
            
            '{{members_rows}}': membersRows,
            '{{machinery_rows}}': machineryRows,
            
            '{{bep_units}}': '0',
            '{{bep_percent}}': '0',
            '{{bep_months}}': '24'
        };
        
        for (const [key, value] of Object.entries(replacements)) {
            htmlTemplate = htmlTemplate.split(key).join(value);
        }
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
        });
        await browser.close();
        
        console.log('✅ PDF generated successfully!');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=DPR_${data.business_name || 'Report'}_${Date.now()}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
});

// Balance sheet upload endpoint
app.post('/api/dpr/upload-balance-sheet', (req, res) => {
    res.json({ success: false, error: 'Coming soon.' });
});

app.listen(PORT, () => {
    console.log(`🚀 DPR Server running on port ${PORT}`);
    console.log(`📸 Image upload endpoint: http://localhost:${PORT}/api/dpr/upload-image`);
    console.log(`🖼️ Images served from: http://localhost:${PORT}/uploads/`);
    console.log(`📊 Health: http://localhost:${PORT}/api/dpr/health`);
});