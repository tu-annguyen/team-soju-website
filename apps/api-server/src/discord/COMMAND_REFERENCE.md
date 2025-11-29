# Discord Bot Command Quick Reference

## Member Commands

### Add Member
```
/addmember ign:PlayerName [discord:@user] [rank:Gym Leader]
```
**Example:**
```
/addmember ign:tunacore discord:@tunacore rank:Elite 4
```

### Edit Member
```
/editmember ign:PlayerName [new_ign:NewName] [discord:@user] [rank:Champion]
```
**Example:**
```
/editmember ign:tunacore rank:Champion
/editmember ign:oldname new_ign:newname
```

### Delete Member
```
/deletemember ign:PlayerName
```
**Example:**
```
/deletemember ign:TestUser
```

### View Member
```
/member ign:PlayerName
```
**Example:**
```
/member ign:tunacore
```

## Shiny Commands

### Add Shiny
```
/addshiny trainer:IGN pokemon:Name pokedex_number:# encounter_type:type [encounters:#] [secret:true/false] [safari:true/false]
```
**Examples:**
```
/addshiny trainer:tunacore pokemon:Pikachu pokedex_number:25 encounter_type:single encounters:1247
/addshiny trainer:heff pokemon:Gyarados pokedex_number:130 encounter_type:fishing encounters:500 secret:true
/addshiny trainer:Cubby pokemon:Chansey pokedex_number:113 encounter_type:safari safari:true
```

### Edit Shiny
```
/editshiny shiny_id:# [pokemon:Name] [pokedex_number:#] [encounter_type:type] [encounters:#] [secret:true/false] [safari:true/false]
```
**Example:**
```
/editshiny shiny_id:42 encounters:2000 secret:true
```

### Delete Shiny
```
/deleteshiny shiny_id:#
```
**Example:**
```
/deleteshiny shiny_id:42
```

### View Shiny
```
/shiny id:#
```
**Example:**
```
/shiny id:42
```

### List Shinies
```
/shinies [trainer:IGN] [limit:#]
```
**Examples:**
```
/shinies
/shinies trainer:tunacore
/shinies limit:20
/shinies trainer:heff limit:5
```

## Stats Commands

### Leaderboard
```
/leaderboard [limit:#]
```
**Examples:**
```
/leaderboard
/leaderboard limit:20
```

### Team Stats
```
/stats
```

## Ranks Available

- Trainer (default)
- Ace Trainer
- Gym Leader
- Elite 4
- Champion

## Encounter Types

- single - Single wild encounter
- horde - Horde encounter
- safari - Safari zone
- fishing - Fishing encounter
- egg - Egg hatching
- gift - Gift Pokemon
- trade - Traded Pokemon
- event - Event Pokemon

## Tips

1. **Finding Shiny IDs**: Use `/shinies` to see a list with IDs
2. **Member Info**: `/member` shows total shinies and member ID
3. **Bulk Operations**: Add multiple shinies one at a time
4. **Filtering**: Use `/shinies trainer:name` to see one trainer's catches
5. **IDs in Responses**: All add commands return the created ID

## Common Workflows

### Adding a New Team Member
```
1. /addmember ign:NewPlayer discord:@player rank:Trainer
2. /member ign:NewPlayer  (verify creation)
```

### Recording a Shiny Catch
```
1. /addshiny trainer:PlayerName pokemon:PokemonName pokedex_number:# encounter_type:type encounters:#
2. /shinies trainer:PlayerName  (verify addition)
```

### Updating Member Rank
```
1. /editmember ign:PlayerName rank:NewRank
2. /member ign:PlayerName  (verify update)
```

### Correcting a Shiny Entry
```
1. /shinies trainer:PlayerName  (find the shiny ID)
2. /editshiny shiny_id:# encounters:CorrectNumber
3. /shiny id:#  (verify correction)
```

### Viewing Team Progress
```
1. /stats  (overall statistics)
2. /leaderboard  (top trainers)
3. /shinies limit:10  (recent catches)
```

## Error Messages

- **"Member not found"** - Check spelling of IGN
- **"Trainer not found"** - Trainer must exist before adding shinies
- **"Shiny with ID # not found"** - Use `/shinies` to find correct ID
- **"Member with this IGN already exists"** - Use `/editmember` instead

## Need Help?

- See full documentation: `server/src/discord/README.md`
- Check troubleshooting: `DISCORD_BOT_CHANGES.md`
- Verify bot is running: Check console for "Discord bot logged in"
- Check permissions: Bot needs "Use Slash Commands" permission

---

**Quick Test Commands:**
```
/stats          # Should always work if bot is connected to DB
/leaderboard    # Shows if members exist
/member ign:YourIGN  # Replace with actual member IGN
```
