import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { DatabaseService } from './database';
import { WebSocketService } from './websocket';
import QRCode from 'qrcode';

export class BaileysService {
    private sock: any;
    private dbService: DatabaseService;
    private wsService: WebSocketService;
    private qrCode: string = '';
    private connectionState: string = 'disconnected';
    private isConnecting: boolean = false;

    constructor(wsService: WebSocketService) {
        this.dbService = new DatabaseService();
        this.wsService = wsService;
        this.initializeConnection();
    }

    private async initializeConnection() {
        if (this.isConnecting) {
            console.log('Already connecting, skipping...');
            return;
        }

        this.isConnecting = true;
        console.log('Initializing WhatsApp connection...');

        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            
            this.sock = makeWASocket({
                auth: state,
                // Remove printQRInTerminal as it's deprecated
            });

            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                
                console.log('Connection update:', { 
                    connection, 
                    qr: !!qr, 
                    lastDisconnect: !!lastDisconnect,
                    isConnected: connection === 'open',
                    user: this.sock?.user
                });
                
                if (qr) {
                    console.log('QR code received, generating data URL...');
                    try {
                        this.qrCode = await QRCode.toDataURL(qr);
                        this.connectionState = 'qr_generated';
                        
                        console.log('QR Code generated successfully');
                        
                        // Send QR code to WebSocket clients
                        this.wsService.broadcastMessage('qr_code', {
                            qrCode: this.qrCode,
                            message: 'Scan this QR code with your WhatsApp'
                        });
                        
                        console.log('QR Code sent to WebSocket clients');
                    } catch (error) {
                        console.error('Error generating QR code:', error);
                    }
                }
                
                if (connection === 'close') {
                    this.isConnecting = false;
                    this.connectionState = 'disconnected';
                    this.qrCode = '';
                    
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    console.log('Connection closed. Status code:', statusCode, 'Should reconnect:', shouldReconnect);
                    
                    // Broadcast connection status
                    this.wsService.broadcastMessage('connection_status', {
                        status: 'disconnected',
                        message: 'WhatsApp disconnected'
                    });
                    
                    if (shouldReconnect) {
                        console.log('Attempting to reconnect in 5 seconds...');
                        setTimeout(() => {
                            this.initializeConnection();
                        }, 5000);
                    } else {
                        console.log('Logged out, not reconnecting automatically');
                    }
                } else if (connection === 'open') {
                    this.isConnecting = false;
                    this.connectionState = 'connected';
                    this.qrCode = '';
                    
                    console.log('WhatsApp connection opened successfully');
                    console.log('Connected user info:', {
                        id: this.sock.user?.id,
                        name: this.sock.user?.name,
                        jid: this.sock.user?.jid
                    });
                    
                    // Broadcast connection status
                    this.wsService.broadcastMessage('connection_status', {
                        status: 'connected',
                        message: 'WhatsApp connected successfully'
                    });
                } else if (connection === 'connecting') {
                    this.connectionState = 'connecting';
                    
                    console.log('Connecting to WhatsApp...');
                    this.wsService.broadcastMessage('connection_status', {
                        status: 'connecting',
                        message: 'Connecting to WhatsApp...'
                    });
                }
            });

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));

        } catch (error) {
            console.error('Error initializing connection:', error);
            this.isConnecting = false;
            this.connectionState = 'error';
            
            // Retry after error
            setTimeout(() => {
                this.initializeConnection();
            }, 10000);
        }
    }

    private async handleIncomingMessages(m: any) {
        const messages = m.messages;
        
        for (const message of messages) {
            if (!message.key.fromMe && message.message) {
                const messageData = {
                    sender: message.key.remoteJid || '',
                    recipient: 'me',
                    content: this.extractMessageContent(message),
                    timestamp: new Date(message.messageTimestamp! * 1000),
                    status: 'received'
                };

                // Save to database
                await this.dbService.saveMessage(messageData);
                
                // Send to WebSocket clients for real-time display
                this.wsService.broadcastMessage('incoming_message', messageData);
            }
        }
    }

    private extractMessageContent(message: WAMessage): string {
        if (message.message?.conversation) {
            return message.message.conversation;
        } else if (message.message?.extendedTextMessage) {
            return message.message.extendedTextMessage.text || '';
        }
        return 'Media message';
    }

    public async sendMessage(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
        try {
            console.log('BaileysService.sendMessage called:', { 
                to, 
                messageLength: message?.length,
                connectionState: this.connectionState,
                sockExists: !!this.sock
            });
            
            if (this.connectionState !== 'connected') {
                const error = `WhatsApp is not connected. Current state: ${this.connectionState}`;
                console.log(error);
                throw new Error(error);
            }

            if (!this.sock) {
                const error = 'WhatsApp socket is not initialized';
                console.log(error);
                throw new Error(error);
            }

            // Format phone number correctly
            let jid = to;
            if (!to.includes('@')) {
                // Remove + from phone number for JID
                const phoneNumber = to.startsWith('+') ? to.substring(1) : to;
                jid = `${phoneNumber}@s.whatsapp.net`;
            }
            
            console.log('Original phone:', to);
            console.log('Formatted JID:', jid);
            
            // Check if WhatsApp socket is ready
            console.log('Socket state:', {
                readyState: this.sock.ws?.readyState,
                user: this.sock.user,
                authState: this.sock.authState?.creds?.me
            });
            
            console.log('Attempting to send message...');
            const sendResult = await this.sock.sendMessage(jid, { text: message });
            console.log('Message sent successfully:', {
                messageId: sendResult?.key?.id,
                status: sendResult?.status,
                timestamp: sendResult?.messageTimestamp
            });
            
            // Save message to database
            const messageData = {
                sender: 'me',
                recipient: to,
                content: message,
                timestamp: new Date(),
                status: 'sent'
            };
            
            console.log('Saving message to database...');
            const messageId = await this.dbService.saveMessage(messageData);
            console.log('Message saved with ID:', messageId);
            
            // Save transaction
            console.log('Saving transaction...');
            await this.dbService.saveTransaction({
                messageId,
                status: 'sent',
                timestamp: new Date()
            });
            console.log('Transaction saved');

            return { success: true, messageId };
        } catch (error: any) {
            console.error('Error in BaileysService.sendMessage:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack?.split('\n').slice(0, 5).join('\n')
            });
            
            // Check if it's a specific WhatsApp error
            if (error.output?.statusCode) {
                console.log('WhatsApp specific error code:', error.output.statusCode);
            }
            
            try {
                // Save failed transaction
                const messageData = {
                    sender: 'me',
                    recipient: to,
                    content: message,
                    timestamp: new Date(),
                    status: 'failed'
                };
                
                const messageId = await this.dbService.saveMessage(messageData);
                await this.dbService.saveTransaction({
                    messageId,
                    status: 'failed',
                    timestamp: new Date(),
                    errorMessage: error.message
                });
                
                console.log('Failed message saved with ID:', messageId);
            } catch (dbError) {
                console.error('Error saving failed message to database:', dbError);
            }
            
            return { success: false, error: error.message };
        }
    }

    public async sendBulkMessages(recipients: string[], message: string, interval: number): Promise<string> {
        const bulkId = await this.dbService.saveBulkMessage(recipients, message, interval);
        
        // Process bulk messages with interval in background
        this.processBulkMessages(recipients, message, interval, bulkId);
        
        return bulkId;
    }

    private async processBulkMessages(recipients: string[], message: string, interval: number, bulkId: string) {
        for (let i = 0; i < recipients.length; i++) {
            try {
                const result = await this.sendMessage(recipients[i], message);
                console.log(`Sent message ${i + 1}/${recipients.length} to ${recipients[i]} - Success: ${result.success}`);
                
                // Broadcast bulk progress
                this.wsService.broadcastMessage('bulk_progress', {
                    bulkId,
                    current: i + 1,
                    total: recipients.length,
                    recipient: recipients[i],
                    success: result.success
                });
                
                // Wait for interval before sending next message (except for the last one)
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, interval));
                }
            } catch (error) {
                console.error(`Failed to send message to ${recipients[i]}:`, error);
            }
        }
    }

    public async retryFailedMessage(transactionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.dbService.retryTransaction(transactionId);
            await this.dbService.updateTransactionStatus(transactionId, 'sent');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    public async getMessageLogs() {
        try {
            console.log('BaileysService: Getting message logs...');
            const messages = await this.dbService.getAllMessages();
            console.log('BaileysService: Retrieved', messages?.length || 0, 'messages');
            return messages || [];
        } catch (error) {
            console.error('BaileysService: Error getting message logs:', error);
            return [];
        }
    }

    public getQRCode(): string {
        return this.qrCode;
    }

    public getConnectionState(): string {
        return this.connectionState;
    }

    public async reconnect(): Promise<void> {
        console.log('Manual reconnect requested');
        
        if (this.isConnecting) {
            console.log('Already connecting, please wait...');
            return;
        }

        try {
            if (this.sock) {
                console.log('Closing existing connection...');
                this.sock.end(new Error('Manual reconnect'));
                this.sock = null;
            }
        } catch (error) {
            console.log('Error closing existing connection:', error);
        }

        this.connectionState = 'disconnected';
        this.qrCode = '';
        this.isConnecting = false;

        // Wait a bit before reconnecting
        setTimeout(() => {
            this.initializeConnection();
        }, 1000);
    }
}