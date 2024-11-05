const config = {
  id: "hy.jacketttpbr.stream",
  version: "1.0.0",
  name: "IPtorrents",
  description: "Movie & TV Streams",
  logo: "https://http2.mlstatic.com/D_NQ_NP_903993-MLB46933227304_072021-O.webp",
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
