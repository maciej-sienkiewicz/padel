import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Dynamiczny import tylko dla native platform
let TcpSocket: any = null;
if (Platform.OS !== 'web') {
    try {
        TcpSocket = require('react-native-tcp-socket').default;
    } catch (error) {
        console.warn('TCP Socket not available:', error);
    }
}

const SERVER_PORT = 8080;
const PING_INTERVAL = 3000; // 3 sekundy
const CONNECTION_TIMEOUT = 10000; // 10 sekund

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'pong' | 'status' | 'connected';
    role?: 'camera' | 'remote';
    timestamp?: number;
    duration?: number;
    data?: any;
}

type MessageHandler = (message: P2PMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class TCPService {
    private server: any = null;
    private client: any = null;
    private messageHandlers: MessageHandler[] = [];
    private connectionHandlers: ConnectionHandler[] = [];
    private isServerMode: boolean = false;
    private connectedClients: any[] = [];
    private reconnectInterval: any = null;
    private pingInterval: any = null;
    private lastPingTime: number = 0;
    private deviceRole: 'camera' | 'remote' | null = null;

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

            // Domyślne IP dla hotspota
            return Platform.OS === 'android' ? '192.168.43.1' : '172.20.10.1';
        } catch (error) {
            console.error('Error getting local IP:', error);
            return Platform.OS === 'android' ? '192.168.43.1' : '172.20.10.1';
        }
    }

    setDeviceRole(role: 'camera' | 'remote') {
        this.deviceRole = role;
        console.log(`📱 Device role: ${role}`);
    }

    /**
     * KAMERA: Uruchom serwer TCP
     */
    async startServer(): Promise<string> {
        if (Platform.OS === 'web' || !TcpSocket) {
            throw new Error('TCP Socket not available on this platform');
        }

        if (this.server) {
            console.warn('Server already running');
            return await this.getLocalIP() + ':' + SERVER_PORT;
        }

        return new Promise(async (resolve, reject) => {
            try {
                const localIP = await this.getLocalIP();

                this.server = TcpSocket.createServer((socket: any) => {
                    console.log('📱 Client connected:', socket.address());
                    this.connectedClients.push(socket);
                    this.notifyConnectionHandlers(true);

                    // Wyślij potwierdzenie połączenia
                    this.sendToSocket(socket, {
                        type: 'connected',
                        role: 'camera',
                        timestamp: Date.now(),
                    });

                    // Odbieranie danych
                    socket.on('data', (data: any) => {
                        try {
                            const dataStr = data.toString();
                            // Może przyjść kilka wiadomości naraz, rozdziel je
                            const messages = dataStr.split('\n').filter((s: string) => s.trim());

                            messages.forEach((msgStr: string) => {
                                try {
                                    const message: P2PMessage = JSON.parse(msgStr);

                                    if (message.type === 'ping') {
                                        // Odpowiedz pongiem
                                        this.sendToSocket(socket, {
                                            type: 'pong',
                                            timestamp: Date.now()
                                        });
                                    } else {
                                        console.log('📨 Received:', message.type);
                                        this.notifyHandlers(message);
                                    }
                                } catch (parseError) {
                                    console.warn('Failed to parse message:', msgStr);
                                }
                            });
                        } catch (error) {
                            console.error('Failed to process data:', error);
                        }
                    });

                    socket.on('error', (error: any) => {
                        console.error('Socket error:', error);
                    });

                    socket.on('close', () => {
                        console.log('👋 Client disconnected');
                        this.connectedClients = this.connectedClients.filter(c => c !== socket);
                        if (this.connectedClients.length === 0) {
                            this.notifyConnectionHandlers(false);
                        }
                    });
                });

                // Nasłuchuj na wszystkich interfejsach
                this.server.listen({ port: SERVER_PORT, host: '0.0.0.0' }, () => {
                    console.log('✅ TCP Server started');
                    console.log(`📱 Hotspot IP: ${localIP}:${SERVER_PORT}`);
                    console.log('');
                    console.log('⚠️  WAŻNE KROKI:');
                    console.log('1. Włącz hotspot WiFi na tym telefonie');
                    console.log('2. Zanotuj nazwę sieci WiFi i hasło');
                    console.log('3. Na drugim telefonie połącz się z tym hotspotem');
                    console.log('4. Użyj pilota do zeskanowania QR kodu');
                    console.log('');

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

    /**
     * PILOT: Połącz się z kamerą
     */
    async connectToServer(address: string): Promise<boolean> {
        if (Platform.OS === 'web' || !TcpSocket) {
            throw new Error('TCP Socket not available on this platform');
        }

        return new Promise((resolve, reject) => {
            try {
                const [host, portStr] = address.split(':');
                const port = parseInt(portStr) || SERVER_PORT;

                console.log(`🔌 Connecting to ${host}:${port}...`);

                const timeout = setTimeout(() => {
                    console.error('❌ Connection timeout');
                    if (this.client) {
                        this.client.destroy();
                    }
                    reject(new Error('Connection timeout'));
                }, CONNECTION_TIMEOUT);

                this.client = TcpSocket.createConnection(
                    { port, host, timeout: CONNECTION_TIMEOUT },
                    () => {
                        clearTimeout(timeout);
                        console.log('✅ Connected to camera');

                        // Wyślij rejestrację
                        this.sendMessage({
                            type: 'register',
                            role: 'remote',
                            timestamp: Date.now(),
                        });

                        this.notifyConnectionHandlers(true);
                        this.startPing();
                        resolve(true);
                    }
                );

                // Odbieranie danych
                this.client.on('data', (data: any) => {
                    try {
                        const dataStr = data.toString();
                        const messages = dataStr.split('\n').filter((s: string) => s.trim());

                        messages.forEach((msgStr: string) => {
                            try {
                                const message: P2PMessage = JSON.parse(msgStr);

                                if (message.type === 'pong') {
                                    this.lastPingTime = Date.now();
                                } else if (message.type !== 'ping') {
                                    console.log('📨 Received:', message.type);
                                    this.notifyHandlers(message);
                                }
                            } catch (parseError) {
                                console.warn('Failed to parse message:', msgStr);
                            }
                        });
                    } catch (error) {
                        console.error('Failed to process data:', error);
                    }
                });

                this.client.on('error', (error: any) => {
                    clearTimeout(timeout);
                    console.error('❌ Connection error:', error);
                    this.notifyConnectionHandlers(false);
                    reject(error);
                    this.handleDisconnect(address);
                });

                this.client.on('close', () => {
                    console.log('👋 Disconnected from camera');
                    this.notifyConnectionHandlers(false);
                    this.handleDisconnect(address);
                });

            } catch (error) {
                console.error('Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Obsługa rozłączenia i auto-reconnect
     */
    private handleDisconnect(address: string) {
        this.stopPing();

        if (!this.isServerMode && !this.reconnectInterval) {
            console.log('🔄 Will try to reconnect in 3s...');
            this.reconnectInterval = setInterval(() => {
                console.log('🔄 Reconnecting...');
                this.connectToServer(address)
                    .then(() => {
                        if (this.reconnectInterval) {
                            clearInterval(this.reconnectInterval);
                            this.reconnectInterval = null;
                        }
                    })
                    .catch(() => {
                        console.log('❌ Reconnect failed, will retry...');
                    });
            }, 3000);
        }
    }

    /**
     * Ping co 3 sekundy
     */
    private startPing() {
        this.lastPingTime = Date.now();

        this.pingInterval = setInterval(() => {
            // Sprawdź czy ostatni pong był w ciągu 10 sekund
            if (Date.now() - this.lastPingTime > 10000) {
                console.warn('⚠️  No pong received, connection may be lost');
            }

            this.sendMessage({ type: 'ping', timestamp: Date.now() });
        }, PING_INTERVAL);
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Wyślij wiadomość
     */
    sendMessage(message: P2PMessage) {
        const data = JSON.stringify(message) + '\n'; // Dodaj \n jako separator

        if (this.isServerMode) {
            // Wyślij do wszystkich połączonych klientów
            this.connectedClients.forEach(client => {
                this.sendToSocket(client, message);
            });
        } else if (this.client) {
            // Wyślij do serwera
            try {
                this.client.write(data);
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        }
    }

    /**
     * Wyślij do konkretnego socketa
     */
    private sendToSocket(socket: any, message: P2PMessage) {
        try {
            const data = JSON.stringify(message) + '\n';
            socket.write(data);
        } catch (error) {
            console.error('Failed to send to socket:', error);
        }
    }

    /**
     * Zarejestruj handler wiadomości
     */
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.push(handler);
        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Zarejestruj handler połączenia
     */
    onConnection(handler: ConnectionHandler): () => void {
        this.connectionHandlers.push(handler);
        return () => {
            this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Powiadom handlery
     */
    private notifyHandlers(message: P2PMessage) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                console.error('Message handler error:', error);
            }
        });
    }

    private notifyConnectionHandlers(connected: boolean) {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                console.error('Connection handler error:', error);
            }
        });
    }

    /**
     * Rozłącz
     */
    disconnect() {
        this.stopPing();

        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        if (this.client) {
            try {
                this.client.destroy();
            } catch (error) {
                console.warn('Error destroying client:', error);
            }
            this.client = null;
        }

        if (this.server) {
            this.connectedClients.forEach(client => {
                try {
                    client.destroy();
                } catch (error) {
                    console.warn('Error destroying client socket:', error);
                }
            });
            this.connectedClients = [];

            try {
                this.server.close();
            } catch (error) {
                console.warn('Error closing server:', error);
            }
            this.server = null;
        }

        this.isServerMode = false;
        this.deviceRole = null;
        this.messageHandlers = [];
        this.connectionHandlers = [];

        console.log('👋 TCP Service disconnected');
    }

    /**
     * Sprawdź czy jest połączenie
     */
    isConnected(): boolean {
        if (this.isServerMode) {
            return this.connectedClients.length > 0;
        }
        return this.client !== null;
    }

    /**
     * Pobierz rolę urządzenia
     */
    getRole(): 'camera' | 'remote' | null {
        return this.deviceRole;
    }

    /**
     * Liczba połączonych klientów (dla kamery)
     */
    getConnectedClientsCount(): number {
        return this.connectedClients.length;
    }
}

export default new TCPService();