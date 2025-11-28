import { SystemActionCallback } from "../types";

/**
 * Handles user commands locally when the internet is unavailable.
 * Uses Regex to match common system intents.
 */
export const processOfflineCommand = async (
  text: string, 
  onSystemAction: SystemActionCallback
): Promise<string> => {
  const lower = text.toLowerCase();
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 600));

  // --- System Control ---
  if (lower.match(/shut\s?down|turn off/)) {
    onSystemAction({
      toolName: 'system_control',
      args: { action: 'shutdown' },
      status: 'success',
      timestamp: Date.now()
    });
    return "I'm initiating the shutdown sequence now. Goodnight!";
  }

  if (lower.match(/restart|reboot/)) {
    onSystemAction({
      toolName: 'system_control',
      args: { action: 'restart' },
      status: 'success',
      timestamp: Date.now()
    });
    return "Restarting the system. I'll see you in a moment.";
  }

  // --- App Control ---
  const openMatch = lower.match(/open\s+(.+)/);
  if (openMatch) {
    const appName = openMatch[1].replace(/app|application|program/g, '').trim();
    onSystemAction({
      toolName: 'app_control',
      args: { action: 'open', appName },
      status: 'success',
      timestamp: Date.now()
    });
    return `Opening ${appName} for you locally.`;
  }

  // --- Media Control ---
  if (lower.includes('volume up') || lower.includes('louder')) {
    onSystemAction({
      toolName: 'media_control',
      args: { command: 'set_volume', value: 80 },
      status: 'success',
      timestamp: Date.now()
    });
    return "Turning the volume up.";
  }

  if (lower.includes('mute') || lower.includes('silence')) {
    onSystemAction({
      toolName: 'media_control',
      args: { command: 'mute' },
      status: 'success',
      timestamp: Date.now()
    });
    return "System muted.";
  }

  // --- Fallback ---
  return "I am currently offline, but I can help you with basic system commands like 'Shutdown', 'Open Calculator', or 'Mute'. Please check your internet connection for full features.";
};
