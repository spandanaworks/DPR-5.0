const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
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
    res.json({ status: 'OK', message: 'DPR Backend Running with Supabase' });
});

// ========== SAVE REPORT TO SUPABASE ==========
app.post('/api/dpr/save-report', async (req, res) => {
    try {
        const { reportData, reportId, userId } = req.body;
        const defaultUserId = '00000000-0000-0000-0000-000000000000';
        
        let result;
        
        if (reportId) {
            result = await supabase
                .from('dpr_reports')
                .update({
                    business_name: reportData.business_name,
                    form_data: reportData,
                    updated_at: new Date()
                })
                .eq('id', reportId)
                .eq('user_id', userId || defaultUserId);
        } else {
            result = await supabase
                .from('dpr_reports')
                .insert([{
                    user_id: userId || defaultUserId,
                    business_name: reportData.business_name,
                    form_data: reportData,
                    status: 'draft'
                }]);
        }
        
        if (result.error) throw result.error;
        
        res.json({ success: true, message: 'Report saved to Supabase!' });
        
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== LOAD REPORT FROM SUPABASE ==========
app.get('/api/dpr/load-report/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('dpr_reports')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, report: data });
        
    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== GET ALL REPORTS FOR A USER ==========
app.get('/api/dpr/user-reports', async (req, res) => {
    try {
        const defaultUserId = '00000000-0000-0000-0000-000000000000';
        
        const { data, error } = await supabase
            .from('dpr_reports')
            .select('id, business_name, status, created_at, updated_at')
            .eq('user_id', defaultUserId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, reports: data });
        
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== IMAGE UPLOAD ENDPOINT ==========
app.post('/api/dpr/upload-image', imageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const baseUrl = `http://localhost:${PORT}`;
        const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        
        console.log(`📸 Image saved: ${imageUrl} (${req.body.type || 'unknown'})`);
        
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

// ========== TEMPLATE-BASED NARRATIVE GENERATOR (BACKUP) ==========
function generateTemplateNarrative(data) {
    console.log('📝 Using RICH DETAILED backup narrative generator...');
    
    const businessName = data.business_name || 'the enterprise';
    const product = data.primary_product || 'products and services';
    const location = (data.village || '') + ' ' + (data.district || '') + ' ' + (data.state || '').trim() || 'the region';
    const capacity = Number(data.daily_capacity) || 0;
    const price = Number(data.selling_price) || 0;
    const entityType = data.entity_type || 'business entity';
    const contactPerson = data.contact_name || 'the management team';
    
    const mgmtCount = Number(data.mgmt_count) || 0;
    const supCount = Number(data.sup_count) || 0;
    const skillCount = Number(data.skill_count) || 0;
    const unskillCount = Number(data.unskill_count) || 0;
    const adminCount = Number(data.admin_count) || 0;
    const totalStaff = mgmtCount + supCount + skillCount + unskillCount + adminCount;
    
    const landCost = Number(data.land_cost) || 0;
    const buildingCost = Number(data.building_cost) || 0;
    const machineryCost = Number(data.machinery_total) || 0;
    const totalCost = landCost + buildingCost + machineryCost;
    const promoterShare = Number(data.promoter_contribution) || 0;
    const promoterPercent = totalCost > 0 ? ((promoterShare / totalCost) * 100).toFixed(1) : 'adequate';
    
    const usp = data.usp || 'quality, reliability, and customer-centric approach';
    const targetCustomers = data.target_customers || 'retail consumers, institutional buyers, and commercial establishments';
    const competitors = data.competitors || 'established players and emerging enterprises in the sector';
    
    const executiveSummary = `
        <p><strong>Executive Summary</strong></p>
        <p>${businessName} is pleased to present this Detailed Project Report for a proposed business venture in the ${product} sector, to be established at ${location}. This initiative represents a significant strategic opportunity to capitalize on growing market demand while creating sustainable economic value for all stakeholders. The enterprise aims to establish a strong market presence by delivering superior quality products and exceptional customer service, setting new benchmarks in the industry.</p>
        
        <p>The business will operate with a robust production framework, featuring ${capacity > 0 ? 'a daily manufacturing capacity of ' + capacity.toLocaleString() + ' units' : 'industry-standard production capabilities'} and competitive pricing${price > 0 ? ' at ₹' + price.toLocaleString() + ' per unit' : ''}. The operational strategy is designed to achieve optimal efficiency while maintaining the highest quality standards. The management team brings together decades of collective experience across production, quality control, marketing, and financial management, ensuring comprehensive oversight and strategic direction.</p>
        
        <p>The proposed venture has been structured as a ${entityType}, reflecting a commitment to professional governance and regulatory compliance. The business location at ${location} has been strategically selected to optimize access to raw materials, transportation networks, and target markets, providing a significant competitive advantage. The management team, led by ${contactPerson}, possesses relevant industry expertise and operational capabilities to successfully execute the business plan and navigate market challenges.</p>
        
        <p>From a financial perspective, the project demonstrates strong commercial viability with a well-structured capital framework. The total project investment reflects prudent allocation across land, building, machinery, and working capital requirements. The promoter contribution of ${promoterPercent}% demonstrates stakeholder confidence and commitment to the venture's success. The project is expected to generate meaningful direct and indirect employment opportunities for approximately ${totalStaff > 0 ? totalStaff : 'numerous'} persons in the local community, contributing significantly to regional economic development while maintaining robust governance, compliance, and ethical business practices.</p>
    `;
    
    const businessOverview = `
        <p><strong>Business Overview</strong></p>
        <p>${businessName} has been established as a ${entityType} with a clear and compelling vision to achieve excellence in the ${product} sector. The organization is fundamentally committed to delivering exceptional value to customers through superior quality products, efficient service delivery, and continuous improvement across all operational aspects. All necessary statutory registrations, licenses, and compliances have been obtained or are in the process of being secured, ensuring full legal and regulatory adherence.</p>
        
        <p>The strategic location at ${location} offers distinct and substantial advantages that contribute to the enterprise's competitive positioning. These include excellent proximity to target customer segments, robust infrastructure availability, access to skilled workforce pools, and favorable logistics connectivity. The management team brings diverse and complementary expertise spanning operations management, financial planning, marketing strategy, and human resource development, ensuring balanced decision-making and effective risk mitigation across all business functions.</p>
        
        <p>The organization's mission focuses on sustainable long-term growth, exceptional customer satisfaction, and meaningful stakeholder value creation. Core business activities comprehensively encompass procurement, production, distribution, and customer relationship management, all supported by robust systems, standardized processes, and continuous improvement methodologies. The enterprise is committed to maintaining the highest ethical standards, environmental responsibility, and social consciousness in all its operations.</p>
        
        <p>The business has identified clear growth trajectories and expansion opportunities in both domestic and international markets. With a strong foundation, committed management, and robust operational framework, ${businessName} is well-positioned to achieve its strategic objectives and emerge as a respected player in the ${product} industry, delivering sustainable value to customers, employees, investors, and the broader community.</p>
    `;
    
    const productTechnology = `
        <p><strong>Product & Technology</strong></p>
        <p>${businessName} will offer a comprehensive range of ${product} designed meticulously to meet and exceed customer requirements and expectations. The product portfolio has been developed based on extensive market research, customer feedback analysis, and competitive benchmarking, ensuring strong market relevance and appeal to the target audience. Quality is prioritized as a non-negotiable parameter at every stage of the production lifecycle, from raw material procurement to final dispatch.</p>
        
        <p>The production process utilizes appropriate, modern technology and well-maintained equipment to ensure operational consistency, production efficiency, and quality uniformity. Comprehensive quality control measures are implemented at each critical stage, including incoming raw material inspection, in-process quality checks, and finished goods testing before dispatch. The facility maintains rigorous standards for workplace safety, industrial hygiene, and operational excellence, complying with all applicable regulatory requirements and industry best practices.</p>
        
        <p>The unique selling proposition centers on ${usp}. This powerful differentiation strategy enables the business to build strong customer loyalty, command premium positioning, and develop sustainable competitive advantage in the marketplace. The enterprise continuously invests in process improvement, technology upgrades, and capability enhancement to maintain and strengthen its competitive edge.</p>
        
        <p>${capacity > 0 ? 'With a robust daily production capacity of ' + capacity.toLocaleString() + ' units, the facility is well-equipped to meet growing market demand and scale operations as business expands.' : 'The facility is designed with scalable capacity to accommodate growing market demand and business expansion.'} The production capability, combined with efficient supply chain management and responsive customer service, positions ${businessName} as a reliable and preferred supplier in the ${product} market.</p>
    `;
    
    const marketAnalysis = `
        <p><strong>Market Analysis</strong></p>
        <p>The market for ${product} demonstrates consistently positive growth trajectory, driven by evolving consumer preferences, increasing disposable incomes, economic development, and changing lifestyle patterns. Market research indicates sustained demand growth over the planning horizon, supported by favorable demographic trends and increasing product awareness. The target customer base encompasses ${targetCustomers}, representing a diverse and substantial market opportunity.</p>
        
        <p>The competitive landscape includes ${competitors}. The differentiation strategy focuses on ${usp}, enabling the business to capture meaningful market share while building and maintaining strong customer loyalty. Distribution channels have been strategically designed to include direct sales, retail partnerships, e-commerce platforms, and strategic alliances, ensuring comprehensive market coverage and customer accessibility.</p>
        
        <p>Comprehensive market growth projections indicate sustained demand growth, strongly supporting the enterprise's expansion plans over the five-year planning horizon. The business has developed responsive strategies to adapt to changing market conditions, emerging customer preferences, and competitive dynamics. Market intelligence systems have been established to continuously monitor trends, competitor activities, and customer feedback, enabling timely strategic adjustments.</p>
        
        <p>The enterprise is well-positioned to capitalize on identified market opportunities, including geographic expansion, product line extensions, strategic partnerships, and channel diversification. With a clear market focus, differentiated positioning, and customer-centric approach, ${businessName} is poised to achieve its market share objectives and build a strong, recognized brand in the ${product} category.</p>
    `;
    
    const swotAnalysis = `
        <p><strong>STRENGTHS:</strong> ${businessName} possesses several key strengths that provide competitive advantage. The enterprise benefits from an experienced management team with deep industry expertise and proven track record. Strategic location provides operational advantages including proximity to resources and markets. A quality-focused approach ensures consistent customer satisfaction and brand reputation. Strong vendor relationships and an optimized supply chain network ensure reliable raw material availability and cost efficiency. Additionally, the organization has established robust systems, processes, and quality controls that enhance operational reliability and product consistency.</p>
        
        <p><strong>WEAKNESSES:</strong> The enterprise faces certain challenges that require focused attention and mitigation. Initial brand building requirements in a competitive market necessitate strategic marketing investments. Working capital needs during the growth phase require careful financial planning and management. Dependency on key personnel during the establishment period requires succession planning and talent development. Market entry as a relatively new player may require additional efforts for customer acquisition and trust building. These weaknesses are recognized and being addressed through targeted initiatives and continuous improvement efforts.</p>
        
        <p><strong>OPPORTUNITIES:</strong> The business environment presents numerous opportunities for growth and expansion. Growing market demand creates significant potential for capacity expansion and market share increase. Technology adoption offers substantial opportunities for operational efficiency improvements and cost optimization. Strategic partnerships with complementary businesses can accelerate market reach and customer acquisition. Geographic expansion into new regions and export markets offers significant growth potential. Product line extensions and diversification into adjacent categories provide additional revenue streams.</p>
        
        <p><strong>THREATS:</strong> The business environment also presents certain threats that require vigilant monitoring and proactive management. Competition intensity requires continuous differentiation and innovation efforts. Economic fluctuations may affect consumer spending patterns and demand stability. Regulatory changes require continuous compliance adaptation and monitoring. Raw material price volatility necessitates effective procurement strategies and inventory management. These threats are being actively monitored with appropriate mitigation strategies being developed and implemented as needed.</p>
        
        <p><strong>STRATEGIC RECOMMENDATIONS:</strong> Based on comprehensive analysis, the following strategic recommendations are proposed. Focus on aggressive brand building through targeted marketing initiatives, digital presence enhancement, and customer engagement programs. Invest significantly in customer relationship management systems to enhance customer retention and lifetime value. Maintain rigorous quality consistency across all products through continuous improvement programs. Develop strategic supplier partnerships for cost optimization, supply reliability, and risk mitigation. Continuously monitor market trends for timely adaptation, innovation, and opportunity capture. Implement robust risk management frameworks to identify, assess, and mitigate emerging threats proactively. These recommendations provide a clear roadmap for sustainable growth and competitive advantage.</p>
    `;
    
    const socialImpact = `
        <p><strong>Social & Environmental Impact</strong></p>
        <p>${businessName} is deeply committed to generating meaningful positive social impact through its operations and community engagement. The project will generate substantial direct and indirect employment opportunities in the local community, contributing significantly to regional economic development, livelihood enhancement, and poverty alleviation. ${data.women_employment ? 'The initiative specifically and deliberately promotes women\'s employment with dedicated positions for ' + data.women_employment + ' women, supporting gender diversity and women\'s economic empowerment.' : 'The initiative promotes inclusive hiring practices with special focus on gender diversity and equal opportunity.'} ${data.youth_employment ? 'Youth employment is prioritized with ' + data.youth_employment + ' positions designated for young professionals, supporting skill development and career building.' : 'Youth employment is prioritized through dedicated positions for young professionals, supporting their career development.'}</p>
        
        <p>${data.eco_friendly === 'Yes' ? 'Environmental sustainability is integral to the organization\'s operational philosophy, with comprehensive eco-friendly practices implemented across the entire value chain. These include energy-efficient technologies, waste reduction programs, water conservation measures, and responsible sourcing practices. The enterprise is committed to minimizing its environmental footprint and promoting sustainable business practices.' : 'The enterprise is committed to environmentally responsible operations, continuously exploring opportunities to reduce environmental impact and promote sustainability.'} ${data.training === 'Yes' ? 'Comprehensive training programs have been established to enhance employee skills, support career progression, and build organizational capabilities. These programs cover technical skills, soft skills, safety practices, and leadership development.' : 'The organization is committed to employee development through training programs that enhance skills and support career growth.'}</p>
        
        <p>The enterprise actively contributes to local economic development through strategic vendor engagement, meaningful tax contributions, and supportive community initiatives. The organization believes in creating shared value for all stakeholders, including employees, customers, suppliers, community members, and shareholders. Corporate social responsibility initiatives are being developed to address local community needs, support education and healthcare, and promote sustainable development. The enterprise is committed to operating as a responsible corporate citizen, contributing positively to society while achieving business objectives.</p>
    `;
    
    const riskAssessment = `
        <p><strong>Risk Assessment & Mitigation</strong></p>
        <p><strong>Market Risks:</strong> The enterprise faces market risks including demand fluctuations, competitive intensity, and pricing pressures. These risks are being addressed through comprehensive customer diversification strategies, relentless quality focus, responsive marketing initiatives, and continuous innovation. Regular market monitoring systems have been established to enable timely strategy adjustments, early warning detection, and proactive risk mitigation. The organization maintains flexible operational capabilities to adapt quickly to changing market conditions and customer preferences.</p>
        
        <p><strong>Operational Risks:</strong> Operational risks include potential supply chain disruptions, quality issues, equipment breakdowns, and workforce challenges. These are being mitigated through strategic vendor diversification, robust inventory management systems, comprehensive quality control frameworks, and preventive maintenance programs. Business continuity plans have been developed to address potential disruptions, with alternative suppliers identified and contingency arrangements established. Regular operational audits and process reviews ensure continuous improvement and risk reduction.</p>
        
        <p><strong>Financial Risks:</strong> Financial risks encompass cash flow management, interest rate fluctuations, credit risks, and financial market volatility. These are being managed through prudent working capital planning, rigorous cost control measures, and adequate contingency reserves. Regular financial reviews and performance monitoring enable proactive issue identification and timely resolution. The organization maintains strong banking relationships and access to multiple funding sources to ensure financial flexibility and stability.</p>
        
        <p><strong>Regulatory Risks:</strong> Regulatory and compliance risks include changes in applicable laws, licensing requirements, tax regulations, and industry standards. Compliance is ensured through regular legal reviews, periodic compliance audits, and professional advisory support. Comprehensive documentation and reporting systems maintain transparency and accountability. The organization has designated compliance responsibility and established systems to track regulatory changes and ensure timely adaptation.</p>
        
        <p><strong>Risk Management Framework:</strong> The enterprise has established a comprehensive risk management framework that includes risk identification, assessment, mitigation, monitoring, and reporting. Regular risk reviews are conducted by management, with appropriate mitigation strategies developed and implemented. The organization maintains risk registers, conducts periodic risk assessments, and continuously improves risk management capabilities. This framework ensures proactive risk management rather than reactive response, supporting business resilience and sustainable growth.</p>
    `;
    
    const financialNarrative = `
        <p><strong>Financial Analysis</strong></p>
        <p>The total project cost has been carefully and comprehensively estimated based on current market rates, supplier quotations, and realistic operational requirements. Major cost components include land acquisition, building construction, machinery procurement, furniture and fixtures, working capital requirements, and preliminary expenses. Each component has been evaluated for reasonableness and appropriateness for the scale of operations and market opportunity being pursued. The investment level is considered appropriate and justified given the projected returns and market potential.</p>
        
        <p>The capital structure has been thoughtfully designed with an optimal mix of promoter contribution and debt financing. The promoter contribution of ${promoterPercent}% demonstrates strong stakeholder commitment, confidence in the venture's success, and reduces overall leverage. This healthy equity base supports creditworthiness, enhances financial stability, and provides adequate cushion for operational contingencies. The debt-equity mix has been calibrated to optimize the cost of capital while maintaining sufficient liquidity and financial flexibility.</p>
        
        <p>Financial projections indicate consistently profitable operations with improving margins over the five-year planning horizon. Revenue projections are based on realistic capacity utilization assumptions and market demand estimates. Cost structures reflect efficient operations and economies of scale as production volumes increase. Break-even is expected within a reasonable timeframe of 24 to 36 months from commencement, reflecting efficient cost management and strong revenue growth potential.</p>
        
        <p>Key financial ratios suggest sound financial health with adequate liquidity, reasonable leverage, and strong coverage metrics. The business is projected to generate sufficient cash flows to meet all financial obligations, including debt service, while funding growth initiatives and maintaining adequate reserves. Return on investment metrics exceed industry benchmarks, indicating strong value creation potential. Sensitivity analysis confirms financial viability under various scenarios, demonstrating resilience to market fluctuations and operational challenges. This robust financial profile strongly supports loan consideration and stakeholder confidence in the venture's success.</p>
    `;
    
    const declaration = `
        <p><strong>Declaration</strong></p>
        <p>I, the undersigned, hereby solemnly declare and confirm that all information provided in this Detailed Project Report is true, accurate, and complete to the best of my knowledge and belief. The business is fully compliant with all applicable laws, regulations, and statutory requirements. No material information has been concealed, misrepresented, or omitted from this report.</p>
        
        <p>The financial projections presented herein are based on realistic assumptions that reflect current market conditions, operational capabilities, and reasonable growth expectations. These projections have been prepared in good faith and represent the best estimates of future performance based on available information. There are no pending litigations, legal proceedings, or regulatory actions that would adversely affect the project viability or the organization's ability to conduct business as planned.</p>
        
        <p>All funds requested through this proposal will be utilized solely for the stated purpose as per the terms, conditions, and covenants of any sanction granted. The enterprise commits to full compliance with all statutory requirements, reporting obligations, and governance standards throughout the project lifecycle. The organization further commits to transparent communication with all stakeholders and timely disclosure of any material changes or developments affecting the project or business.</p>
        
        <p>I understand that this declaration forms the basis for consideration of this proposal and affirm that any willful misrepresentation or suppression of facts may result in appropriate legal action and disqualification from consideration. I am authorized by the organization to make this declaration on its behalf and bind the organization to the statements made herein.</p>
    `;
    
    return {
        executiveSummary: executiveSummary,
        businessOverview: businessOverview,
        productTechnology: productTechnology,
        marketAnalysis: marketAnalysis,
        swotAnalysis: swotAnalysis,
        socialImpact: socialImpact,
        riskAssessment: riskAssessment,
        financialNarrative: financialNarrative,
        declaration: declaration
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
        
        const logoUrl = uploadedImages.logo || '';
        const productImageUrl = uploadedImages.product || '';
        const facilityImageUrl = uploadedImages.facility || '';
        const teamImageUrl = uploadedImages.team || '';

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
                membersRows += `<td>${m.name || 'N/A'}</td><td>${m.role || 'N/A'}</td><td>${m.age || 'N/A'}</td><td>${m.qualification || 'N/A'}</td><td>${m.experience || 'N/A'}</td><td>Operations</td></tr>`;
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
            machineryRows = `<tr><td colspan="5">No machinery data provided</td></tr>`;
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
            '{{bep_months}}': '24',
            
            '{{land_area}}': data.land_area || 'Not provided',
            '{{builtup_area}}': data.builtup_area || 'Not provided',
            '{{production_hall_area}}': '15000',
            '{{warehouse_area}}': '10000',
            '{{lab_area}}': '2000',
            '{{admin_area}}': '5000',
            '{{power_required}}': data.power_required || 'Not provided',
            '{{water_required}}': data.water_required || 'Not provided',
            '{{internet_speed}}': '100',
            '{{banking_years}}': '4',
            '{{bank_name}}': data.bank_name || 'State Bank of India',
            '{{cibil_score}}': data.cibil_score || 'Not provided',
            '{{default_history}}': data.default_history || 'None',
            '{{bank_loan_formatted}}': bankLoan.toLocaleString()
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
    console.log(`💾 Supabase connected: ${supabaseUrl ? 'YES' : 'NO'}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/dpr/health`);
});