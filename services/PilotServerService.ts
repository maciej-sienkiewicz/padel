import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Server } from 'react-native-http-bridge';

export interface PilotMessage {
    pilotID: string;
    type: 'register' | 'capture';
    timestamp: number;
}

export interface ConnectedPilot {
    id: string;
    name: string;
    lastSeen: Date;
    captureCount: number;
    deviceType?: string; // Dodane
}

type CaptureHandler = (pilotID: string) => void;
type PilotConnectedHandler = (pilot: ConnectedPilot) => void;

class PilotServerService {
    private server: any = null;
    private isRunning: boolean = false;
    private connectedPilots: Map<string, ConnectedPilot> = new Map();
    private captureHandlers: CaptureHandler[] = [];
    private pilotConnectedHandlers: PilotConnectedHandler[] = [];
    private sessionID: string = '';

    // Pobierz lokalne IP urządzenia
    async getLocalIP(): Promise<string> {
        try {
            const netInfo = await NetInfo.fetch();

            if (netInfo.type === 'wifi' && netInfo.details) {
                // @ts-ignore - WiFi details
                const ipAddress = netInfo.details.ipAddress;
                if (ipAddress && ipAddress !== '0.0.0.0') {
                    return ipAddress;
                }
            }

            // Domyślny IP dla hotspota (Android zazwyczaj 192.168.43.1)
            return Platform.OS === 'android' ? '192.168.43.1' : '172.20.10.1';
        } catch (error) {
            console.error('Error getting local IP:', error);
            return Platform.OS === 'android' ? '192.168.43.1' : '172.20.10.1';
        }
    }

