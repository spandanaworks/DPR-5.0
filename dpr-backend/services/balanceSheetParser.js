const XLSX = require('xlsx');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class BalanceSheetParser {
    
    async parseExcel(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Extract numbers from Excel data
            return this.extractNumbersFromArray(data);
        } catch (error) {
            console.error('Excel parsing error:', error);
            throw new Error('Failed to parse Excel file');
        } finally {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
        }
    }
    
    async parsePDF(filePath) {
        try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            const pdfText = pdfData.text;
            
            // Use Gemini AI to extract numbers from PDF text
            return await this.extractWithGemini(pdfText);
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('Failed to parse PDF file');
        } finally {
            fs.unlinkSync(filePath);
        }
    }
    
    async parseCSV(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            return this.extractNumbersFromArray(data);
        } catch (error) {
            console.error('CSV parsing error:', error);
            throw new Error('Failed to parse CSV file');
        } finally {
            fs.unlinkSync(filePath);
        }
    }
    
    async extractWithGemini(text) {
        const prompt = `
        Extract the following financial numbers from this balance sheet text.
        Return ONLY a JSON object with these fields (use 0 if not found):
        - cash_in_hand
        - bank_balance
        - inventory_value
        - receivables
        - short_term_loan
        - creditors
        - long_term_loan
        - owner_capital
        - retained_earnings
        
        Balance sheet text:
        ${text.substring(0, 8000)} // Limit text length
        `;
        
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent(prompt);
            const response = result.response.text();
            
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Could not parse Gemini response');
        } catch (error) {
            console.error('Gemini extraction error:', error);
            throw new Error('AI extraction failed');
        }
    }
    
    extractNumbersFromArray(data) {
        // Convert 2D array to text and use Gemini
        const text = data.map(row => row.join(' ')).join('\n');
        return this.extractWithGemini(text);
    }
}

module.exports = new BalanceSheetParser();