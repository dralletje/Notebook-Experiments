module.exports = {
  plugins: [
    require("autoprefixer"),
    // require("postcss-nesting"),
    // @ts-ignore
    require("tailwindcss/nesting")("postcss-nesting"),
    require("tailwindcss"),
  ],
};
