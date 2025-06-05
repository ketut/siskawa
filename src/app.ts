import express from 'express';
import path from 'path';
import { WebSocketService } from './services/websocket';
import { BaileysService } from './services/baileys';
import { WhatsAppController } from './controllers/whatsapp';

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Add error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Initialize services
const wsService = new WebSocketService(WS_PORT);
const baileysService = new BaileysService(wsService);
const whatsappController = new WhatsAppController(baileysService);

// Routes with error handling wrapper
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// API Routes
app.get('/api/qr-code', asyncHandler(whatsappController.getQRCode));
app.post('/api/reconnect', asyncHandler(whatsappController.reconnect));
app.get('/api/connection-status', asyncHandler(whatsappController.getConnectionStatus));
app.post('/api/send-message', asyncHandler(whatsappController.sendMessage));
app.post('/api/send-bulk-messages', asyncHandler(whatsappController.sendBulkMessages));
app.get('/api/message-logs', asyncHandler(whatsappController.getMessageLogs));
app.get('/api/failed-transactions', asyncHandler(whatsappController.getFailedTransactions));
app.post('/api/retry-message', asyncHandler(whatsappController.retryMessage));

// NEW: Contact management routes
app.post('/api/import-contacts', asyncHandler(whatsappController.importContacts));
app.get('/api/contacts', asyncHandler(whatsappController.getContacts));
app.delete('/api/contacts/:id', asyncHandler(whatsappController.deleteContact));
app.get('/api/contact-groups', asyncHandler(whatsappController.getContactGroups));
app.post('/api/contact-groups', asyncHandler(whatsappController.createContactGroup));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on port ${WS_PORT}`);
});

export default app;