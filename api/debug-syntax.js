import fs from "node:fs";
import vm from "node:vm";

export default function handler(req, res) {
  try {
    const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const matches = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
    const main = matches[1]?.[1] || "";
    try {
      new vm.Script(main, { filename: "index-main.js" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({
        ok: false,
        name: e?.name,
        message: e?.message,
        stack: e?.stack
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message, stack: e?.stack });
  }
}
