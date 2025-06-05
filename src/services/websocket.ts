import WebSocket, { WebSocketServer } from 'ws';

export class WebSocketService {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });
        this.setupWebSocket();
        console.log(`WebSocket server started on port ${port}`);
    }

    private setupWebSocket() {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('New WebSocket client connected');
            this.clients.add(ws);

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    console.log('Received WebSocket message:', data);
                    
                    // Echo back for testing
                    ws.send(JSON.stringify({
                        type: 'echo',
                        data: data,
                        timestamp: new Date().toISOString()
                    }));
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'Connected to WhatsApp WebSocket',
                timestamp: new Date().toISOString()
            }));
        });
    }

    public sendMessage(message: string) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    public broadcastMessage(type: string, data: any) {
        const message = JSON.stringify({
            type,
            data,
            timestamp: new Date().toISOString()
        });
        
        this.sendMessage(message);
    }

    public getClientCount(): number {
        return this.clients.size;
    }
}