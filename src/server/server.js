"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const port = 3000;
if (process.env.ENVIRONMENT == 'dev') {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../../dist')));
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../../dist/index.html'));
    });
}
app.use(express_1.default.static(path_1.default.join(__dirname, '../')));
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
