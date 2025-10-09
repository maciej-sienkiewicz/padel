import NetInfo from '@react-native-community/netinfo';

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'pong' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    message?: string;
    data?: any;
}

type MessageHandler = (message: P2PMessage) => void;

class ServerWebSocketService {
    private ws: WebSocket | null = null;
    private messageHandlers: MessageHandler[] = [];
    private deviceRole: 'camera' | 'remote' | null = null;
    private reconnectInterval: any = null;
    private pingInterval: any = null;
    private serverAddress: string = '';

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

    async startServer(): Promise<string> {
        // W tym trybie "serwer" to tak naprawdę komputer
        // Telefon będzie klientem
        this.deviceRole = 'camera';

        const localIP = await this.getLocalIP();

        console.log('📹 Tryb Kamera');
        console.log('⚠️ Musisz połączyć się z serwerem na komputerze');
        console.log('💡 Wpisz adres serwera pokazany w terminalu (np. 192.168.1.5:8080)');

        return `${localIP}:8080`;
    }

    async connectToServer(address: string): Promise<boolean> {
        this.serverAddress = address;

        return new Promise((resolve, reject) => {
            try {
                // Usuń :8080 jeśli już jest
                let cleanAddress = address.replace(':8080', '').trim();

                // Dodaj ws:// jeśli brakuje
                const wsUrl = cleanAddress.startsWith('ws://')
                    ? cleanAddress
                    : `ws://${cleanAddress}:8080`;

                console.log(`📱 Łączenie z: ${wsUrl}`);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('✅ Połączono z serwerem!');

                    // Zarejestruj się natychmiast
                    if (this.deviceRole) {
                        this.sendMessage({
                            type: 'register',
                            role: this.deviceRole
                        });
                    }

                    // Uruchom ping co 5 sekund
                    this.startPing();

                    // Wyczyść interwał reconnect jeśli istnieje
                    if (this.reconnectInterval) {
                        clearInterval(this.reconnectInterval);
                        this.reconnectInterval = null;
                    }

                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: P2PMessage = JSON.parse(event.data);

                        // Nie loguj pongów
                        if (message.type !== 'pong') {
                            console.log('📨 Otrzymano:', message.type, message.message || '');
                        }

                        this.notifyHandlers(message);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ Błąd WebSocket:', error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('👋 Rozłączono z serwera');
                    this.stopPing();
                    this.handleReconnect();
                };

            } catch (error) {
                console.error('Connection failed:', error);
                reject(error);
            }
        });
    }

    private handleReconnect() {
        if (!this.reconnectInterval && this.serverAddress) {
            console.log('🔄 Próba ponownego połączenia...');

            this.reconnectInterval = setInterval(() => {
                if (this.serverAddress) {
                    console.log('🔄 Ponowne łączenie...');
                    this.connectToServer(this.serverAddress).catch(() => {
                        console.log('⏳ Nie udało się, próbuję ponownie za 3s...');
                    });
                }
            }, 3000);
        }
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendMessage({ type: 'ping', timestamp: Date.now() });
            }
        }, 5000);
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    setDeviceRole(role: 'camera' | 'remote') {
        this.deviceRole = role;
    }

    sendMessage(message: P2PMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));

                if (message.type !== 'ping') {
                    console.log('📤 Wysłano:', message.type);
                }
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        } else {
            console.warn('⚠️ WebSocket nie jest połączony');
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

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.messageHandlers = [];
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

export default new ServerWebSocketService();