const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  // Markdown mit Zeilenumbrüchen
  const md = markdownIt({ html: true, breaks: true, linkify: true });
  eleventyConfig.setLibrary("md", md);

  // Filter
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Passthrough
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");

  // Dev-Server
  eleventyConfig.setServerOptions({
    host: "0.0.0.0",
    port: 8080,
  });

  return {
    dir: {
      input: "src",
      includes: "_layouts",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
