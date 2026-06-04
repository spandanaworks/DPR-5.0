const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json());

app.post('/api/dpr/generate-full-report', (req, res) => {
    console.log('Request received!');
    res.json({ message: 'Test successful' });
});

app.listen(PORT, () => console.log(`Test server on port ${PORT}`));