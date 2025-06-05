import { Request, Response } from 'express';
import { BaileysService } from '../services/baileys';
import { DatabaseService } from '../services/database';
import { isValidPhoneNumber, validatePhoneNumbers } from '../utils/helpers';
import { ContactData } from '../services/database';

export class WhatsAppController {
    private baileysService: BaileysService;
    private dbService: DatabaseService;

    constructor(baileysService?: BaileysService) {
        if (baileysService) {
            this.baileysService = baileysService;
        }
        this.dbService = new DatabaseService();
        console.log('WhatsAppController initialized');
    }

    public setBaileysService(baileysService: BaileysService) {
        this.baileysService = baileysService;
    }

    public getQRCode = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/qr-code called');
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const qrCode = this.baileysService.getQRCode();
            const connectionState = this.baileysService.getConnectionState();
            
            console.log('QR Code response:', { qrCode: !!qrCode, connectionState });
            
            res.json({ 
                success: true, 
                qrCode,
                connectionState,
                message: connectionState === 'connected' ? 'WhatsApp is connected' : 
                        connectionState === 'qr_generated' ? 'Scan QR code to connect' :
                        connectionState === 'connecting' ? 'Connecting to WhatsApp...' :
                        connectionState === 'error' ? 'Connection error, retrying...' :
                        'WhatsApp is disconnected'
            });
        } catch (error: any) {
            console.error('Error in getQRCode:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    public reconnect = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/reconnect called');
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            await this.baileysService.reconnect();
            res.json({ success: true, message: 'Reconnection initiated' });
        } catch (error: any) {
            console.error('Error in reconnect:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    public getConnectionStatus = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/connection-status called');
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const connectionState = this.baileysService.getConnectionState();
            res.json({ 
                success: true, 
                status: connectionState,
                message: connectionState === 'connected' ? 'WhatsApp is connected' : 
                        connectionState === 'qr_generated' ? 'QR code generated, waiting for scan' :
                        connectionState === 'connecting' ? 'Connecting to WhatsApp...' :
                        connectionState === 'error' ? 'Connection error' :
                        'WhatsApp is disconnected'
            });
        } catch (error: any) {
            console.error('Error in getConnectionStatus:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    public sendMessage = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/send-message called');
            console.log('Request body:', req.body);
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const { to, message } = req.body;

            // Validate inputs
            if (!to) {
                console.log('Missing recipient');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Recipient (to) is required' 
                });
            }

            if (!message) {
                console.log('Missing message');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Message is required' 
                });
            }

            if (typeof to !== 'string' || typeof message !== 'string') {
                console.log('Invalid data types:', { to: typeof to, message: typeof message });
                return res.status(400).json({ 
                    success: false, 
                    error: 'Recipient and message must be strings' 
                });
            }

            const trimmedTo = to.trim();
            const trimmedMessage = message.trim();

            if (!trimmedTo || !trimmedMessage) {
                console.log('Empty values after trim');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Recipient and message cannot be empty' 
                });
            }

            if (!isValidPhoneNumber(trimmedTo)) {
                console.log('Invalid phone number format:', trimmedTo);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid phone number format. Use international format (+1234567890)' 
                });
            }

            console.log('Sending message:', { to: trimmedTo, messageLength: trimmedMessage.length });

            const result = await this.baileysService.sendMessage(trimmedTo, trimmedMessage);
            
            console.log('Send message result:', result);

            if (result.success) {
                res.json({ 
                    success: true, 
                    message: 'Message sent successfully', 
                    messageId: result.messageId 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    error: result.error || 'Failed to send message' 
                });
            }
        } catch (error: any) {
            console.error('Error in sendMessage:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public sendBulkMessages = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/send-bulk-messages called');
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const { recipients, message, interval = 1000 } = req.body;

            // Validate recipients
            if (!recipients) {
                console.log('No recipients provided');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Recipients are required' 
                });
            }

            if (!Array.isArray(recipients)) {
                console.log('Recipients is not an array:', typeof recipients);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Recipients must be an array' 
                });
            }

            if (recipients.length === 0) {
                console.log('Recipients array is empty');
                return res.status(400).json({ 
                    success: false, 
                    error: 'At least one recipient is required' 
                });
            }

            // Validate message
            if (!message) {
                console.log('No message provided');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Message is required' 
                });
            }

            if (typeof message !== 'string' || message.trim().length === 0) {
                console.log('Invalid message format');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Message must be a non-empty string' 
                });
            }

            // Validate interval
            const intervalMs = parseInt(interval);
            if (isNaN(intervalMs) || intervalMs < 0) {
                console.log('Invalid interval:', interval);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Interval must be a valid number' 
                });
            }

            // Validate phone numbers using helper function
            const { valid: validRecipients, invalid: invalidNumbers } = validatePhoneNumbers(recipients);

            if (invalidNumbers.length > 0) {
                console.log('Invalid phone numbers found:', invalidNumbers);
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid phone numbers (use +countrycode format): ${invalidNumbers.slice(0, 5).join(', ')}${invalidNumbers.length > 5 ? ` and ${invalidNumbers.length - 5} more` : ''}` 
                });
            }

            if (validRecipients.length === 0) {
                console.log('No valid recipients after validation');
                return res.status(400).json({ 
                    success: false, 
                    error: 'No valid recipients found' 
                });
            }

            console.log(`Processing bulk message for ${validRecipients.length} recipients`);

            const bulkId = await this.baileysService.sendBulkMessages(validRecipients, message.trim(), intervalMs);
            
            console.log('Bulk message queued with ID:', bulkId);

            res.json({ 
                success: true, 
                message: `Bulk messages queued successfully for ${validRecipients.length} recipients`,
                bulkId,
                validRecipients: validRecipients.length,
                totalSubmitted: recipients.length
            });
        } catch (error: any) {
            console.error('Error in sendBulkMessages:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public getMessageLogs = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/message-logs called');
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const messages = await this.baileysService.getMessageLogs();
            console.log('Message logs retrieved:', messages?.length || 0, 'messages');
            
            res.json({ 
                success: true, 
                data: messages || [] 
            });
        } catch (error: any) {
            console.error('Error in getMessageLogs:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public getFailedTransactions = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/failed-transactions called');
            
            const failedTransactions = await this.dbService.getFailedTransactions();
            console.log('Failed transactions retrieved:', failedTransactions?.length || 0, 'transactions');
            
            res.json({ 
                success: true, 
                data: failedTransactions || [] 
            });
        } catch (error: any) {
            console.error('Error in getFailedTransactions:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public retryMessage = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/retry-message called');
            console.log('Request body:', req.body);
            
            if (!this.baileysService) {
                throw new Error('BaileysService not initialized');
            }

            const { transactionId } = req.body;

            if (!transactionId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Transaction ID is required' 
                });
            }

            const result = await this.baileysService.retryFailedMessage(transactionId);
            
            if (result.success) {
                res.json({ success: true, message: 'Message retry initiated' });
            } else {
                res.status(500).json({ success: false, error: result.error });
            }
        } catch (error: any) {
            console.error('Error in retryMessage:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public importContacts = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/import-contacts called');
            
            const { contacts, groupName } = req.body;

            if (!contacts || !Array.isArray(contacts)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Contacts array is required' 
                });
            }

            if (contacts.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'At least one contact is required' 
                });
            }

            // Validate and format contacts
            const validContacts: ContactData[] = [];
            const invalidContacts: any[] = [];

            contacts.forEach((contact: any, index: number) => {
                const errors: string[] = [];
                
                if (!contact.name || typeof contact.name !== 'string' || contact.name.trim().length === 0) {
                    errors.push('Name is required');
                }
                
                if (!contact.phone || typeof contact.phone !== 'string' || contact.phone.trim().length === 0) {
                    errors.push('Phone is required');
                } else if (!isValidPhoneNumber(contact.phone.trim())) {
                    errors.push('Invalid phone number format');
                }

                if (errors.length > 0) {
                    invalidContacts.push({
                        index: index + 1,
                        contact,
                        errors
                    });
                } else {
                    validContacts.push({
                        name: contact.name.trim(),
                        phone: contact.phone.trim(),
                        group: groupName || contact.group || null,
                        notes: contact.notes || null
                    });
                }
            });

            if (invalidContacts.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid contacts found',
                    invalidContacts: invalidContacts.slice(0, 10) // Show first 10 errors
                });
            }

            console.log(`Importing ${validContacts.length} contacts`);

            const result = await this.dbService.saveMultipleContacts(validContacts);
            
            console.log('Import result:', result);

            res.json({ 
                success: true, 
                message: `Successfully imported ${result.success} contacts`,
                imported: result.success,
                failed: result.failed.length,
                failedContacts: result.failed
            });
        } catch (error: any) {
            console.error('Error in importContacts:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public getContacts = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/contacts called');
            
            const { group, search } = req.query;
            
            let contacts;
            if (search) {
                contacts = await this.dbService.searchContacts(search as string);
            } else if (group) {
                contacts = await this.dbService.getContactsByGroup(group as string);
            } else {
                contacts = await this.dbService.getAllContacts();
            }
            
            console.log('Contacts retrieved:', contacts?.length || 0);
            
            res.json({ 
                success: true, 
                data: contacts || [] 
            });
        } catch (error: any) {
            console.error('Error in getContacts:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public deleteContact = async (req: Request, res: Response) => {
        try {
            console.log('DELETE /api/contacts/:id called');
            
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Contact ID is required' 
                });
            }

            await this.dbService.deleteContact(id);
            
            res.json({ 
                success: true, 
                message: 'Contact deleted successfully' 
            });
        } catch (error: any) {
            console.error('Error in deleteContact:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public getContactGroups = async (req: Request, res: Response) => {
        try {
            console.log('GET /api/contact-groups called');
            
            const groups = await this.dbService.getAllContactGroups();
            
            res.json({ 
                success: true, 
                data: groups || [] 
            });
        } catch (error: any) {
            console.error('Error in getContactGroups:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public createContactGroup = async (req: Request, res: Response) => {
        try {
            console.log('POST /api/contact-groups called');
            
            const { name, description } = req.body;
            
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Group name is required' 
                });
            }

            const groupId = await this.dbService.saveContactGroup(name.trim(), description?.trim());
            
            res.json({ 
                success: true, 
                message: 'Contact group created successfully',
                groupId
            });
        } catch (error: any) {
            console.error('Error in createContactGroup:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'Internal server error' 
            });
        }
    };

    public handleIncomingMessage(message: any): void {
        console.log("Incoming message:", message);
    }
}

export default WhatsAppController;