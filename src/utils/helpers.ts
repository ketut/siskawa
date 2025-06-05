export function formatMessage(message: string): string {
    return message.trim().replace(/\s+/g, ' ');
}

export function handleError(error: any): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

export function isValidPhoneNumber(phone: string): boolean {
    // Remove spaces and check if it's a valid international format
    const cleaned = phone.replace(/\s+/g, '');
    return /^\+\d{10,15}$/.test(cleaned);
}

export function formatPhoneNumber(phone: string): string {
    return phone.replace(/\s+/g, '');
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function validatePhoneNumbers(phones: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    phones.forEach(phone => {
        if (isValidPhoneNumber(phone)) {
            valid.push(formatPhoneNumber(phone));
        } else {
            invalid.push(phone);
        }
    });
    
    return { valid, invalid };
}