    // Generuj unikalny session ID
    private generateSessionID(): string {
        return `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
    }

    // Uruchom serwer HTTP
    async startServer(): Promise<{ ip: string; qrData: string; sessionID: string }> {
        if (this.isRunning) {
            throw new Error('Server already running');
        }

        this.sessionID = this.generateSessionID();
        const localIP = await this.getLocalIP();

        try {
            // Start HTTP server on port 8080
            Server.listen(8080);

            // Handle incoming requests
            Server.get('/', (req: any, res: any) => {
                res.json({
                    status: 'ok',
                    message: 'Padel Pilot Server',
                    sessionID: this.sessionID,
                    connectedPilots: this.connectedPilots.size
                });
            });

            // Rejestracja pilota
            // W metodzie startServer(), zaktualizuj handler /register:

            Server.post('/register', (req: any, res: any) => {
                try {
                    const body = JSON.parse(req.body);
                    const { pilotID, deviceType } = body; // Dodane deviceType

                    if (!pilotID) {
                        res.status(400).json({ error: 'Missing pilotID' });
                        return;
                    }

                    console.log(`📹 Pilot registered: ${pilotID} (${deviceType || 'ESP32'})`);

                    // Określ nazwę na podstawie typu urządzenia
                    let pilotName;
                    if (deviceType === 'phone') {
                        pilotName = `📱 Telefon ${this.getPilotNumber(pilotID)}`;
                    } else {
                        pilotName = `Pilot ${this.getPilotNumber(pilotID)}`;
                    }

                    // Dodaj lub zaktualizuj pilota
                    const pilot: ConnectedPilot = {
                        id: pilotID,
                        name: pilotName,
                        lastSeen: new Date(),
                        captureCount: this.connectedPilots.get(pilotID)?.captureCount || 0,
                        deviceType: deviceType || 'ESP32', // Dodatkowe pole
                    };

                    this.connectedPilots.set(pilotID, pilot);

                    // Powiadom listenery
                    this.notifyPilotConnected(pilot);

                    res.json({
                        status: 'ok',
                        message: 'Pilot registered',
                        pilotName: pilot.name,
                        totalPilots: this.connectedPilots.size
                    });
                } catch (error) {
                    console.error('Register error:', error);
                    res.status(500).json({ error: 'Internal error' });
                }
            });

            // Sygnał capture
            Server.post('/capture', (req: any, res: any) => {
                try {
                    const body = JSON.parse(req.body);
                    const { pilotID, timestamp } = body;

                    if (!pilotID) {
                        res.status(400).json({ error: 'Missing pilotID' });
                        return;
                    }

                    console.log(`🎬 Capture signal from: ${pilotID}`);

                    // Zaktualizuj stats pilota
                    const pilot = this.connectedPilots.get(pilotID);
                    if (pilot) {
                        pilot.lastSeen = new Date();
                        pilot.captureCount++;
                        this.connectedPilots.set(pilotID, pilot);
                    }

                    // Wywołaj handlery
                    this.notifyCaptureHandlers(pilotID);

                    res.json({
                        status: 'ok',
                        message: 'Video saved',
                        pilotName: pilot?.name || 'Unknown',
                        captureCount: pilot?.captureCount || 0
                    });
                } catch (error) {
                    console.error('Capture error:', error);
                    res.status(500).json({ error: 'Internal error' });
                }
            });

            // Status endpoint
            Server.get('/status', (req: any, res: any) => {
                const pilots = Array.from(this.connectedPilots.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    captureCount: p.captureCount,
                    lastSeen: p.lastSeen.toISOString()
                }));

                res.json({
                    sessionID: this.sessionID,
                    connectedPilots: pilots.length,
                    pilots: pilots,
                    serverIP: localIP
                });
            });

            this.isRunning = true;
            console.log(`✅ Pilot Server started on ${localIP}:8080`);

            // Generuj dane QR (format: SSID:password:serverIP)
            // SSID hotspota musi być włączony ręcznie przez użytkownika
            // Więc QR będzie zawierał tylko IP serwera
            const qrData = `PadelCam:padel123:${localIP}`;

            return {
                ip: localIP,
                qrData: qrData,
                sessionID: this.sessionID
            };

        } catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    }

    // Zatrzymaj serwer
    stopServer() {
        if (!this.isRunning) return;

        try {
            Server.stop();
            this.isRunning = false;
            this.connectedPilots.clear();
            this.sessionID = '';
            console.log('🛑 Pilot Server stopped');
        } catch (error) {
            console.error('Error stopping server:', error);
        }
    }

    // Otrzymaj numer pilota (1-4) na podstawie ID
    private getPilotNumber(pilotID: string): number {
        const pilots = Array.from(this.connectedPilots.keys()).sort();
        const index = pilots.indexOf(pilotID);
        return index >= 0 ? index + 1 : pilots.length + 1;
    }

    // Zarejestruj handler dla capture
    onCapture(handler: CaptureHandler): () => void {
        this.captureHandlers.push(handler);
        return () => {
            this.captureHandlers = this.captureHandlers.filter(h => h !== handler);
        };
    }

    // Zarejestruj handler dla połączenia pilota
    onPilotConnected(handler: PilotConnectedHandler): () => void {
        this.pilotConnectedHandlers.push(handler);
        return () => {
            this.pilotConnectedHandlers = this.pilotConnectedHandlers.filter(h => h !== handler);
        };
    }

    // Powiadom handlery o capture
    private notifyCaptureHandlers(pilotID: string) {
        this.captureHandlers.forEach(handler => {
            try {
                handler(pilotID);
            } catch (error) {
                console.error('Capture handler error:', error);
            }
        });
    }

    // Powiadom handlery o połączeniu pilota
    private notifyPilotConnected(pilot: ConnectedPilot) {
        this.pilotConnectedHandlers.forEach(handler => {
            try {
                handler(pilot);
            } catch (error) {
                console.error('Pilot connected handler error:', error);
            }
        });
    }

    // Pobierz listę połączonych pilotów
    getConnectedPilots(): ConnectedPilot[] {
        return Array.from(this.connectedPilots.values());
    }

    // Czy serwer działa
    isServerRunning(): boolean {
        return this.isRunning;
    }

    // Pobierz session ID
    getSessionID(): string {
        return this.sessionID;
    }

    // Wyczyść nieaktywne piloty (nie widziane > 30 sekund)
    cleanupInactivePilots() {
        const now = new Date();
        const threshold = 30000; // 30 seconds

        for (const [id, pilot] of this.connectedPilots.entries()) {
            if (now.getTime() - pilot.lastSeen.getTime() > threshold) {
                console.log(`🗑️ Removing inactive pilot: ${pilot.name}`);
                this.connectedPilots.delete(id);
            }
        }
    }
}

export default new PilotServerService();