import { Router } from 'express';
import WhatsAppController from '../controllers/whatsapp';
import { BaileysService } from '../services/baileys';

const router = Router();

export function setApiRoutes(app: any, baileysService: BaileysService) {
    const whatsappController = new WhatsAppController(baileysService);

    // Connection routes
    router.get('/qr-code', whatsappController.getQRCode);
    router.get('/connection-status', whatsappController.getConnectionStatus);
    router.post('/reconnect', whatsappController.reconnect);
    
    // Message routes
    router.post('/send-message', whatsappController.sendMessage);
    router.post('/send-bulk-messages', whatsappController.sendBulkMessages);
    router.get('/message-logs', whatsappController.getMessageLogs);
    router.get('/failed-transactions', whatsappController.getFailedTransactions);
    router.post('/retry-message', whatsappController.retryMessage);

    app.use('/api', router);
}