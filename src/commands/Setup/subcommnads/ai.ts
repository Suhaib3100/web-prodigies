import keys from '@src/databse/keys';
import db from '@src/databse/localdb';
import type { ChatInputCommandInteraction } from 'discord.js';

export default async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply();
  const channel = interaction.options.getChannel('channel');
  if (!channel?.id) return;

  // Fetch existing AI channels
  const existingChannels = await db.get(`${keys.AI}:Guild:${interaction.guildId}`) || [];

  // Add the new channel to the list
  const updatedChannels = [...existingChannels, channel?.id];

  // Store the updated list of channels in the database
  await db.set(`${keys.AI}:Guild:${interaction.guildId}`, updatedChannels);

  // Optional: Set the slow mode for the AI channel
  interaction.guild?.channels.cache.get(channel?.id)?.edit({
    rateLimitPerUser: 10,
  });

  await interaction.editReply(
    `✅ Successfully added <#${channel?.id}> to the AI chat channels.`,
  );
};
