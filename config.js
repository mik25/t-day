const config = {
  id: "hy.jacketttpbr.stream",
  version: "1.0.0",
  name: "YourbitRD",
  description: "Movie & TV Streams",
  logo: "https://www.hackercombat.com/wp-content/uploads/2018/07/YourBittorrent-one-of-the-major-forces-on-the-internet.jpg",
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
