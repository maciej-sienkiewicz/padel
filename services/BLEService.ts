import { Platform } from 'react-native';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';

/**
 * BLE Service - Komunikacja Camera <-> Remote przez Bluetooth Low Energy
 *
 * Architektura:
 * - Kamera: BLE Peripheral (ogłasza usługę)
 * - Pilot (ESP32/Telefon): BLE Central (skanuje i łączy się)
 *
 * UUIDs (musisz użyć tych samych na ESP32):
 */
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export interface P2PMessage {
    type: 'register' | 'capture' | 'ping' | 'status';
    role?: 'camera' | 'remote';
    timestamp?: number;
    duration?: number;
}

type MessageHandler = (message: P2PMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class BLEService {
    private bleManager: BleManager | null = null;
    private messageHandlers: MessageHandler[] = [];
    private connectionHandlers: ConnectionHandler[] = [];
    private deviceRole: 'camera' | 'remote' | null = null;
    private connectedDevice: Device | null = null;
    private characteristic: Characteristic | null = null;
    private scanSubscription: any = null;

    constructor() {
        this.bleManager = new BleManager();
    }

    /**
     * Inicjalizacja BLE
     */
    async initialize(): Promise<void> {
        if (!this.bleManager) {
            throw new Error('BLE Manager not initialized');
        }

        const state = await this.bleManager.state();
        console.log('📡 BLE State:', state);

        if (state !== 'PoweredOn') {
            console.warn('⚠️ BLE is not powered on');

            // Czekaj aż BLE będzie gotowy
            return new Promise((resolve) => {
                const subscription = this.bleManager!.onStateChange((state) => {
                    if (state === 'PoweredOn') {
                        subscription.remove();
                        console.log('✅ BLE is now powered on');
                        resolve();
                    }
                }, true);
            });
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
     * KAMERA: Uruchom jako BLE Peripheral (ogłaszaj usługę)
     */
    async startAsCamera(): Promise<string> {
        await this.initialize();

        if (!this.bleManager) {
            throw new Error('BLE Manager not initialized');
        }

        this.deviceRole = 'camera';

        try {
            // Na iOS: Aplikacja automatycznie staje się Peripheral gdy zaczniemy
            // używać CBPeripheralManager (przez react-native-ble-plx)

            // Rozpocznij nasłuchiwanie na połączenia
            console.log('📹 Camera mode: Starting BLE advertising...');
            console.log(`📡 Service UUID: ${SERVICE_UUID}`);
            console.log(`📝 Characteristic UUID: ${CHARACTERISTIC_UUID}`);

            // iOS automatycznie ogłasza usługę gdy używamy startDeviceScan
            // Ale my jesteśmy Peripheral, więc musimy użyć innego podejścia

            // UWAGA: react-native-ble-plx ma ograniczenia dla Peripheral mode na iOS
            // Będziemy używać hybrydowego podejścia:
            // 1. Kamera skanuje w poszukiwaniu pilotów
            // 2. Pilot też skanuje kamery
            // 3. Kto pierwszy znajdzie, ten się łączy

            this.startScanning();

            return 'BLE Camera Ready';

        } catch (error) {
            console.error('Failed to start camera mode:', error);
            throw error;
        }
    }

    /**
     * PILOT: Połącz się z kamerą
     */
    async connectToCamera(): Promise<boolean> {
        await this.initialize();

        if (!this.bleManager) {
            throw new Error('BLE Manager not initialized');
        }

        this.deviceRole = 'remote';

        try {
            console.log('🎮 Remote mode: Scanning for camera...');

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.stopScanning();
                    reject(new Error('Camera not found (timeout)'));
                }, 30000); // 30 sekund timeout

                this.scanSubscription = this.bleManager!.startDeviceScan(
                    [SERVICE_UUID],
                    { allowDuplicates: false },
                    async (error, device) => {
                        if (error) {
                            console.error('Scan error:', error);
                            clearTimeout(timeout);
                            this.stopScanning();
                            reject(error);
                            return;
                        }

                        if (device && device.name?.includes('Padel')) {
                            console.log('📱 Found camera:', device.name);

                            clearTimeout(timeout);
                            this.stopScanning();

                            try {
                                await this.connectToDevice(device);
                                resolve(true);
                            } catch (connectError) {
                                reject(connectError);
                            }
                        }
                    }
                );
            });

        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    }

    /**
     * Połącz się z urządzeniem BLE
     */
    private async connectToDevice(device: Device): Promise<void> {
        if (!this.bleManager) {
            throw new Error('BLE Manager not initialized');
        }

        try {
            console.log('🔌 Connecting to device...');

            // Połącz się z urządzeniem
            this.connectedDevice = await device.connect();
            console.log('✅ Connected!');

            // Odkryj usługi i charakterystyki
            await this.connectedDevice.discoverAllServicesAndCharacteristics();
            console.log('🔍 Services discovered');

            // Pobierz charakterystykę
            const characteristics = await this.connectedDevice.characteristicsForService(
                SERVICE_UUID
            );

            this.characteristic = characteristics.find(
                c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase()
            ) || null;

            if (!this.characteristic) {
                throw new Error('Characteristic not found');
            }

            console.log('📝 Characteristic ready');

            // Monitoruj charakterystykę (odbieraj wiadomości)
            this.characteristic.monitor((error, characteristic) => {
                if (error) {
                    console.error('Monitor error:', error);
                    return;
                }

                if (characteristic?.value) {
                    try {
                        const message = this.decodeMessage(characteristic.value);
                        console.log('📨 Received:', message);
                        this.notifyHandlers(message);
                    } catch (e) {
                        console.error('Failed to decode message:', e);
                    }
                }
            });

            // Wyślij rejestrację
            this.sendMessage({
                type: 'register',
                role: this.deviceRole || 'remote',
                timestamp: Date.now(),
            });

            this.notifyConnectionHandlers(true);

            // Monitoruj rozłączenie
            this.connectedDevice.onDisconnected((error) => {
                console.log('👋 Device disconnected');
                this.connectedDevice = null;
                this.characteristic = null;
                this.notifyConnectionHandlers(false);

                // Auto-reconnect jeśli to pilot
                if (this.deviceRole === 'remote') {
                    console.log('🔄 Attempting to reconnect...');
                    setTimeout(() => {
                        this.connectToCamera().catch(console.error);
                    }, 3000);
                }
            });

        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        }
    }

    /**
     * Rozpocznij skanowanie (dla kamery czekającej na piloty)
     */
    private startScanning() {
        if (!this.bleManager) return;

        console.log('🔍 Scanning for remotes...');

        this.scanSubscription = this.bleManager.startDeviceScan(
            null, // Skanuj wszystkie urządzenia
            { allowDuplicates: false },
            async (error, device) => {
                if (error) {
                    console.error('Scan error:', error);
                    return;
                }

                if (device && device.name?.includes('Padel-Remote')) {
                    console.log('🎮 Found remote:', device.name);

                    try {
                        await this.connectToDevice(device);
                    } catch (connectError) {
                        console.error('Failed to connect to remote:', connectError);
                    }
                }
            }
        );
    }

    /**
     * Zatrzymaj skanowanie
     */
    private stopScanning() {
        if (this.scanSubscription) {
            this.bleManager?.stopDeviceScan();
            this.scanSubscription = null;
            console.log('⏹️ Stopped scanning');
        }
    }

    /**
     * Wyślij wiadomość przez BLE
     */
    async sendMessage(message: P2PMessage): Promise<void> {
        if (!this.characteristic) {
            console.warn('⚠️ No characteristic available');
            return;
        }

        try {
            const encoded = this.encodeMessage(message);
            await this.characteristic.writeWithResponse(encoded);
            console.log('📤 Sent:', message.type);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    /**
     * Koduj wiadomość do Base64
     */
    private encodeMessage(message: P2PMessage): string {
        const json = JSON.stringify(message);

        if (Platform.OS === 'web') {
            return btoa(json);
        }

        // React Native
        return Buffer.from(json, 'utf-8').toString('base64');
    }

    /**
     * Dekoduj wiadomość z Base64
     */
    private decodeMessage(base64: string): P2PMessage {
        let json: string;

        if (Platform.OS === 'web') {
            json = atob(base64);
        } else {
            json = Buffer.from(base64, 'base64').toString('utf-8');
        }

        return JSON.parse(json);
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
     * Rozłącz
     */
    async disconnect(): Promise<void> {
        this.stopScanning();

        if (this.connectedDevice) {
            try {
                await this.connectedDevice.cancelConnection();
            } catch (error) {
                console.warn('Error disconnecting:', error);
            }
            this.connectedDevice = null;
        }

        this.characteristic = null;
        this.deviceRole = null;
        this.messageHandlers = [];
        this.connectionHandlers = [];

        console.log('👋 BLE Service disconnected');
    }

    /**
     * Sprawdź czy jest połączenie
     */
    isConnected(): boolean {
        return this.connectedDevice !== null;
    }

    /**
     * Pobierz rolę urządzenia
     */
    getRole(): 'camera' | 'remote' | null {
        return this.deviceRole;
    }
}

export default new BLEService();