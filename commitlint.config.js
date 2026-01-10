const fs = require("node:fs");
const path = require("node:path");

const getDirectories = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

const packages = getDirectories(path.resolve(__dirname, "packages"));
const apps = getDirectories(path.resolve(__dirname, "apps"));

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", [...packages, ...apps, "repo"]],
    "scope-empty": [2, "never"],
  },
};
