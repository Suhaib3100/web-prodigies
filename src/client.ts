import { Client as DiscordClient, Message, REST, Routes } from "discord.js";
import { events } from "./events";
import { commands } from "./commands";
import type { env } from "./@types/env";
import { integration_context, integration_types } from "./utils/constants";
import { ChatGroq } from "@langchain/groq";
import { validateGroqApiKey } from "@utils/core";

export class Client extends DiscordClient {
  env: env;
  llm!: ChatGroq;
  constructor(env: env) {
    super({
      allowedMentions: {
        parse: ["everyone", "roles", "users"],
      },
      intents: [
        "GuildMessages",
        "Guilds",
        "MessageContent",
        "GuildMessageTyping",
      ],
    });
    this.env = env;
    this.llm = new ChatGroq({
      apiKey: this.env.LLM_API,
      cache: true,
      temperature: 0.8,
      model: "llama3-8b-8192",
      maxTokens: 256,
      onFailedAttempt: (error) => {
        console.log(error);
        return "Request failed! try again later";
      },
      maxConcurrency: 5,
      maxRetries: 5,
    });
  }

  async start() {
    try {
      await this.login(this.env.DISCORD_BOT_TOKEN);
      const ai_response = await validateGroqApiKey(this.env.LLM_API);
      if (!ai_response) {
        return {
          error: new Error("Invalid API key"),
        };
      }

      // Add message listener for mentions
      this.on('messageCreate', async (message: Message) => {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Check if the bot was mentioned in the message
        if (message.mentions.has(this.user!)) {
          // Respond to the message (you can modify this part)
          await message.reply("Hello! You mentioned me. How can I help you?");
        }
      });

      return {
        error: false,
      };
    } catch (e) {
      return {
        error: e as Error,
      };
    }
  }

  async loadEvents() {
    for (const event of events) {
      try {
        if (event?.runOnce) this.once(event.name, event.execute);
        else this.on(event.name, event.execute);
      } catch (e) {
        console.log(e);
      }
    }
  }

  async deployCommands() {
    const data = commands
      .filter((cmd) => cmd?.slash?.enabled)
      .map((command: command) => {
        const cmd = {
          name: command.name,
          description: command.description,
          options: command.slash?.options,
          defaultMemberPermissions: command.permissions?.user,
          context: command.slash?.contexts?.map(
            (con) => integration_context[con]
          ),
          integration_types: command.slash?.integration_types?.map(
            (type) => integration_types[type]
          ),
        };
        return cmd;
      });

    console.log(
      `Deploying ${data.length} command${commands.length === 1 ? "" : "s"}...`
    );

    const rest = new REST({ version: "10" }).setToken(
      this.env.DISCORD_BOT_TOKEN
    );
    await rest.put(Routes.applicationCommands(this.env.DISCORD_CLIENT_ID), {
      body: data,
    });

    console.log(
      `Successfully deployed ${commands.length} command${commands.length === 1 ? "" : "s"}!`
    );
  }
}