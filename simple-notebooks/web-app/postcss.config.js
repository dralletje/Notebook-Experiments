module.exports = {
  plugins: [
    require("autoprefixer"),
    // @ts-ignore
    require("tailwindcss/nesting")("postcss-nesting"),
    // require("postcss-nesting"),
    require("tailwindcss"),
  ],
};
