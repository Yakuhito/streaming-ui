import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { toast } from 'react-hot-toast';

export class WalletConnect {
  private client: SignClient | undefined;
  private session: SessionTypes.Struct | undefined;
  private topic: string | undefined;
  private address: string | undefined;

  constructor() {
    this.initFromLocalStorage();
  }

  private initFromLocalStorage() {
    // Check if we have a session in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('wc') && key.endsWith('//session')) {
        const sessions = JSON.parse(localStorage.getItem(key)!);
        if (sessions && sessions.length > 0) {
          // Take the most recent session
          const lastSession = sessions[sessions.length - 1];
          this.topic = lastSession.topic;
          this.session = lastSession;
          // Attempt to reconnect
          this.initClient().then(() => {
            if (this.client && this.topic) {
              toast.success('Reconnected to wallet');
              this.getAddress(); // Update the address
            }
          });
          break;
        }
      }
    }
  }

  private async initClient(): Promise<SignClient | undefined> {
    if (this.client) return this.client;

    try {
      this.client = await SignClient.init({
        logger: "info",
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
        metadata: {
          name: "Streaming Dashboard",
          description: "Easily view, create, and manage CAT streams on Chia",
          url: "https://streaming.fireacademy.io",
          icons: ["https://avatars.githubusercontent.com/u/37784886"],
        },
      });

      // Set up event listeners
      this.client.on("session_delete", () => {
        this.disconnect();
      });

      return this.client;
    } catch (e) {
      toast.error(`Failed to initialize WalletConnect: ${e}`);
      return undefined;
    }
  }

  async connect(): Promise<boolean> {
    try {
      const client = await this.initClient();
      if (!client) return false;

      const namespaces = {
        chia: {
          methods: [
            'chia_getAddress',
          ],
          chains: ["chia:mainnet"],
          events: [],
        },
      };

      const { uri, approval } = await client.connect({
        requiredNamespaces: namespaces,
      });

      if (uri) {
        // Here you would show the QR code using your preferred QR code library
        // For example, using qrcode.react:
        // setQrCodeData(uri);
        toast.loading('Please scan the QR code with your Sage wallet');
      }

      const session = await approval();
      this.session = session;
      this.topic = session.topic;
      
      toast.success('Connected to wallet!');
      await this.getAddress();
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to connect: ${error.message}`);
      return false;
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

    // Clear local state
    this.session = undefined;
    this.topic = undefined;
    this.address = undefined;
    toast.success('Disconnected from wallet');
  }

  async getAddress(): Promise<string | undefined> {
    if (!this.client || !this.topic) {
      toast.error('Not connected to wallet');
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

      this.address = response.address;
      return this.address;
    } catch (error: any) {
      toast.error(`Failed to get address: ${error.message}`);
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