"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchShinyShowcase = fetchShinyShowcase;
/**
 * This utility would handle fetching and parsing the content from the PokeMMO forum
 * to extract shiny showcase information. In a real implementation, this would
 * handle scraping the forum thread and parsing the content.
 */
var axios_1 = require("axios");
var cheerio = require("cheerio");
var forumUrl = 'https://forums.pokemmo.com/index.php?/topic/195298-team-soj%C3%BC-shiny-showcase/';
/**
 * Fetch and parse the shiny showcase forum post
 * @returns Promise<ShinyPokemon[]> Array of shiny Pokemon data
 */
function fetchShinyShowcase() {
    return __awaiter(this, void 0, void 0, function () {
        var data, $_1, $showcaseContent, $paragraphs, trainers_1, currentTrainer_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1.default.get(forumUrl)];
                case 1:
                    data = (_a.sent()).data;
                    $_1 = cheerio.load(data);
                    $showcaseContent = $_1('div[data-ips-hook="postContent"].ipsRichText');
                    $paragraphs = $showcaseContent.find('p');
                    trainers_1 = [];
                    currentTrainer_1 = null;
                    $paragraphs.each(function (_, p) {
                        var $p = $_1(p);
                        var text = $p.text().trim();
                        // Check if the paragraph contains a trainer mention
                        var trainerMention = $p.find('a.ipsMention').text().trim().substring(1); // Remove the '@' symbol
                        if (trainerMention) {
                            // If we have a current trainer, push it to the list before starting a new one
                            if (currentTrainer_1) {
                                trainers_1.push(currentTrainer_1);
                            }
                            currentTrainer_1 = { name: trainerMention, numOT: 0, shinies: [] };
                        }
                        // Check for shiny Pokemon mentions
                        var shinyCountMatch = text.match(/(\(\d+\))/);
                        var shinyCount = shinyCountMatch ? shinyCountMatch[1].substring(1, shinyCountMatch[1].length - 1) : '0';
                        if (shinyCountMatch && currentTrainer_1) {
                            currentTrainer_1.numOT += parseInt(shinyCount, 10);
                        }
                        // Check for shiny images
                        var shinyImages = $p.find('img');
                        if (shinyImages.length > 0 && currentTrainer_1) {
                            for (var i = 0; i < shinyImages.length; i++) {
                                var $img = $_1(shinyImages[i]);
                                var imageUrl = $img.attr('src') || '';
                                var rawName = $img.attr('alt') || '';
                                if (!rawName && imageUrl) {
                                    rawName = imageUrl.split('/').pop() || '';
                                }
                                // Normalize: take first word before space, period or hyphen, capitalize first letter
                                var pokemonName = rawName.split(/[ .-]/)[0];
                                pokemonName = pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1).toLowerCase();
                                // Default attribute
                                var attribute = '';
                                // Check next image for secret/safari indicator
                                var $nextImg = $_1(shinyImages[i + 1]);
                                var nextSrc = $nextImg.attr('src') || '';
                                if (nextSrc.includes('secret_shiny_particle')) {
                                    attribute = 'secret';
                                    i++; // Skip the indicator image in the next loop
                                }
                                else if (nextSrc.includes('ut7SAgH') || nextSrc.includes('a9f43b3c7e1e30f4ca87500cabf014b6') || nextSrc.includes('safariball')) {
                                    attribute = 'safari';
                                    i++; // Skip the indicator image in the next loop
                                }
                                // Only add if not a particle image itself
                                if (pokemonName !== 'Secret_shiny_particle' &&
                                    pokemonName !== 'Ut7sagh' &&
                                    pokemonName !== 'Image' &&
                                    pokemonName !== 'Safari') {
                                    currentTrainer_1.shinies.push({ name: pokemonName, imageUrl: imageUrl, attribute: attribute });
                                }
                            }
                        }
                    });
                    if (currentTrainer_1) {
                        trainers_1.push(currentTrainer_1);
                    }
                    // for (let trainer of trainers) {
                    // for (let shiny of trainer.shinies) {
                    // console.log(`Trainer: ${trainer.name}, Shiny: ${shiny.name}, Attribute: ${shiny.attribute}`);
                    // }
                    // }
                    return [2 /*return*/, trainers_1];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error fetching shiny showcase data:', error_1);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
