import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

export interface MessageData {
    sender: string;
    recipient: string;
    content: string;
    timestamp: Date;
    status: string;
}

export interface TransactionData {
    messageId: string;
    status: string;
    timestamp: Date;
    errorMessage?: string;
    type?: string; // Add this field
}

export interface ContactData {
    name: string;
    phone: string;
    group?: string;
    notes?: string;
}

export class DatabaseService {
    private db: Database | null = null;

    constructor() {
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        try {
            this.db = await open({
                filename: './whatsapp.db',
                driver: sqlite3.Database
            });

            // Create tables if they don't exist
            await this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    }

    private async createTables() {
        if (!this.db) return;

        // Drop existing tables and recreate with correct schema
        console.log('Creating/updating database tables...');

        // Messages table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender TEXT NOT NULL,
                recipient TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Drop and recreate transactions table with correct schema
        await this.db.exec(`DROP TABLE IF EXISTS transactions`);
        await this.db.exec(`
            CREATE TABLE transactions (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                status TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                type TEXT DEFAULT 'single',
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            )
        `);

        // Drop and recreate bulk_messages table with correct schema
        await this.db.exec(`DROP TABLE IF EXISTS bulk_messages`);
        await this.db.exec(`
            CREATE TABLE bulk_messages (
                id TEXT PRIMARY KEY,
                recipients TEXT NOT NULL,
                message TEXT NOT NULL,
                interval_ms INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // NEW: Contacts table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                group_name TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // NEW: Contact groups table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS contact_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables created successfully');
    }

    async saveMessage(messageData: MessageData): Promise<string> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const messageId = uuidv4();
        
        try {
            await this.db!.run(
                'INSERT INTO messages (id, sender, recipient, content, timestamp, status) VALUES (?, ?, ?, ?, ?, ?)',
                [messageId, messageData.sender, messageData.recipient, messageData.content, messageData.timestamp.toISOString(), messageData.status]
            );
            console.log('Message saved with ID:', messageId);
            return messageId;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    async saveTransaction(transactionData: TransactionData): Promise<string> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const transactionId = uuidv4();
        
        try {
            await this.db!.run(
                'INSERT INTO transactions (id, message_id, status, timestamp, type, error_message) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    transactionId, 
                    transactionData.messageId, 
                    transactionData.status, 
                    transactionData.timestamp.toISOString(), 
                    transactionData.type || 'single',
                    transactionData.errorMessage || null
                ]
            );
            console.log('Transaction saved with ID:', transactionId);
            return transactionId;
        } catch (error) {
            console.error('Error saving transaction:', error);
            throw error;
        }
    }

    async saveBulkMessage(recipients: string[], message: string, interval: number): Promise<string> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const bulkId = uuidv4();
        const now = new Date().toISOString();
        
        try {
            console.log('Saving bulk message:', { bulkId, recipientsCount: recipients.length, interval });
            
            await this.db!.run(
                'INSERT INTO bulk_messages (id, recipients, message, interval_ms, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [bulkId, JSON.stringify(recipients), message, interval, 'pending', now]
            );
            
            console.log('Bulk message saved successfully with ID:', bulkId);
            return bulkId;
        } catch (error) {
            console.error('Error saving bulk message:', error);
            console.error('Database error details:', {
                bulkId,
                recipients: recipients.length,
                message: message.substring(0, 50),
                interval,
                timestamp: now
            });
            throw error;
        }
    }

    async saveContact(contactData: ContactData): Promise<string> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const contactId = uuidv4();
        const now = new Date().toISOString();
        
        try {
            await this.db!.run(
                'INSERT INTO contacts (id, name, phone, group_name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [contactId, contactData.name, contactData.phone, contactData.group || null, contactData.notes || null, now, now]
            );
            console.log('Contact saved with ID:', contactId);
            return contactId;
        } catch (error: any) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Phone number ${contactData.phone} already exists`);
            }
            console.error('Error saving contact:', error);
            throw error;
        }
    }

    async saveMultipleContacts(contacts: ContactData[]): Promise<{ success: number; failed: any[] }> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        let successCount = 0;
        const failedContacts: any[] = [];

        for (const contact of contacts) {
            try {
                await this.saveContact(contact);
                successCount++;
            } catch (error: any) {
                failedContacts.push({
                    contact,
                    error: error.message
                });
            }
        }

        return { success: successCount, failed: failedContacts };
    }

    async getAllMessages(): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const messages = await this.db!.all(
                'SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100'
            );
            return messages || [];
        } catch (error) {
            console.error('Error getting all messages:', error);
            return [];
        }
    }

    async getFailedTransactions(): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const transactions = await this.db!.all(`
                SELECT t.*, m.content, m.recipient 
                FROM transactions t 
                JOIN messages m ON t.message_id = m.id 
                WHERE t.status = 'failed' 
                ORDER BY t.timestamp DESC 
                LIMIT 50
            `);
            return transactions || [];
        } catch (error) {
            console.error('Error getting failed transactions:', error);
            return [];
        }
    }

    async getAllContacts(): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const contacts = await this.db!.all(
                'SELECT * FROM contacts ORDER BY name ASC'
            );
            return contacts || [];
        } catch (error) {
            console.error('Error getting all contacts:', error);
            return [];
        }
    }

    async getContactsByGroup(groupName: string): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const contacts = await this.db!.all(
                'SELECT * FROM contacts WHERE group_name = ? ORDER BY name ASC',
                [groupName]
            );
            return contacts || [];
        } catch (error) {
            console.error('Error getting contacts by group:', error);
            return [];
        }
    }

    async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            await this.db!.run(
                'UPDATE transactions SET status = ? WHERE id = ?',
                [status, transactionId]
            );
        } catch (error) {
            console.error('Error updating transaction status:', error);
            throw error;
        }
    }

    async retryTransaction(transactionId: string): Promise<void> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            await this.db!.run(
                'UPDATE transactions SET retry_count = retry_count + 1 WHERE id = ?',
                [transactionId]
            );
        } catch (error) {
            console.error('Error retrying transaction:', error);
            throw error;
        }
    }

    async deleteContact(contactId: string): Promise<void> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            await this.db!.run('DELETE FROM contacts WHERE id = ?', [contactId]);
            console.log('Contact deleted:', contactId);
        } catch (error) {
            console.error('Error deleting contact:', error);
            throw error;
        }
    }

    async updateContact(contactId: string, contactData: Partial<ContactData>): Promise<void> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const now = new Date().toISOString();
        
        try {
            const fields = [];
            const values = [];
            
            if (contactData.name) {
                fields.push('name = ?');
                values.push(contactData.name);
            }
            if (contactData.phone) {
                fields.push('phone = ?');
                values.push(contactData.phone);
            }
            if (contactData.group !== undefined) {
                fields.push('group_name = ?');
                values.push(contactData.group);
            }
            if (contactData.notes !== undefined) {
                fields.push('notes = ?');
                values.push(contactData.notes);
            }
            
            fields.push('updated_at = ?');
            values.push(now);
            values.push(contactId);
            
            await this.db!.run(
                `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
            console.log('Contact updated:', contactId);
        } catch (error) {
            console.error('Error updating contact:', error);
            throw error;
        }
    }

    async searchContacts(query: string): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const contacts = await this.db!.all(
                'SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC',
                [`%${query}%`, `%${query}%`]
            );
            return contacts || [];
        } catch (error) {
            console.error('Error searching contacts:', error);
            return [];
        }
    }

    // Contact groups methods
    async saveContactGroup(name: string, description?: string): Promise<string> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        const groupId = uuidv4();
        const now = new Date().toISOString();
        
        try {
            await this.db!.run(
                'INSERT INTO contact_groups (id, name, description, created_at) VALUES (?, ?, ?, ?)',
                [groupId, name, description || null, now]
            );
            console.log('Contact group saved with ID:', groupId);
            return groupId;
        } catch (error: any) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Group name "${name}" already exists`);
            }
            console.error('Error saving contact group:', error);
            throw error;
        }
    }

    async getAllContactGroups(): Promise<any[]> {
        if (!this.db) {
            await this.initializeDatabase();
        }

        try {
            const groups = await this.db!.all(
                'SELECT * FROM contact_groups ORDER BY name ASC'
            );
            return groups || [];
        } catch (error) {
            console.error('Error getting contact groups:', error);
            return [];
        }
    }
}