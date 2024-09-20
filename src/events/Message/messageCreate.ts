import AI_Config from "@src/config/AI";
import db from "@src/databse/localdb";
import { ActionRowBuilder, ButtonBuilder, type Events } from "discord.js";
import {
  getAIResponse,
  removeButtons_LastRespose,
  setButtons,
  setSystemMessages,
} from "../../utils/llm";
import keys from "@src/databse/keys";
import type { eventExecute } from "@src/@types/event";
import AI from "@src/config/AI";

const messageCreate: eventExecute<Events.MessageCreate> = async (message) => {
  try {
    // Ignore bot messages, system messages, and non-guild messages
    if (message.author.bot || !message.cleanContent || message.system) return;
    if (!message.guild || !message.member) return;

    // Fetch AI channels for the guild
    const ai_channels = await db.get(`${keys.AI}:Guild:${message.guildId}`) || [];
    
    // Check if the message is in any of the AI channels
    if (ai_channels.includes(message.channelId) && message.mentions.has(message.client.user)) {

      let cleanContent = message.cleanContent;
      const key = `AI:${message.author.id}`;
      const author_chat = await db.get(key) ?? [];
      setSystemMessages(author_chat, { message });

      // Include reference message if applicable
      if (message.reference?.messageId) {
        const msg = message.channel.messages.cache.get(message.reference.messageId);
        if (msg?.content)
          cleanContent += `\n[Reference Message]: {{ message: ${msg.content}, author: ${msg.author.username} }}`;
      }

      // Prepare the prompt for AI response
      const prompt = [
        ["system", AI_Config.Prompt],
        ...author_chat,
      ] as unknown as [[string, string]];

      message.channel.sendTyping();

      // Get AI response
      const response = await getAIResponse(cleanContent, prompt, {
        author: message.member,
      });

      // Handle AI response errors
      if (response.error || !response.send) {
        const delete_row = new ActionRowBuilder().setComponents([
          new ButtonBuilder()
            .setLabel("Reset")
            .setStyle(2)
            .setEmoji("979818265582899240")
            .setCustomId(`AI:Delete:${message.author.id}`),
        ]);
        return message
          .reply({
            content: response.error as string,
            components: [delete_row] as any,
          })
          .then((msg: { delete: () => void }) => {
            setTimeout(() => msg.delete(), 5000);
          });
      }

      // Format the content to send back
      const content =
        response.send.content?.length >= 1920
          ? `${response.send?.content.slice(0, 1997)}...`
          : response.send?.content.toString();

      const msg = await message.reply({ content });

      // Set buttons for interaction
      setButtons(msg, [...prompt, ["human", message.cleanContent]] as any, {
        author: message.member,
      });
      removeButtons_LastRespose(message, msg);

      // Update the conversation history in the database
      const conversation = [
        ...author_chat.slice(-AI.Max_Conversation_History),
        ["human", message.cleanContent],
        ["ai", content],
      ];
      db.set(key, conversation);
    }
  } catch (E) {
    console.log(E);
  }
};

export default messageCreate;
