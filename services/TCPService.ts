import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Dynamiczny import tylko dla native platform
let TcpSocket: any = null;
if (Platform.OS !== 'web') {
    TcpSocket = require('react-native-tcp-socket').default;
}

const SERVER_PORT = 8080;

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'pong' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    data?: any;
}

type MessageHandler = (message: P2PMessage) => void;

class TCPService {
    private server: any = null;
    private client: any = null;
    private messageHandlers: MessageHandler[] = [];
    private isServerMode: boolean = false;
    private connectedClients: any[] = [];
    private reconnectInterval: any = null;
    private pingInterval: any = null;

    // Pobierz lokalne IP urządzenia
    async getLocalIP(): Promise<string> {
        try {
            const netInfo = await NetInfo.fetch();

            if (netInfo.type === 'wifi' && netInfo.details) {
                // @ts-ignore
                const ipAddress = netInfo.details.ipAddress;
                if (ipAddress && ipAddress !== '0.0.0.0') {
                    return ipAddress;
                }
            }

            return '192.168.1.100';
        } catch (error) {
            console.error('Error getting local IP:', error);
            return '192.168.1.100';
        }
    }

    // KAMERA: Uruchom serwer TCP
    async startServer(): Promise<string> {
        if (Platform.OS === 'web' || !TcpSocket) {
            throw new Error('TCP Socket not available on web platform');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const localIP = await this.getLocalIP();

                this.server = TcpSocket.createServer((socket: any) => {
                    console.log('Client connected:', socket.address());
                    this.connectedClients.push(socket);

                    socket.on('data', (data: any) => {
                        try {
                            const message: P2PMessage = JSON.parse(data.toString());
                            console.log('Received message:', message);

                            if (message.type === 'ping') {
                                socket.write(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                            } else {
                                this.notifyHandlers(message);
                            }
                        } catch (error) {
                            console.error('Failed to parse message:', error);
                        }
                    });

                    socket.on('error', (error: any) => {
                        console.error('Socket error:', error);
                    });

                    socket.on('close', () => {
                        console.log('Client disconnected');
                        this.connectedClients = this.connectedClients.filter(c => c !== socket);
                    });
                });

                this.server.listen({ port: SERVER_PORT, host: '0.0.0.0' }, () => {
                    console.log(`TCP Server listening on ${localIP}:${SERVER_PORT}`);
                    this.isServerMode = true;
                    resolve(`${localIP}:${SERVER_PORT}`);
                });

                this.server.on('error', (error: any) => {
                    console.error('Server error:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    // PILOT: Połącz się z serwerem (kamerą)
    async connectToServer(address: string): Promise<boolean> {
        if (Platform.OS === 'web' || !TcpSocket) {
            throw new Error('TCP Socket not available on web platform');
        }

        return new Promise((resolve, reject) => {
            try {
                const [host, portStr] = address.split(':');
                const port = parseInt(portStr) || SERVER_PORT;

                console.log(`Connecting to ${host}:${port}...`);

                this.client = TcpSocket.createConnection(
                    {
                        port,
                        host,
                        timeout: 5000,
                    },
                    () => {
                        console.log('Connected to server');

                        this.sendMessage({ type: 'register', role: 'remote' });
                        this.startPing();

                        resolve(true);
                    }
                );

                this.client.on('data', (data: any) => {
                    try {
                        const message: P2PMessage = JSON.parse(data.toString());
                        if (message.type !== 'pong') {
                            this.notifyHandlers(message);
                        }
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                });

                this.client.on('error', (error: any) => {
                    console.error('Client error:', error);
                    reject(error);
                    this.handleDisconnect(address);
                });

                this.client.on('close', () => {
                    console.log('Disconnected from server');
                    this.handleDisconnect(address);
                });

            } catch (error) {
                console.error('Connection failed:', error);
                reject(error);
            }
        });
    }

    private handleDisconnect(address: string) {
        this.stopPing();

        if (!this.isServerMode && !this.reconnectInterval) {
            console.log('Attempting to reconnect...');
            this.reconnectInterval = setInterval(() => {
                this.connectToServer(address).catch(() => {
                    console.log('Reconnection attempt failed');
                });
            }, 3000);
        }
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            this.sendMessage({ type: 'ping', timestamp: Date.now() });
        }, 3000);
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendMessage(message: P2PMessage) {
        const data = JSON.stringify(message);

        if (this.isServerMode) {
            this.connectedClients.forEach(client => {
                try {
                    client.write(data);
                } catch (error) {
                    console.error('Failed to send to client:', error);
                }
            });
        } else if (this.client) {
            try {
                this.client.write(data);
            } catch (error) {
                console.error('Failed to send to server:', error);
            }
        }
    }

    onMessage(handler: MessageHandler) {
        this.messageHandlers.push(handler);

        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }

    private notifyHandlers(message: P2PMessage) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                console.error('Message handler error:', error);
            }
        });
    }

    disconnect() {
        this.stopPing();

        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        if (this.client) {
            this.client.destroy();
            this.client = null;
        }

        if (this.server) {
            this.connectedClients.forEach(client => client.destroy());
            this.connectedClients = [];
            this.server.close();
            this.server = null;
        }

        this.isServerMode = false;
        this.messageHandlers = [];
    }

    isConnected(): boolean {
        if (this.isServerMode) {
            return this.connectedClients.length > 0;
        }
        return this.client !== null;
    }
}

export default new TCPService();