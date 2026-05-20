export type IOpenRouterModel =
  | 'qwen/qwen3-235b-a22b:free'
  | 'meta-llama/llama-3.3-70b-instruct:free'
  | 'google/gemma-3-27b-it:free';

export interface IOpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IOpenRouterRequest {
  model: IOpenRouterModel;
  messages: IOpenRouterMessage[];
}

export interface IOpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: IOpenRouterMessage;
  }[];
}

export interface IFusionBrainGenerationResult {
  imageBase64: string;
  censored: boolean;
}
