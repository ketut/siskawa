export interface Message {
    id: string;
    sender: string;
    recipient: string;
    content: string;
    timestamp: Date;
    status?: string;
}

export interface User {
    id: string;
    name: string;
    phoneNumber: string;
    isActive: boolean;
}

export interface TransactionLog {
    id: string;
    messageId: string;
    status: 'sent' | 'failed' | 'delivered' | 'pending';
    timestamp: Date;
    errorMessage?: string;
    retryCount?: number;
}

export interface BulkMessage {
    id: string;
    recipients: string[];
    message: string;
    interval: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    completedAt?: Date;
}