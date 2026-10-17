"""Rassemble le projet en un seul fichier HTML jouable : python outils/assembler.py [sortie.html]"""
import os, re, sys

racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sortie = sys.argv[1] if len(sys.argv) > 1 else os.path.join(racine, "le-puits.html")
lire = lambda chemin: open(os.path.join(racine, chemin), encoding="utf-8").read()

html = lire("index.html")
# Feuilles de style locales → <style>
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: "<style>\n" + lire(m.group(1)) + "</style>", html)
# Scripts locaux → un seul <script>, dans le même ordre
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
corps = "\n".join(lire(s).replace('"use strict";\n', "", 1) for s in scripts)
html = re.sub(r'(<script src="[^"]+"></script>\n?)+', "", html)
html = html.replace("</body>", '<script>\n"use strict";\n' + corps + "</script>\n</body>")
open(sortie, "w", encoding="utf-8").write(html)
print("Créé :", sortie, f"({len(html) // 1024} Ko, {len(scripts)} scripts)")
