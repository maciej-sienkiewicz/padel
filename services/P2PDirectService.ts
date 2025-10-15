import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'pong' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    duration?: number;
    data?: any;
}

type MessageHandler = (message: P2PMessage) => void;

/**
 * P2P Direct Service - Komunikacja przez HTTP bez zewnętrznego serwera
 *
 * Architektura:
 * - Kamera: Uruchamia prosty HTTP server nasłuchujący na porcie 8080
 * - Pilot: Wysyła HTTP POST requesty do kamery
 * - Połączenie: Przez WiFi hotspot (kamera = hotspot, pilot = klient)
 */
class P2PDirectService {
    private messageHandlers: MessageHandler[] = [];
    private deviceRole: 'camera' | 'remote' | null = null;
    private serverRunning: boolean = false;
    private cameraAddress: string = '';
    private pingInterval: any = null;

    // HTTP Server dla kamery (symulowany przez polling)
    private serverMessages: P2PMessage[] = [];
    private pollingInterval: any = null;

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
        console.log(`📱 Device role set to: ${role}`);
    }

    /**
     * KAMERA: Uruchom "serwer" (w rzeczywistości używamy prostego HTTP fetch API)
     * Kamera będzie przyjmować requesty od pilotów
     */
    async startServer(): Promise<string> {
        const localIP = await this.getLocalIP();
        this.deviceRole = 'camera';
        this.serverRunning = true;

        console.log('📹 Camera mode started');
        console.log(`📱 Hotspot IP: ${localIP}:8080`);
        console.log('⚠️  WAŻNE: Włącz hotspot WiFi na tym telefonie!');

        return `${localIP}:8080`;
    }

    /**
     * PILOT: Połącz się z kamerą (wyślij request rejestracyjny)
     */
    async connectToServer(address: string): Promise<boolean> {
        this.deviceRole = 'remote';
        this.cameraAddress = address;

        try {
            // Usuń :8080 jeśli jest i dodaj ponownie
            const cleanAddress = address.replace(':8080', '').trim();
            const url = `http://${cleanAddress}:8080/register`;

            console.log(`🎮 Connecting to camera: ${url}`);

            // Wyślij request rejestracyjny
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'register',
                    role: 'remote',
                    timestamp: Date.now(),
                }),
            });

            if (response.ok) {
                console.log('✅ Connected to camera');
                this.startPing();
                return true;
            } else {
                console.error('❌ Connection failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Connection error:', error);
            return false;
        }
    }

    /**
     * Wyślij wiadomość
     */
    sendMessage(message: P2PMessage) {
        if (this.deviceRole === 'camera') {
            // Kamera: Dodaj wiadomość do kolejki (broadcast do wszystkich pilotów)
            this.serverMessages.push(message);
            console.log('📤 Camera: Message queued for remotes');
        } else if (this.deviceRole === 'remote') {
            // Pilot: Wyślij HTTP request do kamery
            this.sendToCamera(message);
        }
    }

    /**
     * PILOT: Wyślij HTTP request do kamery
     */
    private async sendToCamera(message: P2PMessage) {
        if (!this.cameraAddress) {
            console.warn('⚠️  Camera address not set');
            return;
        }

        try {
            const cleanAddress = this.cameraAddress.replace(':8080', '').trim();
            const endpoint = message.type === 'capture' ? '/capture' : '/message';
            const url = `http://${cleanAddress}:8080${endpoint}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            if (response.ok) {
                console.log(`✅ Sent ${message.type} to camera`);
            } else {
                console.error(`❌ Failed to send ${message.type}:`, response.status);
            }
        } catch (error) {
            console.error('❌ Send error:', error);
        }
    }

    /**
     * Ping co 5 sekund (keep-alive)
     */
    private startPing() {
        this.pingInterval = setInterval(() => {
            if (this.deviceRole === 'remote' && this.cameraAddress) {
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

    /**
     * Zarejestruj handler wiadomości
     */
    onMessage(handler: MessageHandler) {
        this.messageHandlers.push(handler);

        return () => {
            this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Powiadom handlery o nowej wiadomości
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

    /**
     * Symulacja odbierania wiadomości przez kamerę
     * (W prawdziwej implementacji to byłby HTTP server)
     */
    simulateReceiveMessage(message: P2PMessage) {
        if (this.deviceRole === 'camera') {
            console.log('📨 Camera received:', message.type);
            this.notifyHandlers(message);
        }
    }

    /**
     * Rozłącz
     */
    disconnect() {
        this.stopPing();

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this.serverRunning = false;
        this.deviceRole = null;
        this.cameraAddress = '';
        this.messageHandlers = [];
        this.serverMessages = [];

        console.log('👋 Disconnected');
    }

    isConnected(): boolean {
        if (this.deviceRole === 'camera') {
            return this.serverRunning;
        } else if (this.deviceRole === 'remote') {
            return this.cameraAddress !== '';
        }
        return false;
    }

    getRole(): 'camera' | 'remote' | null {
        return this.deviceRole;
    }
}

export default new P2PDirectService();