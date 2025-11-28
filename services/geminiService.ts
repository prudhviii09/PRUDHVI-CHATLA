import { GoogleGenAI, Chat, GenerateContentResponse, FunctionDeclaration, Type, Tool } from "@google/genai";
import { Attachment, SystemActionCallback } from "../types";

// Ensure API key is available
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const SYSTEM_INSTRUCTION = `You are Buddy, a friendly and highly capable Windows Assistant.
You are helpful, enthusiastic, and efficient. You love helping the user control their computer.

You have deep integration with the host operating system. 
You can control applications, manage system power (shutdown, restart), adjust volume, and analyze on-screen content.

When a user asks to perform a system action:
1. Use the available tools/functions to execute the command.
2. If asked to open an app, use 'app_control'.
3. If asked to shutdown/restart, use 'system_control'.
4. If asked about system status, use 'get_system_status'.

Your persona is that of a reliable best friend. You are not a robot, you are Buddy.
When analyzing images, provide detailed technical breakdowns but keep the tone conversational.
Always confirm the action taken after calling a tool.`;

// Define Tools
const systemControlTool: FunctionDeclaration = {
  name: "system_control",
  description: "Control power states of the Windows operating system.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["shutdown", "restart", "sleep", "lock", "sign_out"],
        description: "The power action to execute."
      },
      force: {
        type: Type.BOOLEAN,
        description: "Whether to force the action."
      }
    },
    required: ["action"]
  }
};

const appControlTool: FunctionDeclaration = {
  name: "app_control",
  description: "Open, close, or manage Windows applications.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ["open", "close", "focus"],
        description: "The action to perform on the application."
      },
      appName: {
        type: Type.STRING,
        description: "The name of the application (e.g., Spotify, Chrome, Notepad)."
      }
    },
    required: ["action", "appName"]
  }
};

const mediaControlTool: FunctionDeclaration = {
  name: "media_control",
  description: "Control system volume and media playback.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        enum: ["set_volume", "mute", "unmute", "next_track", "prev_track", "play_pause"],
      },
      value: {
        type: Type.INTEGER,
        description: "Volume level percentage (0-100) if command is set_volume."
      }
    },
    required: ["command"]
  }
};

const getSystemStatusTool: FunctionDeclaration = {
  name: "get_system_status",
  description: "Get current system resource usage (CPU, RAM, Battery).",
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No params needed
  }
};

const tools: Tool[] = [{
  functionDeclarations: [
    systemControlTool, 
    appControlTool, 
    mediaControlTool, 
    getSystemStatusTool
  ]
}];

let chatSession: Chat | null = null;

// Mock execution logic for the frontend demo
const executeToolLocally = async (name: string, args: any, onAction: SystemActionCallback): Promise<any> => {
  // Notify UI
  onAction({
    toolName: name,
    args: args,
    status: 'success',
    timestamp: Date.now()
  });

  // Simulated delays and responses
  await new Promise(resolve => setTimeout(resolve, 800));

  switch (name) {
    case 'system_control':
      return { status: "success", message: `System ${args.action} sequence initiated.` };
    case 'app_control':
      return { status: "success", message: `Application '${args.appName}' ${args.action}ed successfully.` };
    case 'media_control':
      return { status: "success", message: `Media command '${args.command}' executed.` };
    case 'get_system_status':
      return { 
        cpu_load: "12%", 
        ram_usage: "8.4GB / 16GB", 
        battery: "Charging (98%)", 
        uptime: "4d 2h 15m" 
      };
    default:
      return { status: "error", message: "Unknown tool" };
  }
};

export const getChatSession = (): Chat => {
  if (!chatSession) {
    chatSession = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
      },
    });
  }
  return chatSession;
};

export const sendMessageToGemini = async (
  text: string,
  attachments: Attachment[] = [],
  onSystemAction?: SystemActionCallback
): Promise<AsyncGenerator<string, void, unknown>> => {
  const chat = getChatSession();

  // Construct initial message
  let messagePayload: any = text;
  if (attachments.length > 0) {
    const parts: any[] = [];
    if (text) parts.push({ text });
    attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
    messagePayload = parts;
  }

  // Recursive generator to handle multi-turn tool interactions
  async function* runStream(payload: any): AsyncGenerator<string, void, unknown> {
    try {
      const result = await chat.sendMessageStream({ message: payload });
      
      for await (const chunk of result) {
        // 1. Yield text if present
        if (chunk.text) {
          yield chunk.text;
        }

        // 2. Handle Function Calls
        // @google/genai SDK exposes functionCalls on the chunk
        const functionCalls = chunk.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          const functionResponses = [];
          
          for (const call of functionCalls) {
            // Execute mock logic
            const response = await executeToolLocally(call.name, call.args, onSystemAction || (() => {}));
            
            functionResponses.push({
              name: call.name,
              id: call.id, // Important to map back to the call ID
              response: { result: response }
            });
          }

          // Send function responses back to the model
          // This creates a new stream for the model's reaction to the tool result
          const toolResponseStream = runStream(functionResponses);
          for await (const toolChunk of toolResponseStream) {
            yield toolChunk;
          }
        }
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  return runStream(messagePayload);
};

export const resetChat = () => {
  chatSession = null;
};