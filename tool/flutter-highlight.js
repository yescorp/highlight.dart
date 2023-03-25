import fs from "fs";
import path from "path";
import _ from "lodash";
import postcss from "postcss";
import { NOTICE_COMMENT } from "./utils.js";

const rootDir = "node_modules/highlight.js/styles";
const destDir = "../highlight/lib/themes";

/**
 * white, #fff, #ffffff, rgba(0,0,0,0) -> Flutter color
 *
 * @param {string} color
 */
const convertColor = color => {
  if (color === "inherit") return;
  if (color.startsWith("rgba(")) return `Color.fromRGBO${color.slice(4)}`;

  let rgb = "";

  if (color.includes("url(")) {
    // Find the first pattern matches CSS color
    // FIXME: background image
    const c = /#[0-9a-fA-F]{3,6}/.exec(color);
    if (!c) return;
    rgb = c[0].slice(1);
  } else if (color === "white") {
    rgb = "ffffff";
  } else if (color === "black") {
    rgb = "000000";
  } else if (color === "navy") {
    rgb = "000080";
  } else if (color === "gold") {
    rgb = "ffd700";
  } else if (color.startsWith("#")) {
    rgb = color.slice(1);
    if (rgb.length === 3) {
      rgb = rgb
        .split("")
        .map(x => x + x)
        .join("");
    }
  }

  if (rgb) {
    return `Color(0xff${rgb})`;
  } else {
    console.log(`color ignored: ${color}`);
  }
};

/**
 * flutter_highlight/lib/themes/*
 * flutter_highlight/lib/theme_map.dart
 */
export function style() {
  let all = [NOTICE_COMMENT, "const themeMap = {"];
  let exports = ['library highlight_themes;\n\n', `export 'theme_map.dart';`];

  // ["agate.css"]
  fs.readdirSync(rootDir).forEach(file => {
    if (path.extname(file) != ".css") return;
    if (file === "darkula.css") return; // Deprecated

    const fileName = path.basename(file, ".css");
    let varName = _.camelCase(fileName + "Theme").replace(/a11y/i, "a11y");

    all[0] += `import 'themes/${fileName}.dart';`;
    exports.push(`export 'themes/${fileName}.dart';`);
    all[1] += `'${fileName}': ${varName},`;

    const ast = postcss.parse(fs.readFileSync(path.resolve(rootDir, file)));
    // console.log(ast);

    const obj = {};
    ast.walkRules((rule, index) => {
      // FIXME: a11y media query
      if (rule.parent.type === "atrule" && rule.parent.name === "media") {
        return;
      }

      rule.selectors.forEach(selector => {
        if (/\s+/.test(selector)) {
          // FIXME: nested selector
          // console.log(selector);
          return;
        }
        if (selector === ".hljs") selector = "root";
        selector = selector.replace(".hljs-", "");

        const style = {};
        rule.nodes.forEach(item => {
          if (item.type === "comment") {
            return;
          } else if (item.type === "decl") {
            switch (item.prop) {
              case "color": {
                const flutterColor = convertColor(item.value);

                if (flutterColor) {
                  style.color = flutterColor;
                }
                break;
              }
              case "background":
              case "background-color": {
                const flutterColor = convertColor(item.value);
                if (flutterColor) {
                  style.backgroundColor = flutterColor;
                }
                break;
              }
              case "font-style":
                style.fontStyle = `FontStyle.${item.value}`;
                break;
              case "font-weight":
                if (item.value === "bolder") {
                  item.value = "bold"; // FIXME:
                }
                if (item.value === "bold") {
                  style.fontWeight = `FontWeight.bold`;
                  break;
                }
                style.fontWeight = `FontWeight.w${item.value}`;
                break;
            }
          } else {
            console.log(`rule ignored: ${item.type}`);
          }
        });

        const styleEntries = Object.entries(style);
        // selector = selector.replace(/\_/g, '');
        if (styleEntries.length) {
          if (!obj[selector]) {
            obj[selector] = style;
          } else {
            Object.assign(obj[selector], style);
          }
        }
      });
    });

    let code = `${NOTICE_COMMENT}import 'package:flutter/painting.dart'; const ${varName} = {`;
    Object.entries(obj).forEach(([selector, v]) => {
      code += `'${selector}': TextStyle(${Object.entries(v)
        .map(([k, v]) => `${k}:${v}`)
        .join(",")}),`;
    });
    code += "};";

    fs.writeFileSync(path.resolve(destDir, `${fileName}.dart`), code);
  });

  all[1] += "};";
  exports.push('');
  fs.writeFileSync("../highlight/lib/theme_map.dart", all.join("\n"));
  fs.writeFileSync("../highlight/lib/highlight_themes.dart", exports.join('\n'));
}

style()