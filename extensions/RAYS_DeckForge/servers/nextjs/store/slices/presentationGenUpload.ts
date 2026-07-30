import { PresentationConfig } from "@/app/(presentation-generator)/upload/type";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface PresentationGenUploadState {
  config: PresentationConfig | null;
  
  files: any;

}

const initialState: PresentationGenUploadState = {
  config: null,
  files: [],
};

export const presentationGenUploadSlice = createSlice({
  name: "pptGenUpload",
  initialState,
  reducers: {
    setPptGenUploadState: (
      state,
      action: PayloadAction<Partial<PresentationGenUploadState>>
    ) => {
      const payload = action.payload;
      state.config = payload.config!;
      state.files = payload.files!;
    },
   
  },
});

export const { setPptGenUploadState, } =
  presentationGenUploadSlice.actions;
export default presentationGenUploadSlice.reducer;
