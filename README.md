# 🧺 Picnic Battle 🐜

A picnic-themed reskin of Battleship, inspired by [Snack Attack](https://prinnit.com/ForgeCore/design/3C8J0SzWx0U0pk0fwYd1dK8z0Gd) by ForgeCore.

- **Ships** are food items on your picnic blanket: Baguette (5), Watermelon Slice (4), Corn on the Cob (3), Pickle (3), and a Cherry Pair (2).
- **The sea** is a checkered picnic blanket (10x10 grid).
- **Bombs** are ants — send them across the enemy's blanket to sniff out their snacks, and watch out for the ants coming for yours.

It's a single-player game against a simple computer opponent: no build step, no dependencies, just static HTML/CSS/JS.

## Play it

Two ways to run it, both with no build step and no dependencies:

- **Single file:** open [`standalone.html`](standalone.html) directly in a browser (double-click it, or drag it into a browser tab). Everything — markup, styles, and game logic — is bundled into that one file, so it works with no server at all.
- **From source:** open `index.html` directly, or serve the folder with any static file server, e.g.:

  ```sh
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

`standalone.html` is generated from `index.html`, `css/style.css`, and `js/game.js` — if you edit those, regenerate it with:

```sh
python3 scripts/build_standalone.py
```

## How to play

1. **Pack your basket** — select a food from the tray, then click a cell on your blanket to place it. Use **Rotate** to switch between horizontal/vertical, or **Shuffle Basket** to auto-place everything randomly.
2. **Start the Picnic Battle** once all five foods are placed.
3. Take turns clicking cells on the **Enemy Picnic Blanket** to send in the ants. A hit reveals ants swarming a food item; a miss shows a lone, disappointed ant. Sink all five enemy foods before the ants find your entire picnic first!

## Project structure

```
index.html                     Markup for the placement and battle screens
css/style.css                  Picnic/gingham styling, board grid, animations
js/game.js                     Game state, board logic, simple hunt/target AI, rendering
standalone.html                Generated single-file bundle of the three files above
scripts/build_standalone.py    Regenerates standalone.html from source
```
