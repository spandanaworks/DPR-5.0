const PDFService = require('../services/pdfService');
const CalculationService = require('../services/calculationService');
const BalanceSheetParser = require('../services/balanceSheetParser');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `balance_sheet_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

class DPRController {
    
    // Generate PDF report
    async generateReport(req, res) {
        try {
            const dprData = req.body;
            
            if (!dprData.business_name) {
                return res.status(400).json({ error: 'Business name is required' });
            }
            
            PDFService.generateReport(dprData, res);
            
        } catch (error) {
            console.error('PDF Generation Error:', error);
            res.status(500).json({ error: 'Failed to generate report', details: error.message });
        }
    }
    
    // Calculate preview (no PDF)
    async calculatePreview(req, res) {
        try {
            const dprData = req.body;
            
            const totalCost = CalculationService.calculateTotalProjectCost(dprData);
            const projections = CalculationService.calculateProjections(dprData);
            const balanceSheet = CalculationService.calculateBalanceSheet(dprData);
            const pnl = CalculationService.calculateProfitAndLoss(dprData, projections);
            const ratios = CalculationService.calculateAllRatios(balanceSheet, pnl, projections);
            const staffCosts = CalculationService.calculateStaffCosts(dprData);
            const workingCapital = CalculationService.calculateWorkingCapitalMPBF(balanceSheet, projections);
            const cashFlow = CalculationService.calculateCashFlow(projections, balanceSheet, pnl);
            
            const financeBreakdown = CalculationService.calculateFinanceBreakdown(
                totalCost,
                dprData.promoter_contribution,
                dprData.bank_loan,
                dprData.subsidy
            );
            
            res.json({
                success: true,
                data: {
                    totalProjectCost: totalCost,
                    financeBreakdown,
                    projections,
                    balanceSheet,
                    profitAndLoss: pnl,
                    keyRatios: ratios,
                    staffCosts,
                    workingCapital,
                    cashFlow
                }
            });
            
        } catch (error) {
            console.error('Calculation Error:', error);
            res.status(500).json({ error: 'Failed to calculate', details: error.message });
        }
    }
    
    // Upload and parse balance sheet file
    async uploadBalanceSheet(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            
            const filePath = req.file.path;
            const fileExt = path.extname(req.file.originalname).toLowerCase();
            
            let extractedData;
            
            if (fileExt === '.xlsx' || fileExt === '.xls') {
                extractedData = await BalanceSheetParser.parseExcel(filePath);
            } else if (fileExt === '.pdf') {
                extractedData = await BalanceSheetParser.parsePDF(filePath);
            } else if (fileExt === '.csv') {
                extractedData = await BalanceSheetParser.parseCSV(filePath);
            } else {
                return res.status(400).json({ error: 'Unsupported file format. Use Excel, PDF, or CSV.' });
            }
            
            res.json({
                success: true,
                message: 'Balance sheet parsed successfully',
                data: extractedData
            });
            
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ error: 'Failed to parse balance sheet', details: error.message });
        }
    }
    
    // Health check
    async healthCheck(req, res) {
        res.json({ status: 'OK', message: 'DPR Backend is running', timestamp: new Date().toISOString() });
    }
}

module.exports = new DPRController();