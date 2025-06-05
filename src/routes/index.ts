import { Express } from 'express';
import path from 'path';

export function setRoutes(app: Express) {
    // Serve dashboard/frontend
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
}