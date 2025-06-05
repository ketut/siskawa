import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class DatabaseConnection {
    private static instance: DatabaseConnection;
    private db: any;

    private constructor() {}

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    public async connect() {
        this.db = await open({
            filename: './whatsapp.db',
            driver: sqlite3.Database
        });
        
        await this.initializeTables();
        return this.db;
    }

    private async initializeTables() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender TEXT NOT NULL,
                recipient TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                status TEXT DEFAULT 'sent'
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                message_id TEXT,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                timestamp DATETIME NOT NULL,
                retry_count INTEGER DEFAULT 0,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            );

            CREATE TABLE IF NOT EXISTS bulk_messages (
                id TEXT PRIMARY KEY,
                recipients TEXT NOT NULL,
                message TEXT NOT NULL,
                interval_ms INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME NOT NULL,
                completed_at DATETIME
            );
        `);
    }

    public getDb() {
        return this.db;
    }
}