import WhatsAppController from './whatsapp';

export { WhatsAppController };

export class IndexController {
    public getDashboard(req, res) {
        res.send("Welcome to the WhatsApp Dashboard");
    }
}