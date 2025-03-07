import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SessionTypes } from "@walletconnect/types";

export interface WalletState {
  address: string | undefined;
  session: SessionTypes.Struct | undefined;
  qrUri: string | null;
  isInitialized: boolean;
}

const initialState: WalletState = {
  address: undefined,
  session: undefined,
  qrUri: null,
  isInitialized: false,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    initialize: (state, action: PayloadAction<{
      session?: SessionTypes.Struct,
      address?: string
    }>) => {
      state.session = action.payload.session;
      state.address = action.payload.address;
      state.isInitialized = true;
    },
    generateQrCode: (state, action: PayloadAction<string>) => {
      console.log({ wallet_connect_uri: action.payload })
      state.qrUri = action.payload;
    },
    disconnect: (state) => {
      state.session = undefined;
      state.address = undefined;
      state.qrUri = null;
    },
  },
});

export const { initialize, generateQrCode, disconnect } = walletSlice.actions;

export default walletSlice.reducer; 