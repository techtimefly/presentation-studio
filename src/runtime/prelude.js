(() => {
  "use strict";
  const sourceTemplate =
    "<!doctype html>\n" + document.documentElement.outerHTML;
  const $ = (id) => document.getElementById(id),
    params = new URLSearchParams(location.search);

const studioBuild = /* @BUILD_KIND */;
const studioTemplateName = "Studio demo";
