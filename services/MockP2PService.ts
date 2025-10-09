import NetInfo from '@react-native-community/netinfo';

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'pong' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    data?: any;
}

type MessageHandler = (message: P2PMessage) => void;

// Symulacja lokalnego połączenia dla testów i web
class MockP2PService {
    private messageHandlers: MessageHandler[] = [];
    private isConnected: boolean = false;
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

            return '192.168.1.100';
        } catch (error) {
            console.error('Error getting local IP:', error);
            return '192.168.1.100';
        }
    }

    async startServer(): Promise<string> {
        const localIP = await this.getLocalIP();
        this.deviceRole = 'camera';

        console.log('📱 MOCK: Camera server started');
        console.log('⚠️ To jest wersja testowa - używa symulowanego połączenia');
        console.log('💡 Dla prawdziwego P2P użyj Development Build na urządzeniu mobilnym');

        return `${localIP}:8080`;
    }

    async connectToServer(address: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.deviceRole = 'remote';
            this.isConnected = true;

            console.log('📱 MOCK: Connected to camera');
            console.log('⚠️ To jest wersja testowa - używa symulowanego połączenia');

            // Symuluj połączenie po 1 sekundzie
            setTimeout(() => {
                this.notifyHandlers({ type: 'register', role: 'remote' });
                resolve(true);
            }, 1000);
        });
    }

    sendMessage(message: P2PMessage) {
        console.log('📤 MOCK: Sending message:', message.type);

        // W wersji mock - natychmiast "odbierz" wiadomość
        if (message.type === 'capture') {
            console.log('📸 MOCK: Capture signal received!');
            // Symuluj że kamera otrzymała sygnał
            setTimeout(() => {
                this.notifyHandlers(message);
            }, 100);
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
        this.isConnected = false;
        this.deviceRole = null;
        this.messageHandlers = [];
        console.log('📱 MOCK: Disconnected');
    }

    isConnectedToServer(): boolean {
        return this.isConnected;
    }
}

export default new MockP2PService();