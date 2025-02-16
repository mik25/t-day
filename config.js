const config = {
  id: "hy.jacketttpbr.stream",
  version: "1.0.0",
  name: "Trellas",
  description: "Movie & TV Streams",
  logo: "https://trellas.me/data/gallery/l/greeksubsper1.png",
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
