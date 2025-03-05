import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { toast } from 'react-hot-toast';

export class WalletConnect {
  private client: SignClient | undefined;
  private session: SessionTypes.Struct | undefined;
  private topic: string | undefined;
  private address: string | undefined;
  private onConnectionChange: ((isConnected: boolean, address?: string) => void)[] = [];
  private initPromise: Promise<void>;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize asynchronously and store the promise
    this.initPromise = this.init();
  }

  private async init() {
    try {
      await this.initClient();
      await this.restorePreviousSession();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize WalletConnect:", error);
      this.isInitialized = true; // Still mark as initialized even if there's an error
    }
  }

  // Wait for initialization to complete
  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async restorePreviousSession() {
    if (!this.client) return;

    try {
      const sessions = this.client.session.getAll();
      for (const session of sessions) {
        try {
          if (this.client.session.keys.includes(session.topic)) {
            this.session = session;
            this.topic = session.topic;
            const address = await this.getAddress();
            if (address) {
              this.setupEventListeners();
              this.notifyConnectionChange(true, address);
              console.log({msg: "Session restored successfully", address});
              return; // Successfully restored a session
            }
          }
        } catch (e) {
          console.warn("Failed to restore specific session:", e);
          // Continue to next session
        }
      }
      
      // If we get here, no valid session was found
      this.clearState();
    } catch (error) {
      console.error("Failed to restore session:", error);
      this.clearState();
    }
  }

  private clearState() {
    this.session = undefined;
    this.topic = undefined;
    this.address = undefined;
    this.notifyConnectionChange(false);
  }

  private async initClient(): Promise<SignClient | undefined> {
    if (this.client) return this.client;

    try {
      this.client = await SignClient.init({
        logger: "error",
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
        metadata: {
          name: "Streaming Dashboard",
          description: "Easily view, create, and manage CAT streams on Chia",
          url: "https://streaming.fireacademy.io",
          icons: ["https://avatars.githubusercontent.com/u/37784886"],
        },
      });

      this.setupEventListeners();
      return this.client;
    } catch (e) {
      console.error("Failed to initialize WalletConnect client:", e);
      return undefined;
    }
  }

  private setupEventListeners() {
    if (!this.client) return;
    // Add listeners
    this.client.on("session_delete", this.handleSessionDelete);
    this.client.on("session_expire", this.handleSessionExpire);
    this.client.on("session_update", this.handleSessionUpdate);
  }

  private handleSessionDelete = () => {
    this.disconnect();
  };

  private handleSessionExpire = () => {
    this.disconnect();
  };

  private handleSessionUpdate = async () => {
    // Refresh the address when session is updated
    if (this.topic) {
      const address = await this.getAddress();
      this.notifyConnectionChange(!!address, address);
    }
  };

  public onConnect(callback: (isConnected: boolean, address?: string) => void) {
    this.onConnectionChange.push(callback);
    // Call immediately with current state if initialized
    if (this.isInitialized) {
      callback(this.isConnected(), this.address);
    }
    return () => {
      this.onConnectionChange = this.onConnectionChange.filter(cb => cb !== callback);
    };
  }

  private notifyConnectionChange(isConnected: boolean, address?: string) {
    this.address = address;
    console.log({ func: "notifyConnectionChange", address, isConnected })
    this.onConnectionChange.forEach(callback => callback(isConnected, address));
  }

  async connect(): Promise<{success: boolean, uri?: string}> {
    try {
      const client = await this.initClient();
      if (!client) return { success: false };

      // If already connected, disconnect first
      if (this.isConnected()) {
        await this.disconnect();
      }

      const namespaces = {
        chia: {
          methods: ['chia_getAddress'],
          chains: ["chia:mainnet"],
          events: [],
        },
      };

      const { uri, approval } = await client.connect({
        requiredNamespaces: namespaces,
      });

      if (!uri) {
        return { success: false };
      }

      // Return the URI immediately so the QR code can be shown
      const result = { success: true, uri };

      // Handle the approval in the background
      approval().then(async (session) => {
        this.session = session;
        this.topic = session.topic;
        
        const address = await this.getAddress();
        this.notifyConnectionChange(true, address);
        toast.success('Connected to wallet!');
      }).catch((error) => {
        console.error("Connection approval failed:", error);
        toast.error('Failed to connect wallet');
        this.clearState();
      });

      return result;
    } catch (error: any) {
      console.error("Connection failed:", error);
      toast.error('Failed to connect wallet');
      return { success: false };
    }
  }

  async disconnect() {
    if (this.client && this.topic) {
      try {
        await this.client.disconnect({
          topic: this.topic,
          reason: {
            code: 6000,
            message: "User disconnected.",
          },
        });
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
    }

    this.clearState();
    toast.success('Disconnected from wallet');
  }

  async getAddress(): Promise<string | undefined> {
    if (!this.client || !this.topic) {
      return undefined;
    }

    try {
      const response = await this.client.request<{address: string}>({
        topic: this.topic,
        chainId: "chia:mainnet",
        request: {
          method: "chia_getAddress",
          params: {},
        },
      });

      return response.address;
    } catch (error: any) {
      console.error("Failed to get address:", error);
      return undefined;
    }
  }

  isConnected(): boolean {
    return !!this.session && !!this.topic;
  }

  getActiveAddress(): string | undefined {
    return this.address;
  }
} 