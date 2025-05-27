/**
 * This utility would handle fetching and parsing the content from the PokeMMO forum
 * to extract shiny showcase information. In a real implementation, this would
 * handle scraping the forum thread and parsing the content.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

const forumUrl = 'https://forums.pokemmo.com/index.php?/topic/181636-team-soj%C3%BC-shiny-showcase/';

export interface ShinyPokemon {
  name: string;
  imageUrl: string;
  attribute: string; // Optional: denote secret or safari shinies 
}

export interface Trainer {
  name: string;
  numOT: number; // Number of shiny Pokemon owned
  shinies: ShinyPokemon[];
}

/**
 * Fetch and parse the shiny showcase forum post
 * @returns Promise<ShinyPokemon[]> Array of shiny Pokemon data
 */
export async function fetchShinyShowcase(): Promise<Trainer[]> {
  // In a real implementation, this would fetch the forum post and parse it
  // For now, we'll return mock data
  try {
    // Would use a server-side API or edge function to fetch the forum content
    // const response = await fetch('https://example.com/api/forum-parser');
    // return await response.json();
    
    const { data } = await axios.get(forumUrl);
    const $ = cheerio.load(data);

    // const contentsList = $('div[data-ipsHook="postContent"].ipsRichText').children('p');
    // return contentsList.length;

    const $showcaseContent = $('div[data-ips-hook="postContent"].ipsRichText');
    const $paragraphs = $showcaseContent.find('p');

    const trainers: Trainer[] = [];
    let currentTrainer: Trainer | null = null;

    $paragraphs.each((_, p) => {
      const $p = $(p);
      const text = $p.text().trim();

      // Check if the paragraph contains a trainer mention
      const trainerMention = $p.find('a.ipsMention').text().trim().substring(1); // Remove the '@' symbol
      if (trainerMention) {
        // If we have a current trainer, push it to the list before starting a new one
        if (currentTrainer) {
          trainers.push(currentTrainer);
        }
        currentTrainer = { name: trainerMention, numOT: 0, shinies: [] };
      }

      // Check for shiny Pokemon mentions
      const shinyCountMatch = text.match(/(\(\d+\))/);
      const shinyCount = shinyCountMatch ? shinyCountMatch[1].substring(1, shinyCountMatch[1].length - 1) : '0';
      if (shinyCountMatch && currentTrainer) {
        currentTrainer.numOT += parseInt(shinyCount, 10);
      }

      // Check for shiny images
      const shinyImages = $p.find('img');
      if (shinyImages.length > 0 && currentTrainer) {
        for (let i = 0; i < shinyImages.length; i++) {
          const $img = $(shinyImages[i]);
          const imageUrl = $img.attr('src') || '';
          let rawName = $img.attr('alt') || '';
          if (!rawName && imageUrl) {
            rawName = imageUrl.split('/').pop() || '';
          }
          // Normalize: take first word before space, period or hyphen, capitalize first letter
          let pokemonName = rawName.split(/[ .-]/)[0];
          pokemonName = pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1).toLowerCase();

          // Default attribute
          let attribute = '';

          // Check next image for secret/safari indicator
          const $nextImg = $(shinyImages[i + 1]);
          const nextSrc = $nextImg.attr('src') || '';
          if (nextSrc.includes('secret_shiny_particle')) {
            attribute = 'secret';
            i++; // Skip the indicator image in the next loop
          } else if (nextSrc.includes('ut7SAgH') || nextSrc.includes('a9f43b3c7e1e30f4ca87500cabf014b6')) {
            attribute = 'safari';
            i++; // Skip the indicator image in the next loop
          }

          // Only add if not a particle image itself
          if (
            pokemonName !== 'Secret_shiny_particle' &&
            pokemonName !== 'Ut7sagh' &&
            pokemonName !== 'Image'
          ) {
            currentTrainer.shinies.push({ name: pokemonName, imageUrl, attribute });
          }
        }
      }
    });

    if (currentTrainer) {
      trainers.push(currentTrainer);
    }

    // for (let trainer of trainers) {
      // for (let shiny of trainer.shinies) {
        // console.log(`Trainer: ${trainer.name}, Shiny: ${shiny.name}, Attribute: ${shiny.attribute}`);
      // }
    // }

    return trainers;
  } catch (error) {
    console.error('Error fetching shiny showcase data:', error);
    return [];
  }
}