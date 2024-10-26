const config = {
  id: "hy.jacketttpbr.stream",
  version: "1.0.0",
  name: "GKOX Reborn",
  description: "Movie & TV Streams",
  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/The_Pirate_Bay_logo.svg/904px-The_Pirate_Bay_logo.svg.png",
  resources: [
    {
      name: "stream",
      types: ["movie", "series", "anime"],
      idPrefixes: ["tt", "kitsu"],
    },
  ],
  types: ["movie", "series", "anime", "other"],
  catalogs: [],
};
module.exports = config;
