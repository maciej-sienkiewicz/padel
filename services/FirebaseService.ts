import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, remove, push, Database } from 'firebase/database';

/**
 * Firebase Service - Komunikacja Camera <-> Remote przez Firebase Realtime Database
 *
 * Architektura:
 * - Kamera: Nasłuchuje na /signals/{sessionId}/
 * - Pilot: Wysyła sygnały do /signals/{sessionId}/
 * - Session ID: Generowany przez kamerę, udostępniany przez QR lub kod
 */

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    duration?: number;
}

type MessageHandler = (message: P2PMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class FirebaseService {
    private app: FirebaseApp | null = null;
    private database: Database | null = null;
    private messageHandlers: MessageHandler[] = [];
    private connectionHandlers: ConnectionHandler[] = [];
    private deviceRole: 'camera' | 'remote' | null = null;
    private sessionId: string = '';
    private unsubscribeSignals: (() => void) | null = null;
    private unsubscribeStatus: (() => void) | null = null;

    /**
     * Inicjalizuj Firebase
     * UWAGA: Musisz najpierw skonfigurować Firebase w konsoli
     */
    initialize(firebaseConfig: any) {
        try {
            // Sprawdź czy Firebase już jest zainicjalizowany
            if (getApps().length === 0) {
                this.app = initializeApp(firebaseConfig);
                console.log('🔥 Firebase initialized');
            } else {
                this.app = getApps()[0];
                console.log('🔥 Firebase already initialized');
            }

            this.database = getDatabase(this.app);
            console.log('📊 Database ready');
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ustaw rolę urządzenia
     */
    setDeviceRole(role: 'camera' | 'remote') {
        this.deviceRole = role;
        console.log(`📱 Device role: ${role}`);
    }

    /**
     * KAMERA: Utwórz sesję i zacznij nasłuchiwać sygnałów
     */
    async startAsCamera(): Promise<string> {
        if (!this.database) {
            throw new Error('Firebase not initialized');
        }

        this.deviceRole = 'camera';

        // Generuj unikalny session ID (6 znaków, łatwy do wpisania)
        this.sessionId = this.generateSessionId();

        console.log('📹 Camera mode started');
        console.log(`🔑 Session ID: ${this.sessionId}`);

        // Ustaw status kamery jako online
        const statusRef = ref(this.database, `sessions/${this.sessionId}/camera/status`);
        await set(statusRef, {
            online: true,
            timestamp: Date.now(),
            role: 'camera',
        });

        // Nasłuchuj na sygnały od pilotów
        const signalsRef = ref(this.database, `sessions/${this.sessionId}/signals`);

        this.unsubscribeSignals = onValue(signalsRef, (snapshot) => {
            const signals = snapshot.val();

            if (signals) {
                // Przetwórz każdy nowy sygnał
                Object.keys(signals).forEach(async (key) => {
                    const signal = signals[key];

                    console.log('📨 Received signal:', signal.type);

                    // Powiadom handlery
                    this.notifyHandlers(signal);

                    // Usuń przetworzony sygnał
                    const signalRef = ref(this.database!, `sessions/${this.sessionId}/signals/${key}`);
                    await remove(signalRef);
                });
            }
        });

        // Nasłuchuj na status pilotów
        const remotesRef = ref(this.database, `sessions/${this.sessionId}/remotes`);

        this.unsubscribeStatus = onValue(remotesRef, (snapshot) => {
            const remotes = snapshot.val();
            const connected = remotes && Object.keys(remotes).length > 0;

            if (connected) {
                console.log('✅ Remote(s) connected:', Object.keys(remotes).length);
            } else {
                console.log('⏳ Waiting for remotes...');
            }

            this.notifyConnectionHandlers(connected);
        });

        return this.sessionId;
    }

    /**
     * PILOT: Połącz się z sesją kamery
     */
    async connectToCamera(sessionId: string): Promise<boolean> {
        if (!this.database) {
            throw new Error('Firebase not initialized');
        }

        this.deviceRole = 'remote';
        this.sessionId = sessionId.toUpperCase();

        console.log(`🎮 Connecting to session: ${this.sessionId}`);

        try {
            // Sprawdź czy sesja istnieje
            const sessionRef = ref(this.database, `sessions/${this.sessionId}/camera/status`);

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Session not found (timeout)'));
                }, 10000);

                onValue(sessionRef, async (snapshot) => {
                    clearTimeout(timeout);

                    const cameraStatus = snapshot.val();

                    if (cameraStatus && cameraStatus.online) {
                        console.log('✅ Camera found and online');

                        // Zarejestruj pilota
                        const remoteId = Math.random().toString(36).substring(7);
                        const remoteRef = ref(this.database!, `sessions/${this.sessionId}/remotes/${remoteId}`);

                        await set(remoteRef, {
                            online: true,
                            timestamp: Date.now(),
                            role: 'remote',
                        });

                        // Nasłuchuj na status kamery
                        this.unsubscribeStatus = onValue(sessionRef, (cameraSnapshot) => {
                            const status = cameraSnapshot.val();
                            const connected = status && status.online;
                            this.notifyConnectionHandlers(connected);
                        });

                        console.log('✅ Connected to camera');
                        this.notifyConnectionHandlers(true);
                        resolve(true);
                    } else {
                        reject(new Error('Camera not found or offline'));
                    }
                }, { onlyOnce: true });
            });

        } catch (error) {
            console.error('❌ Connection failed:', error);
            throw error;
        }
    }

    /**
     * Wyślij wiadomość
     */
    async sendMessage(message: P2PMessage): Promise<void> {
        if (!this.database || !this.sessionId) {
            console.warn('⚠️ Firebase not ready or no session');
            return;
        }

        try {
            // Wyślij sygnał do Firebase
            const signalsRef = ref(this.database, `sessions/${this.sessionId}/signals`);
            const newSignalRef = push(signalsRef);

            await set(newSignalRef, {
                ...message,
                timestamp: Date.now(),
                role: this.deviceRole,
            });

            console.log('📤 Sent:', message.type);
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Generuj 6-znakowy session ID
     */
    private generateSessionId(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
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
     * Powiadom handlery o wiadomości
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
     * Powiadom handlery o połączeniu
     */
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
     * Rozłącz i wyczyść
     */
    async disconnect(): Promise<void> {
        if (this.unsubscribeSignals) {
            this.unsubscribeSignals();
            this.unsubscribeSignals = null;
        }

        if (this.unsubscribeStatus) {
            this.unsubscribeStatus();
            this.unsubscribeStatus = null;
        }

        // Usuń status z Firebase
        if (this.database && this.sessionId) {
            if (this.deviceRole === 'camera') {
                const sessionRef = ref(this.database, `sessions/${this.sessionId}`);
                await remove(sessionRef);
                console.log('🗑️ Session cleaned up');
            } else if (this.deviceRole === 'remote') {
                // Pilot: usuń tylko swój status
                console.log('👋 Remote disconnected');
            }
        }

        this.deviceRole = null;
        this.sessionId = '';
        this.messageHandlers = [];
        this.connectionHandlers = [];

        console.log('👋 Firebase Service disconnected');
    }

    /**
     * Sprawdź czy jest połączenie
     */
    isConnected(): boolean {
        return this.sessionId !== '';
    }

    /**
     * Pobierz session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Pobierz rolę urządzenia
     */
    getRole(): 'camera' | 'remote' | null {
        return this.deviceRole;
    }
}

export default new FirebaseService();