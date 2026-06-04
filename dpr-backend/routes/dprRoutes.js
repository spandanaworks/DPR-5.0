const express = require('express');
const router = express.Router();
const dprController = require('../controllers/dprController');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `balance_sheet_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls', '.pdf', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload Excel, PDF, or CSV.'));
        }
    }
});

// Routes
router.post('/generate-report', dprController.generateReport);
router.post('/calculate-preview', dprController.calculatePreview);
router.post('/upload-balance-sheet', upload.single('balanceSheet'), dprController.uploadBalanceSheet);
router.get('/health', dprController.healthCheck);

module.exports = router;