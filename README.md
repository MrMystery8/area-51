# Area-51: A 3D Web-Based Survival Game


Welcome to Area-51, a challenging 3D survival game set in a mysterious, procedurally generated world teeming with alien life and secrets. Explore, gather resources, craft tools and weapons, build shelter, fight off hostile creatures, and manage your basic needs to survive.

## ✨ Features

*   **3D Graphics:** Rendered using **THREE.js** for an immersive experience.
*   **Physics Engine:** Utilizes **CANNON.js** for realistic interactions and movement.
*   **Procedural Terrain:** Explore a vast, unique world generated using **Simplex Noise**.
*   **Survival Mechanics:** Manage Health (HP), Stamina (ST), Hunger (HUN), and Thirst (THI). Starvation and dehydration are real threats!
*   **Combat System:**
    *   **Melee:** Barehanded attacks, Axes, Swords, Laser Swords.
    *   **Ranged:** Energy Blasters, Plasma Rifles with ammo, reloading, and aiming mechanics.
    *   **Damage Feedback:** Visual red pulse effect when taking damage.
*   **Enemy AI:** Encounter various alien creatures with different behaviors (wandering, chasing, fleeing, attacking).
*   **Inventory System:** Collect and manage items you find or craft.
*   **Crafting System:** Combine resources to create tools, weapons, ammo, and survival items like campfires.
*   **Quest System:** Undertake objectives for rewards and progression. Find quests from NPCs.
*   **Shop System:** Spend collected Gold Coins to purchase useful items.
*   **Resource Gathering:** Collect wood, stone, berries, alien materials, and more from the environment.
*   **Building & Interaction:**
    *   Discover procedurally placed buildings.
    *   Interact with doors (open/close).
    *   Loot chests found inside buildings.
    *   Place functional campfires.
*   **Loot System:** Defeated enemies drop resources (meat, coins). Chests contain valuable loot.
*   **Day/Night Cycle:** Experience dynamic lighting changes affecting visibility and potentially gameplay.
*   **Enhanced UI:**
    *   Clean Heads-Up Display (HUD) with status bars.
    *   Minimap showing player, enemies, and buildings.
    *   Intuitive panels for Inventory, Crafting, Quests, and Shop.
    *   Feedback messages for player actions and events.
*   **Aiming Mode:** Toggle a focused aim mode with a crosshair for ranged weapons.
*   **NPCs:** Interact with non-player characters to potentially gain quests.

## 🎮 Gameplay Controls

| Key          | Action                                                        |
| :----------- | :------------------------------------------------------------ |
| **W, A, S, D** | Move Player                                                   |
| **Shift**    | Sprint (consumes Stamina)                                     |
| **Space**    | Jump                                                          |
| **Q**        | Attack / Shoot                                                |
| **R**        | Reload Equipped Gun (if applicable)                           |
| **E**        | Interact (Collect Resource, Open Door/Chest, Talk to NPC)     |
| **X**        | Toggle Aim Mode (only with Energy Blaster / Plasma Rifle)     |
| **I**        | Toggle Inventory Panel                                        |
| **C**        | Toggle Crafting Panel                                         |
| **P**        | Toggle Quests Panel                                           |
| **L**        | Toggle Shop Panel                                             |
| **F**        | Place Campfire (if available in inventory)                    |
| **U**        | Unequip Current Weapon                                        |
| **← / →**    | Rotate Camera (Normal View) / Turn Aim (Aim Mode)           |
| **↑ / ↓**    | Zoom Camera (Normal View) / Tilt Aim (Aim Mode)             |
| **Esc**      | *Toggle Pause Menu (Placeholder - implementation may vary)* |

## 🔧 Technology Stack

*   HTML5
*   CSS3
*   JavaScript (ES6 Modules)
*   **THREE.js:** 3D graphics rendering library.
*   **CANNON.js:** Physics engine.
*   **Simplex Noise:** For procedural terrain generation.
*   **GLTFLoader:** For loading 3D models (GLB format).

## 🚀 Setup and Installation

To run this game locally, you need a local web server because browsers restrict loading assets (like models or ES6 modules) directly from the file system (`file:///`).

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Ensure File Structure:** Make sure you have `index.html`, `style.css`, `game.js`, and the `assets/` and `animation/` directories with all necessary `.glb` and `.png` files in the correct locations.
3.  **Run a Local Web Server:**
    *   **Using Python 3:**
        ```bash
        python -m http.server
        ```
        (Usually serves on port 8000)
    *   **Using Node.js (requires `http-server`):**
        ```bash
        # Install if you don't have it: npm install -g http-server
        http-server .
        ```
        (Usually serves on port 8080)
    *   **Using VS Code:** Install the "Live Server" extension and click "Go Live".
4.  **Access the Game:** Open your web browser and navigate to `http://localhost:<PORT>` (e.g., `http://localhost:8000` or `http://localhost:8080`).

## ▶️ How to Play

1.  **Spawn:** You will appear in a procedurally generated world.
2.  **Survive:** Your primary goal is to stay alive! Keep an eye on your **Health**, **Stamina**, **Hunger**, and **Thirst** levels in the top-left HUD.
3.  **Gather:** Explore the environment and press **E** when near resources like trees (wood), rocks (stone), berries, or alien materials to collect them.
4.  **Craft:** Press **C** to open the Crafting panel. If you have the required resources, you can craft tools (like an Axe), weapons, ammo, or a Campfire.
5.  **Manage Needs:**
    *   Eat food (like Berries or Meat) from your inventory (**I** -> Use) to replenish Hunger.
    *   Drink water (Water Bottles, Alien Water) to replenish Thirst.
    *   Rest (avoid sprinting constantly) to regain Stamina.
    *   Avoid taking damage to preserve Health. Placing and staying near a Campfire might offer some protection or warmth (check specific implementation).
6.  **Combat:**
    *   Equip weapons via the Inventory panel (**I** -> Equip).
    *   Use **Q** to attack with melee weapons or fire ranged weapons.
    *   For guns (Energy Blaster, Plasma Rifle), press **X** to aim for better accuracy.
    *   Press **R** to reload when your magazine is empty (requires reserve ammo in inventory).
    *   Defeat enemies to get loot like Meat and Gold Coins.
7.  **Explore & Progress:**
    *   Discover buildings, some may contain lootable Chests (**E** to open).
    *   Find NPCs and press **E** to interact - they might give you quests.
    *   Check your current quests by pressing **P**. Completing quests grants rewards.
    *   Collect Gold Coins and press **L** to open the Shop and buy items.
8.  **Beware the Night:** The world gets darker during the night cycle. Be prepared!


## 📜 License

*(Specify your license here, e.g., MIT License, or state that it's unlicensed)*

This project is currently unlicensed.