const gameDiskData = [
  {
    _id: "1",
    sideA: [
      { gameName: "1942", rating: 3 },
    ],
    sideB: [{ gameName: "Parallax", rating: 5 }],
  },
  {
    _id: "2",
    sideA: [
      { gameName: "Acrojet", rating: 5 },
      { gameName: "Alcazar", rating: 5 },
    ],
    sideB: [{ gameName: "Airborne Ranger", rating: 5 }],
  },
  {
    _id: "3",
    sideA: [{ gameName: "Aliens", rating: 5 }],
    sideB: [{ gameName: "Fast Hackem", rating: 5 }],
  },
  {
    _id: "4",
    sideA: [
      { gameName: "Antiriad", rating: 5 },
      { gameName: "Sirius", rating: 5 },
      { gameName: "Hard Hat Mack", rating: 5 },
      { gameName: "Archon II", rating: 5 },
    ],
    sideB: [{ gameName: "Destroyer", rating: 5 }],
  },
  {
    _id: "5",
    sideA: [
      { gameName: "Battlezone", rating: 5 },
      { gameName: "Biliards", rating: 5 },
      { gameName: "Break Dance", rating: 5 },
      { gameName: "Fort Apocalypse", rating: 5 },
      { gameName: "Jawbreaker", rating: 5 },
      { gameName: "Orelmine", rating: 5 },
      { gameName: "Polopos", rating: 5 },
      { gameName: "Quix", rating: 5 },
      { gameName: "Robotron", rating: 5 },
    ],
    sideB: [
      { gameName: "BlackHawk", rating: 5 },
      { gameName: "Khafka", rating: 5 },
      { gameName: "Krypton", rating: 5 },
      { gameName: "Megahawk", rating: 5 },
      { gameName: "Quest For Tires", rating: 5 },
      { gameName: "Soccer", rating: 5 },
      { gameName: "Toy Bizzare", rating: 5 },
    ],
  },
  {
    _id: "6",
    sideA: [
      { gameName: "Centipede", rating: 5 },
      { gameName: "Dig Dug", rating: 5 },
      { gameName: "Donkey Kong", rating: 5 },
      { gameName: "Frogger", rating: 5 },
      { gameName: "Jungle Hunt", rating: 5 },
      { gameName: "Monster Smash", rating: 5 },
      { gameName: "Moon Patrol", rating: 5 },
      { gameName: "Pac Man", rating: 5 },
      { gameName: "Qbert", rating: 5 },
      { gameName: "Ski", rating: 5 },
    ],
    sideB: [
      { gameName: "Galaxians", rating: 5 },
      { gameName: "James Bond", rating: 5 },
      { gameName: "Mario", rating: 5 },
      { gameName: "Montezuma Revenge", rating: 5 },
      { gameName: "Ms Pac Man", rating: 5 },
      { gameName: "StarTrek", rating: 5 },
      { gameName: "Star Wars", rating: 5 },
      { gameName: "Super Zaxxon", rating: 5 },
    ],
  },
  {
    _id: "7",
    sideA: [{ gameName: "Silent Service", rating: 5 }],
    sideB: [
      { gameName: "One On One", rating: 5 },
      { gameName: "Park Patrol", rating: 5 },
      { gameName: "Blue Max", rating: 5 },
    ],
  },
  {
    _id: "8",
    sideA: [{ gameName: "Aussie Games", rating: 5 }],
    sideB: [],
  },
  {
    _id: "9",
    sideA: [
      { gameName: "Aztec Challenge", rating: 5 },
      { gameName: "Rambo", rating: 5 },
      { gameName: "Cobra", rating: 5 },
      { gameName: "Popeye", rating: 5 },
    ],
    sideB: [
      { gameName: "Cobra", rating: 5 },
      { gameName: "Deluxe Paint", rating: 5 },
      { gameName: "Bomb Jack", rating: 5 },
      { gameName: "Crazy Joe", rating: 5 },
      { gameName: "Moon Shuttle", rating: 5 },
    ],
  },
  {
    _id: "10",
    sideA: [{ gameName: "Batman", rating: 5 }],
    sideB: [],
  },

  // Disk 11 in this sheet had sides swapped/typoed; normalized to your canonical set:
  {
    _id: "11",
    sideA: [
      { gameName: "Beach Head I", rating: 5 },
      { gameName: "Goonies", rating: 5 },
    ],
    sideB: [
      { gameName: "Beach Head II", rating: 5 },
      { gameName: "Mickie", rating: 5 },
    ],
  },

  {
    _id: "12",
    sideA: [
      { gameName: "Bop n' Wrestling", rating: 5 },
      { gameName: "Rambo", rating: 5 },
    ],
    sideB: [{ gameName: "Scarabeus", rating: 5 }],
  },
  {
    _id: "13",
    sideA: [{ gameName: "Borrowed Time", rating: 5 }],
    sideB: [],
  },
  {
    _id: "14",
    sideA: [
      { gameName: "Express Raider", rating: 5 },
      { gameName: "Ninja", rating: 5 },
    ],
    sideB: [
      { gameName: "Thanatos", rating: 5 },
      { gameName: "Enduro racer", rating: 5 },
      { gameName: "Auf Wiedersehen Monty", rating: 5 },
      { gameName: "Tribbles", rating: 5 },
    ],
  },
  {
    _id: "15",
    sideA: [{ gameName: "Carmen San Diego", rating: 5 }],
    sideB: [{ gameName: "Delta", rating: 5 }],
  },
  {
    _id: "16",
    sideA: [{ gameName: "CHESSMASTER 2000", rating: 5 }],
    sideB: [
      { gameName: "Dino Eggs", rating: 5 },
      { gameName: "Rambo", rating: 5 },
      { gameName: "Zaxxon", rating: 5 },
      { gameName: "Gyruss", rating: 5 },
    ],
  },
  {
    _id: "17",
    sideA: [
      { gameName: "Commando II", rating: 5 },
      { gameName: "Max Headroom", rating: 5 },
      { gameName: "Drink and Drown", rating: 5 },
    ],
    sideB: [
      { gameName: "Frogger 2", rating: 5 },
      { gameName: "Hero", rating: 5 },
      { gameName: "Boulder Dash", rating: 5 },
      { gameName: "Choplifter", rating: 5 },
      { gameName: "Sammy Lightfoot", rating: 5 },
      { gameName: "Breakstreet", rating: 5 },
      { gameName: "Bagitman", rating: 5 },
    ],
  },
  {
    _id: "18",
    sideA: [
      { gameName: "Commando II", rating: 5 },
      { gameName: "Max Headroom", rating: 5 },
      { gameName: "Drink and Drown", rating: 5 },
    ],
    sideB: [{ gameName: "Street Sports Baseball", rating: 5 }],
  },
  {
    _id: "19",
    sideA: [
      { gameName: "Commando", rating: 5 },
      { gameName: "One On One", rating: 5 },
      { gameName: "Green Beret", rating: 5 },
    ],
    sideB: [{ gameName: "The Living Daylights", rating: 5 }],
  },
  {
    _id: "20",
    sideA: [{ gameName: "Computer People1", rating: 5 }],
    sideB: [],
  },
  {
    _id: "21",
    sideA: [{ gameName: "Curse of the Azure Bonds", rating: 5 }],
    sideB: [],
  },
  {
    _id: "22",
    sideA: [{ gameName: "Defender of The Crown", rating: 5 }],
    sideB: [],
  },
  {
    _id: "23",
    sideA: [{ gameName: "Disector", rating: 5 }],
    sideB: [{ gameName: "Bullseye", rating: 5 }],
  },

  // Disk 24 in sheet differed from your canonical; kept as provided in this sheet:
  {
    _id: "24",
    sideA: [{ gameName: "Double Dragon", rating: 5 }],
    sideB: [{ gameName: "Side Arms", rating: 5 }],
  },

  {
    _id: "25",
    sideA: [{ gameName: "Dragons Lair 1", rating: 5 }],
    sideB: [{ gameName: "Dragons Lair 2", rating: 5 }],
  },
  {
    _id: "26",
    sideA: [{ gameName: "Elite with save disk", rating: 5 }],
    sideB: [],
  },
  {
    _id: "27",
    sideA: [
      { gameName: "Exploding Fist", rating: 5 },
      { gameName: "Airwolf", rating: 5 },
      { gameName: "Pitstop 2", rating: 5 },
    ],
    sideB: [
      { gameName: "Spy vs Spy", rating: 5 },
      { gameName: "F15 Strike Eagle", rating: 5 },
      { gameName: "Ghost N Goblins", rating: 5 },
    ],
  },
  {
    _id: "28",
    sideA: [{ gameName: "F18 Hornet", rating: 5 }],
    sideB: [{ gameName: "Gauntlet", rating: 5 }],
  },
  {
    _id: "29",
    sideA: [{ gameName: "Fast Tracks", rating: 5 }],
    sideB: [
      { gameName: "Sabre Wulf", rating: 5 },
      { gameName: "Underwurlde", rating: 5 },
      { gameName: "Gery The Germ", rating: 5 },
    ],
  },
  {
    _id: "30",
    sideA: [{ gameName: "GI Joe", rating: 5 }],
    sideB: [],
  },
  {
    _id: "31",
    sideA: [{ gameName: "Gun Smoke", rating: 5 }],
    sideB: [],
  },
  {
    _id: "32",
    sideA: [{ gameName: "Gunship", rating: 5 }],
    sideB: [],
  },
  {
    _id: "33",
    sideA: [{ gameName: "Hardball", rating: 5 }],
    sideB: [
      { gameName: "Commando", rating: 5 },
      { gameName: "Gyruss", rating: 5 },
      { gameName: "Ghost N Goblins", rating: 5 },
      { gameName: "Mario Bros", rating: 5 },
    ],
  },
  {
    _id: "34",
    sideA: [
      { gameName: "Hardball", rating: 5 },
      { gameName: "Space Pilot", rating: 5 },
      { gameName: "Sumando", rating: 5 },
    ],
    sideB: [
      { gameName: "Bruce Lee", rating: 5 },
      { gameName: "Grog's Revenge", rating: 5 },
      { gameName: "Pitfall 2", rating: 5 },
      { gameName: "Slot Machine", rating: 5 },
      { gameName: "Spy Hunter", rating: 5 },
    ],
  },
  {
    _id: "35",
    sideA: [{ gameName: "Hillsfar", rating: 5 }],
    sideB: [],
  },
  {
    _id: "36",
    sideA: [{ gameName: "Indoor sports", rating: 5 }],
    sideB: [
      { gameName: "Ping Pong", rating: 5 },
      { gameName: "Dragonriders of Pern", rating: 5 },
    ],
  },
  {
    _id: "37",
    sideA: [{ gameName: "Infiltrator", rating: 5 }],
    sideB: [],
  },
  {
    _id: "38",
    sideA: [{ gameName: "Jordan Vs Bird", rating: 5 }],
    sideB: [],
  },

  // Disk 39 swapped in sheet; normalized to your canonical: sideA World Karate Championship, sideB Karateka
  {
    _id: "39",
    sideA: [{ gameName: "World Karate Championship", rating: 5 }],
    sideB: [{ gameName: "Karateka", rating: 5 }],
  },

  { _id: "40", sideA: [{ gameName: "Kings of the Beach", rating: 5 }], sideB: [] },
  { _id: "41", sideA: [{ gameName: "Knight Games", rating: 5 }], sideB: [] },
  {
    _id: "42",
    sideA: [{ gameName: "Micro League Wrestling", rating: 5 }],
    sideB: [{ gameName: "Murder in the Mississipi", rating: 5 }],
  },
  {
    _id: "43",
    sideA: [{ gameName: "Might & Magic", rating: 5 }],
    sideB: [],
  },
  {
    _id: "44",
    sideA: [{ gameName: "Monopoly Deluxe", rating: 5 }],
    sideB: [{ gameName: "One On One", rating: 5 }],
  },
  { _id: "45", sideA: [{ gameName: "Music Shop", rating: 5 }], sideB: [] },
  { _id: "46", sideA: [{ gameName: "Out Run", rating: 5 }], sideB: [] },
  {
    _id: "47",
    sideA: [{ gameName: "Paper Boy", rating: 5 }],
    sideB: [{ gameName: "Champ Wrestling", rating: 5 }],
  },
  {
    _id: "48",
    sideA: [
      { gameName: "Pitfall 2", rating: 5 },
      { gameName: "Star Wars", rating: 5 },
      { gameName: "Bruce Lee", rating: 5 },
      { gameName: "Crystal Castles", rating: 5 },
      { gameName: "Pitstop", rating: 5 },
    ],
    sideB: [
      { gameName: "Raid on Bungeling Bay", rating: 5 },
      { gameName: "Mancopter", rating: 5 },
    ],
  },
  { _id: "49", sideA: [{ gameName: "Pool of Radiance", rating: 5 }], sideB: [] },

  // Sheet says Write Stuff; kept as-is.
  { _id: "50", sideA: [{ gameName: "Raid Over Moscow", rating: 5 }], sideB: [{ gameName: "The Write Stuff", rating: 5 }] },

  { _id: "51", sideA: [{ gameName: "Robocop", rating: 5 }], sideB: [{ gameName: "Side Arms", rating: 5 }] },
  { _id: "52", sideA: [{ gameName: "Skate or Die!", rating: 5 }], sideB: [] },
  {
    _id: "53",
    sideA: [
      { gameName: "Skyfox", rating: 5 },
      { gameName: "Minit Man", rating: 5 },
      { gameName: "Burning Rubber", rating: 5 },
    ],
    sideB: [
      { gameName: "Fighting Warriors", rating: 5 },
      { gameName: "Axis Assasisn", rating: 5 },
    ],
  },
  {
    _id: "54",
    sideA: [{ gameName: "Slam Dunk", rating: 5 }],
    sideB: [
      { gameName: "Exploding Fist", rating: 5 },
      { gameName: "SkyJet", rating: 5 },
      { gameName: "On Field Football", rating: 5 },
    ],
  },
  {
    _id: "55",
    sideA: [
      { gameName: "Spy vs Spy 2", rating: 5 },
      { gameName: "Ghost N Goblins", rating: 5 },
    ],
    sideB: [
      { gameName: "Tapper", rating: 5 },
      { gameName: "Zorro", rating: 5 },
      { gameName: "Spy Hunter", rating: 5 },
      { gameName: "Ole", rating: 5 },
    ],
  },
  { _id: "56", sideA: [{ gameName: "Summer Games 2", rating: 5 }], sideB: [] },
  {
    _id: "57",
    sideA: [{ gameName: "Summer Games 1", rating: 5 }],
    sideB: [
      { gameName: "Archon", rating: 5 },
      { gameName: "Archon II", rating: 5 },
    ],
  },
  {
    _id: "58",
    sideA: [{ gameName: "Super Cycle", rating: 5 }],
    sideB: [
      { gameName: "Genesis", rating: 5 },
      { gameName: "Stealth", rating: 5 },
      { gameName: "Zodiak", rating: 5 },
    ],
  },
  {
    _id: "59",
    sideA: [
      { gameName: "Tapper", rating: 5 },
      { gameName: "Eagle Empire", rating: 5 },
      { gameName: "Frogger 2", rating: 5 },
    ],
    sideB: [
      { gameName: "Bomb jack Flash", rating: 5 },
      { gameName: "Krakout", rating: 5 },
      { gameName: "Soldier1", rating: 5 },
      { gameName: "Race With The Devil", rating: 5 },
      { gameName: "Auf Wiedersehen", rating: 5 },
    ],
  },
  {
    _id: "60",
    sideA: [
      { gameName: "Touchdown Football", rating: 5 },
      { gameName: "Elektra Glide", rating: 5 },
    ],
    sideB: [{ gameName: "Fight Night", rating: 5 }],
  },
  {
    _id: "61",
    sideA: [{ gameName: "Uridium", rating: 5 }],
    sideB: [
      { gameName: "Leaderboard", rating: 5 },
      { gameName: "Transformers", rating: 5 },
      { gameName: "Mario Bros", rating: 5 },
      { gameName: "Decathlon", rating: 5 },
    ],
  },
  { _id: "62", sideA: [{ gameName: "Wind Walker", rating: 5 }], sideB: [] },
  { _id: "63", sideA: [{ gameName: "WinterGames Ag Disk", rating: 5 }], sideB: [] },
  { _id: "64", sideA: [{ gameName: "World Games", rating: 5 }], sideB: [] },
  {
    _id: "65",
    sideA: [
      { gameName: "Yie Ar Kung Fu", rating: 5 },
      { gameName: "Desert Fox", rating: 5 },
    ],
    sideB: [{ gameName: "Parallax", rating: 5 }],
  },
  { _id: "66", sideA: [{ gameName: "California Games", rating: 5 }], sideB: [] },
  { _id: "67", sideA: [{ gameName: "Test Drive", rating: 5 }], sideB: [] },
  {
    _id: "68",
    sideA: [{ gameName: "Impossible Mission 1", rating: 5 }],
    sideB: [{ gameName: "Impossible Mission 2", rating: 5 }],
  },
  {
    _id: "69",
    sideA: [
      { gameName: "Action Biker", rating: 5 },
      { gameName: "Afterburner", rating: 5 },
    ],
    sideB: [
      { gameName: "Arctic Fox", rating: 5 },
      { gameName: "Spider-Man", rating: 5 },
      { gameName: "Bandits", rating: 5 },
      { gameName: "Blue Max", rating: 5 },
    ],
  },
  {
    _id: "70",
    sideA: [{ gameName: "Heroes Of The Lance", rating: 5 }],
    sideB: [
      { gameName: "Ikhari Warriors", rating: 5 },
      { gameName: "Leaderboard Executive", rating: 5 },
      { gameName: "Mule1", rating: 5 },
      { gameName: "Mule2", rating: 5 },
    ],
  },
  {
    _id: "71",
    sideA: [
      { gameName: "Barbarian 1", rating: 5 },
      { gameName: "Barbarian 2", rating: 5 },
    ],
    sideB: [
      { gameName: "BMX Racers", rating: 5 },
      { gameName: "Desert Fox", rating: 5 },
      { gameName: "Gyroscope", rating: 5 },
      { gameName: "He-Man", rating: 5 },
    ],
  },
  {
    _id: "72",
    sideA: [
      { gameName: "Boulder Dash 1", rating: 5 },
      { gameName: "Boulder Dash 2", rating: 5 },
      { gameName: "Boulder Dash 3", rating: 5 },
    ],
    sideB: [
      { gameName: "Kung Fu Master", rating: 5 },
      { gameName: "MOTU", rating: 5 },
      { gameName: "Pitfall", rating: 5 },
      { gameName: "Talladega", rating: 5 },
      { gameName: "Smurfen", rating: 5 },
    ],
  },
  {
    _id: "73",
    sideA: [{ gameName: "Sta Wars Orig Trilogy", rating: 5 }],
    sideB: [
      { gameName: "Shinoby", rating: 5 },
      { gameName: "Star League Baseball", rating: 5 },
    ],
  },
  {
    _id: "74",
    sideA: [{ gameName: "Micro League Football", rating: 5 }],
    sideB: [{ gameName: "Predator", rating: 5 }],
  },
  { _id: "75", sideA: [{ gameName: "Maniac Mansion", rating: 5 }], sideB: [] },
  { _id: "76", sideA: [{ gameName: "Caveman Ughlympics", rating: 5 }], sideB: [] },
  { _id: "77", sideA: [{ gameName: "The Bard's Tale", rating: 5 }], sideB: [] },
  { _id: "78", sideA: [{ gameName: "The Last Ninja", rating: 5 }], sideB: [] },
  {
    _id: "79",
    sideA: [{ gameName: "The Amazing Spiderman and Capt America in Dr Doom's Revenge", rating: 5 }],
    sideB: [],
  },
  {
    _id: "80",
    sideA: [{ gameName: "Mavis Beacon Teaches Typing", rating: 5 }],
    sideB: [],
  },
];

module.exports = gameDiskData;
