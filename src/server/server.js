"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = 3000;
const agent = new https_1.default.Agent({ rejectUnauthorized: false });
if (process.env.ENVIRONMENT == 'dev') {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../../dist')));
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../../dist/index.html'));
    });
}
app.use((0, cors_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, '../')));
app.use('/api', async (req, res) => {
    const url = `https://sc2pulse.nephest.com/sc2/api${req.url}`;
    console.log(url);
    try {
        const response = await (0, axios_1.default)({
            url: url,
            httpsAgent: agent,
            data: req.body,
        });
        // console.log(response.data)
        res.json(response.data);
    }
    catch (error) {
        const axiosError = error;
        console.log(axiosError.message);
        res.status(axiosError.response?.status || 500).send(axiosError.message);
    }
});
// Handle SPA routing
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../index.html'));
});
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error(err.message);
    res.status(500).send('Internal Server Error');
});
// Start the server and log the port number
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
