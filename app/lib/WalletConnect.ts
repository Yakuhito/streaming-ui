import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";
import { toast } from 'react-hot-toast';
import { store } from '../redux/store';
import { initialize, generateQrCode, disconnect } from '../redux/walletSlice';

export class WalletConnect {
  private client: SignClient | undefined;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    try {
      await this.initClient();
      await this.restorePreviousSession();
    } catch (error) {
      console.error("Failed to initialize WalletConnect:", error);
      store.dispatch(initialize({}));
    }
  }

  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async restorePreviousSession() {
    if (!this.client) {
      console.log("No WalletConnect client available during session restoration");
      store.dispatch(initialize({}));
      return;
    }

    try {
      const sessions = this.client.session.getAll();
      console.log("Found existing sessions:", sessions.length);
      
      for (const session of sessions) {
        try {
          console.log("Checking session:", {
            topic: session.topic,
            isKeyIncluded: this.client.session.keys.includes(session.topic)
          });
          
          if (this.client.session.keys.includes(session.topic)) {
            console.log("Valid session found, attempting to get address");
            const address = await this.getAddressFromSession(session);
            console.log({ restored_address: address })
            if (address) {
              this.setupEventListeners();
              store.dispatch(initialize({ session, address }));
              console.log({msg: "Session restored successfully", address, topic: session.topic});
              return;
            } else {
              console.log("Failed to get address from session");
            }
          }
        } catch (e) {
          console.warn("Failed to restore specific session:", e);
        }
      }
      
      // If we get here, no valid session was found
      console.log("No valid sessions found during restoration");
      store.dispatch(initialize({}));
    } catch (error) {
      console.error("Failed to restore session:", error);
      store.dispatch(initialize({}));
    }
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
    this.client.on("session_delete", this.handleSessionDelete);
    this.client.on("session_expire", this.handleSessionExpire);
    this.client.on("session_update", this.handleSessionUpdate);
  }

  private handleSessionDelete = () => {
    this.disconnectWallet();
  };

  private handleSessionExpire = () => {
    this.disconnectWallet();
  };

  private handleSessionUpdate = async () => {
    const state = store.getState();
    if (state.wallet.session?.topic) {
      const address = await this.getAddressFromSession(state.wallet.session);
      if (address) {
        store.dispatch(initialize({ session: state.wallet.session, address }));
      }
    }
  };

  async connectWallet(): Promise<boolean> {
    try {
      const client = await this.initClient();
      if (!client) return false;

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
        console.log("no uri :(")
        return false;
      }

      store.dispatch(generateQrCode(uri));

      try {
        const session = await approval();
        const address = await this.getAddressFromSession(session);
        if (address) {
          store.dispatch(initialize({ session, address }));
          toast.success('Connected to wallet!');
          return true;
        }
      } catch (error) {
        console.error("Connection approval failed:", error);
        toast.error('Failed to connect wallet');
        store.dispatch(disconnect());
      }

      return false;
    } catch (error: any) {
      console.error("Connection failed:", error);
      toast.error('Failed to connect wallet');
      return false;
    }
  }

  private async getAddressFromSession(session: SessionTypes.Struct): Promise<string | undefined> {
    if (!this.client) return undefined;

    try {
      console.log("Requesting address for session:", session.topic);
      const response = await this.client.request<{address: string}>({
        topic: session.topic,
        chainId: "chia:mainnet",
        request: {
          method: "chia_getAddress",
          params: {},
        },
      });

      console.log("Got address response:", response);
      return response.address;
    } catch (error: any) {
      console.error("Failed to get address:", error);
      return undefined;
    }
  }

  async sendCat(session: SessionTypes.Struct, assetId: string, address: string, amount: string, fee: string, memos: string[]): Promise<boolean> {
    if (!this.client) return false;

    try {
      const response = await this.client.request<{address: string}>({
        topic: session.topic,
        chainId: "chia:mainnet",
        request: {
          method: "chia_send",
          params: {
            asset_id: assetId,
            address: address,
            amount: amount,
            fee: fee,
            memos: memos,
          },
        },
      });

      console.log({ response });

      return true;
    } catch (error: any) {
      console.error("Failed to send cat:", error);
      return false;
    }
  }

  async disconnectWallet() {
    const state = store.getState();
    if (this.client && state.wallet.session?.topic) {
      try {
        await this.client.disconnect({
          topic: state.wallet.session.topic,
          reason: {
            code: 6000,
            message: "User disconnected.",
          },
        });
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
    }

    store.dispatch(disconnect());
    toast.success('Disconnected from wallet');
  }

  isConnected(): boolean {
    return !!store.getState().wallet.address;
  }

  getActiveAddress(): string | undefined {
    return store.getState().wallet.address;
  }
} 